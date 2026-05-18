const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatCost(cents) {
  if (cents === 0) return '$0.00';
  const usd = cents / 100;
  return '$' + usd.toFixed(2);
}

function formatCountdown(ms) {
  if (ms <= 0) return '< 1h';
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function showState(name) {
  ['state-no-key', 'state-error', 'state-loading', 'state-data'].forEach(hide);
  show(name);
}

function renderData(weeklyData, weeklyLimit) {
  const dates = Array.from({ length: 7 }, (_, i) => getDateString(i)).reverse();
  const today = getDateString(0);

  // Totals
  let totalTokens = 0, totalCost = 0, totalSessions = 0;
  for (const d of dates) {
    const day = weeklyData[d];
    if (!day) continue;
    totalTokens += day.tokens?.total ?? 0;
    totalCost += day.cost_cents ?? 0;
    totalSessions += day.sessions ?? 0;
  }

  // Week range
  document.getElementById('week-range').textContent =
    `${dates[0].slice(5)} – ${dates[6].slice(5)}`;

  document.getElementById('total-tokens').textContent = formatTokens(totalTokens);
  document.getElementById('total-cost').textContent = formatCost(totalCost);
  document.getElementById('total-sessions').textContent = totalSessions;

  // Progress bar
  if (weeklyLimit && weeklyLimit > 0) {
    show('limit-block');
    const pct = Math.min(100, (totalTokens / weeklyLimit) * 100);
    const fill = document.getElementById('progress-fill');
    fill.style.width = pct.toFixed(1) + '%';
    fill.className = 'progress-bar-fill';
    if (pct > 80) fill.classList.add('danger');
    else if (pct > 50) fill.classList.add('warn');
    document.getElementById('progress-pct').textContent = pct.toFixed(0) + '%';
    document.getElementById('tokens-used-display').textContent = formatTokens(totalTokens) + ' usados';
    document.getElementById('tokens-limit-display').textContent = 'límite: ' + formatTokens(weeklyLimit);
  } else {
    hide('limit-block');
  }

  // Bar chart
  const dailyTokens = dates.map((d) => weeklyData[d]?.tokens?.total ?? 0);
  const maxDay = Math.max(...dailyTokens, 1);

  const chart = document.getElementById('bar-chart');
  const labels = document.getElementById('bar-labels');
  chart.innerHTML = '';
  labels.innerHTML = '';

  dates.forEach((date, i) => {
    const val = dailyTokens[i];
    const pctH = Math.max(2, (val / maxDay) * 100);
    const isToday = date === today;
    const dow = DAY_NAMES[new Date(date + 'T12:00:00').getDay()];

    const bar = document.createElement('div');
    bar.className = 'bar' + (isToday ? ' today' : '') + (val === 0 ? ' zero' : '');
    bar.style.height = pctH + '%';
    bar.title = `${date}\n${formatTokens(val)} tokens`;
    chart.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.className = 'bar-label' + (isToday ? ' today' : '');
    lbl.textContent = isToday ? 'Hoy' : dow;
    labels.appendChild(lbl);
  });

  // Reset countdown — tokens del día más antiguo con uso se liberarán a las
  // [fecha_más_antigua + 7 días] a las 00:00 UTC
  const oldestDateWithUsage = dates.find((d) => (weeklyData[d]?.tokens?.total ?? 0) > 0);
  if (oldestDateWithUsage) {
    const releaseDate = new Date(oldestDateWithUsage + 'T00:00:00Z');
    releaseDate.setUTCDate(releaseDate.getUTCDate() + 7);
    const msUntilRelease = releaseDate.getTime() - Date.now();
    document.getElementById('reset-countdown').textContent = formatCountdown(msUntilRelease);
    document.getElementById('reset-detail').textContent =
      `Día más antiguo: ${oldestDateWithUsage} · libera ${formatTokens(weeklyData[oldestDateWithUsage]?.tokens?.total ?? 0)} tokens`;
  } else {
    document.getElementById('reset-countdown').textContent = '—';
    document.getElementById('reset-detail').textContent = 'Sin datos en los últimos 7 días';
  }
}

async function init() {
  const { weeklyData, weeklyLimit, lastFetch, lastError } =
    await chrome.storage.local.get(['weeklyData', 'weeklyLimit', 'lastFetch', 'lastError']);

  if (lastError && !weeklyData) {
    document.getElementById('error-msg').textContent = lastError;
    showState('state-error');
    return;
  }

  if (!weeklyData && !lastError) {
    showState('state-no-key');
    return;
  }

  if (!weeklyData) {
    showState('state-loading');
    return;
  }

  showState('state-data');
  renderData(weeklyData, weeklyLimit);

  if (lastFetch) {
    const elapsed = Math.round((Date.now() - new Date(lastFetch).getTime()) / 60000);
    document.getElementById('last-fetch-label').textContent =
      `Actualizado hace ${elapsed < 1 ? '< 1' : elapsed} min`;
  }

  if (lastError) {
    // Datos en caché pero hubo error en el último fetch
    const footer = document.querySelector('.footer');
    const warn = document.createElement('span');
    warn.style.color = '#f87171';
    warn.style.display = 'block';
    warn.textContent = 'Último fetch con error: ' + lastError;
    footer.prepend(warn);
  }
}

document.getElementById('btn-refresh').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: 'REFRESH' }, async () => {
    btn.classList.remove('spinning');
    btn.disabled = false;
    await init();
  });
});

init();
