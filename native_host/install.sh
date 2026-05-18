#!/usr/bin/env bash
set -euo pipefail

EXTENSION_ID="${1:-}"
if [[ -z "$EXTENSION_ID" ]]; then
  echo "Uso: ./install.sh <extension-id>"
  echo ""
  echo "Encuentra el ID en chrome://extensions (modo desarrollador activado)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/claude_token_bridge.py"
HOST_NAME="com.claudetokens.bridge"
INSTALL_DIR="$HOME/.local/share/claude-tokens"
MANIFEST_NAME="${HOST_NAME}.json"

# Directorios de native messaging hosts para Chrome y Chromium
NM_DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
  "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
)

echo "Instalando Claude Token Bridge..."

# Copiar script
mkdir -p "$INSTALL_DIR"
cp "$HOST_SCRIPT" "$INSTALL_DIR/claude_token_bridge.py"
chmod +x "$INSTALL_DIR/claude_token_bridge.py"
echo "  Script instalado en: $INSTALL_DIR/claude_token_bridge.py"

# Crear manifiesto
MANIFEST=$(python3 -c "
import json, sys
print(json.dumps({
    'name': sys.argv[1],
    'description': 'Claude Tokens native bridge - lee uso de tokens desde ~/.claude/',
    'path': sys.argv[2],
    'type': 'stdio',
    'allowed_origins': ['chrome-extension://' + sys.argv[3] + '/']
}, indent=2))
" "$HOST_NAME" "$INSTALL_DIR/claude_token_bridge.py" "$EXTENSION_ID")

# Instalar manifiesto en cada directorio aplicable
INSTALLED=0
for NM_DIR in "${NM_DIRS[@]}"; do
  if [[ -d "$(dirname "$NM_DIR")" ]]; then
    mkdir -p "$NM_DIR"
    echo "$MANIFEST" > "$NM_DIR/$MANIFEST_NAME"
    echo "  Manifiesto instalado en: $NM_DIR/$MANIFEST_NAME"
    INSTALLED=$((INSTALLED + 1))
  fi
done

if [[ $INSTALLED -eq 0 ]]; then
  echo "ERROR: No se encontraron directorios de Chrome ni Chromium."
  echo "Crea el directorio manualmente y vuelve a ejecutar:"
  echo "  mkdir -p ~/.config/google-chrome/NativeMessagingHosts"
  exit 1
fi

echo ""
echo "Instalación completada."
echo "Recarga la extensión en chrome://extensions para activar el bridge."
