const HOST_NAME = 'com.claudetokens.bridge';

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

function setHostStatus(msg, type) {
  const el = document.getElementById('host-status');
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
}

async function loadCacheInfo() {
  const { weeklyData, lastFetch } = await chrome.storage.local.get(['weeklyData', 'lastFetch']);
  const el = document.getElementById('cache-info');

  let html = '';
  if (lastFetch) {
    html += `<strong>Última actualización:</strong> ${new Date(lastFetch).toLocaleString('es-ES')}<br>`;
  } else {
    html += '<strong>Última actualización:</strong> Nunca<br>';
  }

  if (weeklyData) {
    const total = Object.values(weeklyData).reduce((s, d) => s + (d.tokens?.total ?? 0), 0);
    html += `<strong>Días en caché:</strong> ${Object.keys(weeklyData).length}<br>`;
    html += `<strong>Total tokens en ventana:</strong> ${formatTokens(total)}`;
  } else {
    html += 'Sin datos en caché.';
  }

  el.innerHTML = html;
}

async function init() {
  const { weeklyLimit } = await chrome.storage.local.get('weeklyLimit');
  if (weeklyLimit) {
    document.getElementById('weekly-limit').value = weeklyLimit;
    document.getElementById('limit-display').textContent = formatTokens(weeklyLimit) + ' tokens/semana';
  }
  loadCacheInfo();
}

document.getElementById('btn-test-host').addEventListener('click', () => {
  const btn = document.getElementById('btn-test-host');
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'GET_USAGE' }, (response) => {
    btn.disabled = false;
    btn.textContent = 'Verificar conexión';

    if (chrome.runtime.lastError) {
      setHostStatus(
        'No se pudo conectar con el host nativo. ¿Ejecutaste install.sh con el ID correcto? Error: ' +
          chrome.runtime.lastError.message,
        'error'
      );
      return;
    }

    if (!response?.ok) {
      setHostStatus('El host respondió con error: ' + (response?.error ?? 'desconocido'), 'error');
      return;
    }

    const total = Object.values(response.data).reduce((s, d) => s + (d.tokens?.total ?? 0), 0);
    setHostStatus(
      `Conexión OK. ${formatTokens(total)} tokens encontrados en los últimos 7 días.`,
      'success'
    );
    chrome.storage.local.set({ weeklyData: response.data, lastFetch: new Date().toISOString(), lastError: null });
    loadCacheInfo();
  });
});

document.getElementById('weekly-limit').addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  document.getElementById('limit-display').textContent = val > 0 ? formatTokens(val) + ' tokens/semana' : '';
});

document.getElementById('btn-save-limit').addEventListener('click', async () => {
  const val = parseInt(document.getElementById('weekly-limit').value, 10);
  if (!val || val < 1000) { alert('Ingresa un límite válido (mínimo 1000 tokens).'); return; }
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
  if (!confirm('¿Borrar datos en caché? El límite configurado se conservará.')) return;
  const { weeklyLimit } = await chrome.storage.local.get('weeklyLimit');
  await chrome.storage.local.clear();
  if (weeklyLimit) await chrome.storage.local.set({ weeklyLimit });
  loadCacheInfo();
  showToast();
});

init();
