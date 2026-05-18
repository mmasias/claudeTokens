# Contribuir a Claude Tokens

## Arquitectura en dos frases

La extensión Chrome lee `chrome.storage.local`. El service worker (`background.js`) llama al host nativo Python (`native_host/claude_token_bridge.py`), que escanea `~/.claude/projects/**/*.jsonl` y devuelve tokens agregados por día.

## Estructura del repositorio

```
manifest.json          — configuración de la extensión (MV3)
background.js          — service worker: llama al host, cachea, actualiza badge
popup.html/css/js      — interfaz del popup
options.html/css/js    — página de configuración
icons/                 — iconos PNG (16, 48, 128px)
native_host/
  claude_token_bridge.py  — host nativo Python (lee ~/.claude/)
  install.sh              — instala el host en el sistema
test/
  sample_session.jsonl    — sesión JSONL anonimizada para desarrollo
```

## Desarrollar sin tener Claude Code instalado

El archivo `test/sample_session.jsonl` contiene una sesión de ejemplo con el formato real. Para probar el host nativo con datos falsos:

```bash
# Crea una estructura de directorio de prueba
mkdir -p /tmp/claude-test/projects/test-project

# Copia el sample
cp test/sample_session.jsonl /tmp/claude-test/projects/test-project/session-001.jsonl

# Apunta el host al directorio de prueba y ejecútalo manualmente
CLAUDE_DIR=/tmp/claude-test python3 - <<'EOF'
import sys
sys.path.insert(0, 'native_host')

# Parchea la ruta antes de importar
import claude_token_bridge as ctb
import os
ctb.scan_usage.__globals__['os'].path.expanduser = lambda p: p.replace('~/.claude', '/tmp/claude-test')

import json
result = ctb.scan_usage()
print(json.dumps(result, indent=2))
EOF
```

O más simple, edita temporalmente la línea `projects_dir` en `claude_token_bridge.py` para apuntar a `/tmp/claude-test/projects`.

## Formato de los archivos JSONL

Cada línea es un objeto JSON. El host solo procesa líneas con `"type":"assistant"` que tengan el campo `usage`:

```json
{
  "type": "assistant",
  "timestamp": "2026-05-18T09:00:05.000Z",
  "message": {
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 45,
      "cache_creation_input_tokens": 1200,
      "cache_read_input_tokens": 0,
      "output_tokens": 312
    }
  }
}
```

Los IDs de modelo pueden llevar sufijo de fecha (`claude-sonnet-4-6-20251015`). El host los normaliza eliminando el sufijo antes de buscar la tarifa.

## Tarifas de modelos

Definidas en `MODEL_RATES` dentro de `claude_token_bridge.py` en centavos por millón de tokens. Si Anthropic actualiza precios o lanza nuevos modelos, es el único sitio que hay que tocar.

## Protocolo de native messaging

Chrome comunica con el host mediante stdin/stdout con mensajes length-prefixed (4 bytes little-endian + JSON UTF-8). El host espera:

```json
{ "type": "GET_USAGE" }
```

Y responde:

```json
{
  "ok": true,
  "data": {
    "2026-05-18": {
      "tokens": { "input": 63, "output": 510, "cache_creation": 1200, "cache_read": 1512, "total": 3285 },
      "sessions": 1,
      "cost_cents": 0.2847,
      "earliest_ts": "2026-05-18T09:00:05.000Z"
    }
  }
}
```

## Pull requests

- Un PR por cambio lógico
- Si tocas `MODEL_RATES`, incluye la fuente de los precios (enlace a la página de pricing de Anthropic)
- Si tocas el protocolo de mensajes entre extensión y host, actualiza este documento
