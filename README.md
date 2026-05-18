# Claude Tokens

Extensión de Chrome para monitorear el uso semanal de tokens en tus herramientas de IA: **Claude Code**, **Gemini CLI** y **OpenCode / z.ai**.

<div align=center>
<img src="https://github.com/user-attachments/assets/3cfd57b9-d1e2-4337-a407-7b466975e19e" width="35%" />  
</div>

## Qué muestra

- **Tokens totales** de la semana actual (ventana rodante de 7 días)
- **Desglose por herramienta**: Claude Code / Gemini / z.ai por separado
- **Barra de progreso** contra el límite que configures
- **Gráfico de barras** con el consumo combinado de los últimos 7 días
- **Costo estimado** en USD (solo Claude, calculado con tarifas por modelo)
- **Contador regresivo** hasta que los tokens del día más antiguo se liberen
- **Badge** en el icono con el porcentaje actual (si tienes límite configurado)

## Cómo funciona

Lee directamente los archivos locales de cada herramienta. Sin API keys, sin red, sin cuentas.

```
Extension Chrome  <-- Native Messaging -->  Python script  -->  ~/.claude/              (Claude Code)
                                                            -->  ~/.gemini/              (Gemini CLI)
                                                            -->  ~/.local/share/opencode/ (OpenCode)
```

| Herramienta | Fuente de datos |
|-------------|----------------|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Gemini CLI  | `~/.gemini/tmp/**/chats/*.jsonl` |
| OpenCode / z.ai | `~/.local/share/opencode/opencode.db` |

## Requisitos

- Chrome u otro navegador basado en Chromium
- Python 3 (preinstalado en macOS y Linux)
- Al menos una de las herramientas soportadas con sesiones registradas

## Instalación

### 1. Cargar la extensión en Chrome

```bash
git clone https://github.com/mmasias/claudeTokens.git
```

1. Abre `chrome://extensions`
2. Activa **Modo desarrollador** (toggle en la esquina superior derecha)
3. Haz clic en **Cargar extensión descomprimida** y selecciona la carpeta del repositorio
4. Copia el **ID de la extensión** (cadena de ~32 caracteres visible bajo el nombre)

### 2. Instalar el host nativo

El host nativo es un script Python que actúa de puente entre Chrome y los archivos locales. Se instala una vez por máquina.

```bash
cd claudeTokens/native_host
chmod +x install.sh
./install.sh TU_EXTENSION_ID
```

El script copia `claude_token_bridge.py` a `~/.local/share/claude-tokens/` y registra el manifiesto de native messaging en Chrome y Chromium.

### 3. Verificar la conexión

Recarga la extensión en `chrome://extensions`, abre la configuración (⚙) y pulsa **Verificar conexión**. Debería mostrar cuántos tokens tiene en los últimos 7 días.

## Configuración

| Parámetro | Descripción |
|-----------|-------------|
| Límite semanal | Opcional. Tokens como techo de referencia para el porcentaje. Sin él se muestran valores absolutos. |
| Frecuencia de actualización | Cada 15, 30 o 60 minutos (por defecto 60). |

El límite no lo expone ningún API — cada usuario lo calibra según su plan y sus patrones de uso habituales.

## Uso en otros equipos

```bash
git clone https://github.com/mmasias/claudeTokens.git
cd claudeTokens/native_host
./install.sh TU_EXTENSION_ID_EN_ESTE_EQUIPO
```

Cada máquina tiene su propio ID de extensión y sus propios datos locales. Los datos no se sincronizan entre equipos — cada instalación mide el uso de esa máquina.

## Lógica del reset

La ventana de uso no tiene un reset fijo: son siempre los últimos 7 días. El contador muestra cuánto falta para que el día más antiguo con consumo salga de esa ventana. Cuando tiene el timestamp exacto del primer mensaje de ese día, el cálculo es preciso; si no, aproxima con medianoche UTC (±24h).

## Privacidad

- No hay API keys ni credenciales de ningún tipo
- La extensión no hace peticiones a internet
- Los datos de sesión nunca salen de tu máquina

## Licencia

MIT
