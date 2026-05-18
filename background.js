const API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const FETCH_INTERVAL_MINUTES = 60;

function getDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => getDateString(i));
}

async function fetchDayUsage(adminApiKey, date) {
  const url = `${API_BASE}/v1/organizations/usage_report/claude_code?starting_at=${date}&limit=1000`;
  const resp = await fetch(url, {
    headers: {
      'X-Api-Key': adminApiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
  });

  if (resp.status === 401) throw new Error('API key inválida o sin permisos de admin');
  if (resp.status === 403) throw new Error('Acceso denegado. Necesitas una Admin API key (sk-ant-admin...)');
  if (!resp.ok) throw new Error(`Error ${resp.status}: ${resp.statusText}`);

  let result = await resp.json();
  let allRecords = [...result.data];

  while (result.has_more) {
    const nextUrl = `${url}&page=${result.next_page}`;
    const nextResp = await fetch(nextUrl, {
      headers: {
        'X-Api-Key': adminApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    });
    result = await nextResp.json();
    allRecords = [...allRecords, ...result.data];
  }

  return allRecords;
}

function aggregateDay(records) {
  const totals = {
    tokens: { input: 0, output: 0, cache_read: 0, cache_creation: 0, total: 0 },
    cost_cents: 0,
    sessions: 0,
  };

  for (const record of records) {
    totals.sessions += record.core_metrics?.num_sessions ?? 0;
    for (const m of record.model_breakdown ?? []) {
      totals.tokens.input += m.tokens.input;
      totals.tokens.output += m.tokens.output;
      totals.tokens.cache_read += m.tokens.cache_read;
      totals.tokens.cache_creation += m.tokens.cache_creation;
      totals.tokens.total += m.tokens.input + m.tokens.output;
      totals.cost_cents += m.estimated_cost?.amount ?? 0;
    }
  }

  return totals;
}

async function fetchWeeklyUsage() {
  const { adminApiKey } = await chrome.storage.local.get('adminApiKey');
  if (!adminApiKey) return;

  const dates = getLast7Days();
  const weeklyData = {};
  let lastError = null;

  for (const date of dates) {
    try {
      const records = await fetchDayUsage(adminApiKey, date);
      weeklyData[date] = aggregateDay(records);
    } catch (e) {
      lastError = e.message;
      weeklyData[date] = {
        tokens: { input: 0, output: 0, cache_read: 0, cache_creation: 0, total: 0 },
        cost_cents: 0,
        sessions: 0,
        error: e.message,
      };
      // Si el error es de auth, no tiene sentido seguir con el resto de días
      if (e.message.includes('inválida') || e.message.includes('Acceso denegado')) break;
    }
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({
    weeklyData,
    lastFetch: now,
    lastError: lastError ?? null,
  });

  updateBadge(weeklyData);
  return weeklyData;
}

async function updateBadge(weeklyData) {
  const { weeklyLimit } = await chrome.storage.local.get('weeklyLimit');
  if (!weeklyLimit) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  const totalTokens = Object.values(weeklyData).reduce(
    (sum, d) => sum + (d.tokens?.total ?? 0),
    0
  );
  const pct = Math.round((totalTokens / weeklyLimit) * 100);
  const text = pct > 99 ? '!!' : `${pct}%`;

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981',
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchUsage') fetchWeeklyUsage();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('fetchUsage', { periodInMinutes: FETCH_INTERVAL_MINUTES });
  fetchWeeklyUsage();
});

chrome.runtime.onStartup.addListener(() => {
  fetchWeeklyUsage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REFRESH') {
    fetchWeeklyUsage().then((data) => sendResponse({ ok: true, data })).catch((e) =>
      sendResponse({ ok: false, error: e.message })
    );
    return true;
  }
});
