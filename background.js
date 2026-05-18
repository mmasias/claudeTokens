const HOST_NAME = 'com.claudetokens.bridge';
const FETCH_INTERVAL_MINUTES = 60;

function fetchFromNativeHost() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(HOST_NAME, { type: 'GET_USAGE' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Respuesta inválida del host nativo'));
        return;
      }
      resolve(response.data);
    });
  });
}

async function fetchWeeklyUsage() {
  try {
    const weeklyData = await fetchFromNativeHost();
    await chrome.storage.local.set({
      weeklyData,
      lastFetch: new Date().toISOString(),
      lastError: null,
    });
    updateBadge(weeklyData);
    return weeklyData;
  } catch (e) {
    await chrome.storage.local.set({ lastError: e.message });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    throw e;
  }
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
  chrome.action.setBadgeText({ text: pct > 99 ? '!!' : `${pct}%` });
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
    fetchWeeklyUsage()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
