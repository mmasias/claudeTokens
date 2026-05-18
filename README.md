# Claude Tokens

Extensión de Chrome para monitorear el uso semanal de tokens en **Claude Code**.

Muestra cuántos tokens has consumido en los últimos 7 días, el desglose diario y cuánto tiempo falta para que los tokens más antiguos salgan de la ventana de conteo.

---

## Qué muestra

- **Tokens totales** de la semana actual (ventana rodante de 7 días)
- **Barra de progreso** contra el límite que configures
- **Gráfico de barras** con el consumo de cada uno de los últimos 7 días
- **Costo estimado** en USD
- **Contador regresivo** hasta que los tokens del día más antiguo se liberen
- **Badge** en el icono con el porcentaje actual (si tienes límite configurado)

## Requisitos

- Chrome (u otro navegador basado en Chromium)
- Cuenta de Anthropic con una **organización** creada en el Console
- **Admin API key** (`sk-ant-admin...`), generada en [console.anthropic.com/settings/admin-keys](https://console.anthropic.com/settings/admin-keys)

> Las cuentas personales sin organización no tienen acceso al Admin API. Puedes crear una organización en Console → Settings → Organization y agregarte como admin.

## Instalación

1. Clona o descarga este repositorio:
   ```bash
   git clone https://github.com/mmasias/claudeTokens.git
   ```

2. Abre Chrome y ve a `chrome://extensions`

3. Activa **Modo desarrollador** (toggle en la esquina superior derecha)

4. Haz clic en **Cargar extensión descomprimida** y selecciona la carpeta del repositorio

5. Haz clic en el icono de la extensión → **⚙** → ingresa tu Admin API key → **Verificar y guardar**

La extensión verifica la key contra la API y, si es válida, inicia el primer fetch automáticamente.

## Configuración

| Parámetro | Descripción |
|-----------|-------------|
| Admin API key | Obligatorio. Debe empezar con `sk-ant-admin...` |
| Límite semanal | Opcional. Número de tokens que usas como techo de referencia. Si no lo configuras, se muestran valores absolutos sin porcentaje. |

El límite no lo expone el API de Anthropic — cada usuario lo calibra según su plan y sus patrones de uso.

## Uso en otros equipos

La extensión no sincroniza entre dispositivos (no está en el Web Store). Para usarla en otro equipo:

1. Clona el repo
2. Carga la extensión en modo desarrollador (mismo proceso de instalación)
3. Configura la Admin API key en ese equipo

## Cómo funciona

Usa el [Claude Code Analytics Admin API](https://docs.anthropic.com/en/api/admin-api/claude-code/get-claude-code-usage-report) de Anthropic para obtener el uso diario agregado. Hace una llamada por cada uno de los últimos 7 días, agrega los tokens por modelo y los almacena localmente con `chrome.storage.local`. Los datos se actualizan automáticamente cada hora.

La "ventana de reset" no es un día fijo — es una ventana rodante. El contador muestra cuánto tiempo falta para que el día más antiguo con consumo salga de la ventana de 7 días.

## Privacidad

- La Admin API key se almacena únicamente en `chrome.storage.local` (local, no sincronizado con la nube de Chrome)
- La extensión solo hace peticiones a `api.anthropic.com`
- No hay telemetría ni datos enviados a terceros

## Licencia

MIT
