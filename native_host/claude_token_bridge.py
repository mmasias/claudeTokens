#!/usr/bin/env python3
"""
Native messaging host para Claude Tokens.
Agrega tokens de Claude Code, Gemini CLI y OpenCode/z.ai por día.
"""
import sys
import json
import struct
import os
import glob
import re
import sqlite3
from datetime import datetime, timezone, timedelta

# Precios Claude por 1M tokens en centavos de USD.
# Claves: prefijo de modelo sin sufijo de fecha.
CLAUDE_RATES = {
    'claude-opus-4-7':   {'input': 500,  'output': 2500, 'cache_creation': 625, 'cache_read': 50},
    'claude-opus-4-5':   {'input': 500,  'output': 2500, 'cache_creation': 625, 'cache_read': 50},
    'claude-sonnet-4-6': {'input': 300,  'output': 1500, 'cache_creation': 375, 'cache_read': 30},
    'claude-sonnet-4-5': {'input': 300,  'output': 1500, 'cache_creation': 375, 'cache_read': 30},
    'claude-haiku-4-5':  {'input': 100,  'output': 500,  'cache_creation': 125, 'cache_read': 10},
}
CLAUDE_DEFAULT_RATES = CLAUDE_RATES['claude-sonnet-4-6']

_DATE_SUFFIX = re.compile(r'-\d{8}$')

def normalize_model(model_id: str) -> str:
    return _DATE_SUFFIX.sub('', model_id or '')

def claude_cost_cents(tokens: dict, model: str) -> float:
    rates = CLAUDE_RATES.get(normalize_model(model), CLAUDE_DEFAULT_RATES)
    return (
        tokens['input'] * rates['input'] +
        tokens['output'] * rates['output'] +
        tokens['cache_creation'] * rates['cache_creation'] +
        tokens['cache_read'] * rates['cache_read']
    ) / 1_000_000


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


def make_day():
    return {
        'tokens': {'input': 0, 'output': 0, 'cache_creation': 0, 'cache_read': 0, 'total': 0},
        'cost_cents': 0.0,
        'earliest_ts': None,
        'by_tool': {
            'claude':   {'tokens': {'total': 0}, 'sessions': set()},
            'gemini':   {'tokens': {'total': 0, 'thoughts': 0, 'cached': 0}, 'sessions': set()},
            'opencode': {'tokens': {'total': 0, 'input': 0, 'output': 0, 'cache_read': 0}, 'sessions': set()},
        },
    }


def get_window(days=7):
    today = datetime.now(timezone.utc).date()
    return (
        {str(today - timedelta(days=i)): make_day() for i in range(days)},
        datetime.now(timezone.utc) - timedelta(days=days),
    )


def update_earliest(day, ts_str):
    if day['earliest_ts'] is None or ts_str < day['earliest_ts']:
        day['earliest_ts'] = ts_str


# ── Claude Code ──────────────────────────────────────────────────────────────

def scan_claude(days, cutoff):
    projects_dir = os.path.expanduser('~/.claude/projects')
    if not os.path.exists(projects_dir):
        return

    for jsonl_path in glob.glob(os.path.join(projects_dir, '**', '*.jsonl'), recursive=True):
        session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
        try:
            with open(jsonl_path, 'r', encoding='utf-8', errors='replace') as f:
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

                    ts_str = entry.get('timestamp', '')
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

                    inp = usage.get('input_tokens', 0)
                    out = usage.get('output_tokens', 0)
                    cc  = usage.get('cache_creation_input_tokens', 0)
                    cr  = usage.get('cache_read_input_tokens', 0)

                    day = days[date_key]
                    t = day['tokens']
                    t['input']          += inp
                    t['output']         += out
                    t['cache_creation'] += cc
                    t['cache_read']     += cr
                    day['cost_cents'] += claude_cost_cents(
                        {'input': inp, 'output': out, 'cache_creation': cc, 'cache_read': cr},
                        msg.get('model', ''),
                    )
                    day['by_tool']['claude']['tokens']['total'] += inp + out + cc + cr
                    day['by_tool']['claude']['sessions'].add(session_id)
                    update_earliest(day, ts_str)
        except OSError:
            continue


# ── Gemini CLI ───────────────────────────────────────────────────────────────

def scan_gemini(days, cutoff):
    chats_glob = os.path.expanduser('~/.gemini/tmp/**/chats/*.jsonl')
    for jsonl_path in glob.glob(chats_glob, recursive=True):
        session_id = os.path.splitext(os.path.basename(jsonl_path))[0]
        try:
            with open(jsonl_path, 'r', encoding='utf-8', errors='replace') as f:
                for line in f:
                    line = line.strip()
                    if not line or '"tokens"' not in line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if entry.get('type') != 'gemini':
                        continue

                    tokens = entry.get('tokens')
                    if not tokens:
                        continue

                    ts_str = entry.get('timestamp', '')
                    try:
                        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    except ValueError:
                        continue

                    if ts < cutoff:
                        continue

                    date_key = str(ts.date())
                    if date_key not in days:
                        continue

                    total = tokens.get('total', 0)
                    inp   = tokens.get('input', 0)
                    out   = tokens.get('output', 0)
                    tht   = tokens.get('thoughts', 0)
                    cach  = tokens.get('cached', 0)

                    day = days[date_key]
                    # Mapeo aproximado a la estructura común
                    day['tokens']['input']  += inp
                    day['tokens']['output'] += out
                    day['tokens']['cache_read'] += cach

                    gt = day['by_tool']['gemini']['tokens']
                    gt['total']    += total
                    gt['thoughts'] += tht
                    gt['cached']   += cach
                    day['by_tool']['gemini']['sessions'].add(session_id)
                    update_earliest(day, ts_str)
        except OSError:
            continue


# ── OpenCode / z.ai ──────────────────────────────────────────────────────────

def scan_opencode(days, cutoff):
    db_path = os.path.expanduser('~/.local/share/opencode/opencode.db')
    if not os.path.exists(db_path):
        return

    try:
        conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
        rows = conn.execute(
            "SELECT data FROM message WHERE data LIKE '%\"role\":\"assistant\"%' AND data LIKE '%\"tokens\"%'"
        ).fetchall()
        conn.close()
    except sqlite3.Error:
        return

    for (raw,) in rows:
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if entry.get('role') != 'assistant':
            continue

        tokens = entry.get('tokens')
        if not tokens:
            continue

        time_ms = entry.get('time', {}).get('created')
        if not time_ms:
            continue

        ts = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc)
        if ts < cutoff:
            continue

        date_key = str(ts.date())
        if date_key not in days:
            continue

        session_id = entry.get('parentID', str(time_ms))
        total = tokens.get('total', 0)
        inp   = tokens.get('input', 0)
        out   = tokens.get('output', 0)
        cr    = tokens.get('cache', {}).get('read', 0)

        day = days[date_key]
        day['tokens']['input']      += inp
        day['tokens']['output']     += out
        day['tokens']['cache_read'] += cr

        ot = day['by_tool']['opencode']['tokens']
        ot['total']      += total
        ot['input']      += inp
        ot['output']     += out
        ot['cache_read'] += cr
        day['by_tool']['opencode']['sessions'].add(session_id)
        ts_str = ts.isoformat()
        update_earliest(day, ts_str)


# ── Agregación final ─────────────────────────────────────────────────────────

def scan_all():
    days, cutoff = get_window()
    scan_claude(days, cutoff)
    scan_gemini(days, cutoff)
    scan_opencode(days, cutoff)

    result = {}
    for date, day in days.items():
        t = day['tokens']
        t['total'] = t['input'] + t['output'] + t['cache_creation'] + t['cache_read']
        result[date] = {
            'tokens': t,
            'sessions': len(
                day['by_tool']['claude']['sessions']
                | day['by_tool']['gemini']['sessions']
                | day['by_tool']['opencode']['sessions']
            ),
            'cost_cents': round(day['cost_cents'], 4),
            'earliest_ts': day['earliest_ts'],
            'by_tool': {
                tool: {
                    'tokens': data['tokens'],
                    'sessions': len(data['sessions']),
                }
                for tool, data in day['by_tool'].items()
            },
        }

    return result


def main():
    while True:
        msg = read_message()
        if msg is None:
            break
        try:
            if msg.get('type') == 'GET_USAGE':
                send_message({'ok': True, 'data': scan_all()})
            else:
                send_message({'ok': False, 'error': 'tipo desconocido'})
        except Exception as e:
            send_message({'ok': False, 'error': str(e)})


if __name__ == '__main__':
    main()
