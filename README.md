# Claude Tokens

Extensión de Chrome para monitorear el uso semanal de tokens en **Claude Code**.

Muestra cuántos tokens has consumido en los últimos 7 días, el desglose diario y cuánto tiempo falta para que los tokens más antiguos salgan de la ventana de conteo.

<div align=center>

<img width="514" height="665" alt="image" src="https://github.com/user-attachments/assets/5e889949-a7c6-41b4-b458-06d4ee016afc" />

</div>

---

## Qué muestra

- **Tokens totales** de la semana actual (ventana rodante de 7 días)
- **Barra de progreso** contra el límite que configures
- **Gráfico de barras** con el consumo de cada uno de los últimos 7 días
- **Costo estimado** en USD (calculado con las tarifas de cada modelo)
- **Contador regresivo** hasta que los tokens del día más antiguo se liberen
- **Badge** en el icono con el porcentaje actual (si tienes límite configurado)

## Cómo funciona

Lee directamente los archivos de sesión de Claude Code en `~/.claude/projects/`. Cada sesión guarda los conteos de tokens (input, output, cache) por mensaje. La extensión agrega esos datos por día para los últimos 7 días.

No necesita API key ni cuenta de Anthropic. Los datos son locales y no salen de tu máquina.

```
Extension Chrome  <-- Native Messaging -->  Python script  -->  ~/.claude/projects/
```

## Requisitos

- Chrome u otro navegador basado en Chromium
- Python 3 (ya viene en macOS y Linux)
- Claude Code instalado y con al menos una sesión registrada

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

El host nativo es un script Python que actúa de puente entre Chrome y los archivos locales de Claude Code. Se instala una vez por máquina.

```bash
cd claudeTokens/native_host
chmod +x install.sh
./install.sh TU_EXTENSION_ID
```

El script copia `claude_token_bridge.py` a `~/.local/share/claude-tokens/` y registra el manifiesto de native messaging en Chrome y Chromium.

### 3. Verificar la conexión

Recarga la extensión en `chrome://extensions`, abre la configuración (⚙) y pulsa **Verificar conexión**. Debería indicar cuántos tokens tiene en los últimos 7 días.

## Configuración

| Parámetro | Descripción |
|-----------|-------------|
| Límite semanal | Opcional. Número de tokens como techo de referencia. Sin él se muestran valores absolutos sin porcentaje. |

El límite no lo expone ningún API de Anthropic — cada usuario lo calibra según su plan y sus patrones de uso.

## Uso en otros equipos

```bash
git clone https://github.com/mmasias/claudeTokens.git
cd claudeTokens/native_host
./install.sh TU_EXTENSION_ID_EN_ESTE_EQUIPO
```

Cada máquina tiene su propio ID de extensión y sus propios datos locales en `~/.claude/`. Los datos no se sincronizan entre equipos — cada instalación mide el uso de esa máquina.

## Lógica del reset

La ventana de uso no tiene un reset fijo. Es siempre los últimos 7 días. El contador muestra cuánto tiempo falta para que el día más antiguo con consumo salga de esa ventana — ese es el momento en que se liberan esos tokens del cómputo.

## Privacidad

- No hay API keys ni credenciales de ningún tipo
- La extensión no hace peticiones a internet
- Los datos de sesión de Claude Code nunca salen de tu máquina

## Licencia

MIT
