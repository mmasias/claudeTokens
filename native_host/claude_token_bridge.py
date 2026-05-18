#!/usr/bin/env python3
"""
Native messaging host para Claude Tokens.
Lee los archivos JSONL de sesión de ~/.claude/projects/ y agrega tokens por día.
"""
import sys
import json
import struct
import os
import glob
import re
from datetime import datetime, timezone, timedelta

# Precios por 1M tokens en centavos de USD.
# Las claves son el prefijo del modelo (sin sufijo de fecha).
MODEL_RATES = {
    'claude-opus-4-7':   {'input': 500,  'output': 2500, 'cache_creation': 625, 'cache_read': 50},
    'claude-opus-4-5':   {'input': 500,  'output': 2500, 'cache_creation': 625, 'cache_read': 50},
    'claude-sonnet-4-6': {'input': 300,  'output': 1500, 'cache_creation': 375, 'cache_read': 30},
    'claude-sonnet-4-5': {'input': 300,  'output': 1500, 'cache_creation': 375, 'cache_read': 30},
    'claude-haiku-4-5':  {'input': 100,  'output': 500,  'cache_creation': 125, 'cache_read': 10},
}
DEFAULT_RATES = MODEL_RATES['claude-sonnet-4-6']

# Elimina sufijos de fecha tipo "-20251015" para normalizar IDs de modelo.
_DATE_SUFFIX = re.compile(r'-\d{8}$')

def normalize_model(model_id: str) -> str:
    return _DATE_SUFFIX.sub('', model_id or '')

def get_rates(model_id: str) -> dict:
    return MODEL_RATES.get(normalize_model(model_id), DEFAULT_RATES)


def send_message(msg):
    data = json.dumps(msg, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    size = struct.unpack('<I', raw)[0]
    return json.loads(sys.stdin.buffer.read(size).decode('utf-8'))


def estimate_cost_cents(tokens: dict, rates: dict) -> float:
    return (
        tokens['input'] * rates['input'] +
        tokens['output'] * rates['output'] +
        tokens['cache_creation'] * rates['cache_creation'] +
        tokens['cache_read'] * rates['cache_read']
    ) / 1_000_000


def empty_day():
    return {
        'tokens': {'input': 0, 'output': 0, 'cache_creation': 0, 'cache_read': 0, 'total': 0},
        'sessions': set(),
        'cost_cents': 0.0,
        'earliest_ts': None,   # timestamp ISO del primer mensaje del día
    }


def scan_usage():
    today = datetime.now(timezone.utc).date()
    days = {str(today - timedelta(days=i)): empty_day() for i in range(7)}
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    projects_dir = os.path.expanduser('~/.claude/projects')
    if not os.path.exists(projects_dir):
        return days

    for jsonl_path in glob.glob(os.path.join(projects_dir, '**', '*.jsonl'), recursive=True):
        session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
        try:
            with open(jsonl_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if not line or '"usage"' not in line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if entry.get('type') != 'assistant':
                        continue

                    ts_str = entry.get('timestamp')
                    if not ts_str:
                        continue
                    try:
                        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    except ValueError:
                        continue

                    if ts < cutoff:
                        continue

                    date_key = str(ts.date())
                    if date_key not in days:
                        continue

                    msg = entry.get('message', {})
                    usage = msg.get('usage', {})
                    if not usage:
                        continue

                    rates = get_rates(msg.get('model', ''))
                    day = days[date_key]
                    t = day['tokens']
                    inp = usage.get('input_tokens', 0)
                    out = usage.get('output_tokens', 0)
                    cc  = usage.get('cache_creation_input_tokens', 0)
                    cr  = usage.get('cache_read_input_tokens', 0)

                    t['input']          += inp
                    t['output']         += out
                    t['cache_creation'] += cc
                    t['cache_read']     += cr
                    day['sessions'].add(session_id)
                    day['cost_cents']   += estimate_cost_cents(
                        {'input': inp, 'output': out, 'cache_creation': cc, 'cache_read': cr},
                        rates
                    )
                    if day['earliest_ts'] is None or ts_str < day['earliest_ts']:
                        day['earliest_ts'] = ts_str

        except OSError:
            continue

    result = {}
    for date, day in days.items():
        t = day['tokens']
        t['total'] = t['input'] + t['output'] + t['cache_creation'] + t['cache_read']
        result[date] = {
            'tokens': t,
            'sessions': len(day['sessions']),
            'cost_cents': round(day['cost_cents'], 4),
            'earliest_ts': day['earliest_ts'],
        }

    return result


def main():
    while True:
        msg = read_message()
        if msg is None:
            break
        try:
            if msg.get('type') == 'GET_USAGE':
                send_message({'ok': True, 'data': scan_usage()})
            else:
                send_message({'ok': False, 'error': 'tipo desconocido'})
        except Exception as e:
            send_message({'ok': False, 'error': str(e)})


if __name__ == '__main__':
    main()
