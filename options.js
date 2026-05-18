function formatTokens(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function showToast() {
  const t = document.getElementById('save-toast');
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function setStatus(msg, type) {
  const el = document.getElementById('key-status');
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
}

async function verifyKey(key) {
  const today = new Date().toISOString().split('T')[0];
  const resp = await fetch(
    `https://api.anthropic.com/v1/organizations/usage_report/claude_code?starting_at=${today}&limit=1`,
    {
      headers: {
        'X-Api-Key': key,
        'anthropic-version': '2023-06-01',
      },
    }
  );

  if (resp.status === 401) throw new Error('API key inválida o sin autenticación.');
  if (resp.status === 403) throw new Error('Acceso denegado. Asegúrate de que es una Admin API key (sk-ant-admin...).');
  if (!resp.ok) throw new Error(`Error ${resp.status}: ${resp.statusText}`);
}

async function loadCacheInfo() {
  const { weeklyData, lastFetch, adminApiKey } = await chrome.storage.local.get([
    'weeklyData',
    'lastFetch',
    'adminApiKey',
  ]);

  const el = document.getElementById('cache-info');
  if (!adminApiKey) {
    el.innerHTML = 'Sin API key configurada.';
    return;
  }

  let html = '';
  if (lastFetch) {
    const d = new Date(lastFetch);
    html += `<strong>Última actualización:</strong> ${d.toLocaleString('es-ES')}<br>`;
  } else {
    html += '<strong>Última actualización:</strong> Nunca<br>';
  }

  if (weeklyData) {
    const days = Object.keys(weeklyData).length;
    const total = Object.values(weeklyData).reduce(
      (s, d) => s + (d.tokens?.total ?? 0), 0
    );
    html += `<strong>Días en caché:</strong> ${days}<br>`;
    html += `<strong>Total tokens en ventana:</strong> ${formatTokens(total)}`;
  } else {
    html += 'Sin datos en caché.';
  }

  el.innerHTML = html;
}

async function init() {
  const { adminApiKey, weeklyLimit } = await chrome.storage.local.get(['adminApiKey', 'weeklyLimit']);

  if (adminApiKey) {
    document.getElementById('api-key').value = adminApiKey;
  }

  if (weeklyLimit) {
    document.getElementById('weekly-limit').value = weeklyLimit;
    document.getElementById('limit-display').textContent = formatTokens(weeklyLimit) + ' tokens/semana';
  }

  loadCacheInfo();
}

document.getElementById('toggle-visibility').addEventListener('click', () => {
  const input = document.getElementById('api-key');
  const btn = document.getElementById('toggle-visibility');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Ocultar';
  } else {
    input.type = 'password';
    btn.textContent = 'Mostrar';
  }
});

document.getElementById('btn-verify').addEventListener('click', async () => {
  const key = document.getElementById('api-key').value.trim();
  if (!key) {
    setStatus('Ingresa una API key.', 'error');
    return;
  }

  const btn = document.getElementById('btn-verify');
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  document.getElementById('key-status').classList.add('hidden');

  try {
    await verifyKey(key);
    await chrome.storage.local.set({ adminApiKey: key });
    setStatus('API key válida. Guardada correctamente.', 'success');
    showToast();
    // Disparar fetch en background
    chrome.runtime.sendMessage({ type: 'REFRESH' });
    loadCacheInfo();
  } catch (e) {
    setStatus(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar y guardar';
  }
});

document.getElementById('weekly-limit').addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  const hint = document.getElementById('limit-display');
  hint.textContent = val > 0 ? formatTokens(val) + ' tokens/semana' : '';
});

document.getElementById('btn-save-limit').addEventListener('click', async () => {
  const val = parseInt(document.getElementById('weekly-limit').value, 10);
  if (!val || val < 1000) {
    alert('Ingresa un límite válido (mínimo 1000 tokens).');
    return;
  }
  await chrome.storage.local.set({ weeklyLimit: val });
  showToast();
});

document.getElementById('btn-clear-limit').addEventListener('click', async () => {
  await chrome.storage.local.remove('weeklyLimit');
  document.getElementById('weekly-limit').value = '';
  document.getElementById('limit-display').textContent = '';
  showToast();
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
  if (!confirm('¿Borrar todos los datos en caché? La API key y el límite configurado se conservarán.')) return;
  const { adminApiKey, weeklyLimit } = await chrome.storage.local.get(['adminApiKey', 'weeklyLimit']);
  await chrome.storage.local.clear();
  if (adminApiKey) await chrome.storage.local.set({ adminApiKey });
  if (weeklyLimit) await chrome.storage.local.set({ weeklyLimit });
  await loadCacheInfo();
  showToast();
});

init();
