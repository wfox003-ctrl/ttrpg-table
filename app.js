const API_URL = 'https://script.google.com/macros/s/AKfycbzwFBACQdvp_jgYs1ZDlrmf3NkOlTZrXx35zK7fbGPPWi0TOAFYLFWkq581DMg-nV1W/exec';
const ROOM_KEY = 'kousuke-table-2026';
const logElement = document.querySelector('#log');
const template = document.querySelector('#log-entry-template');
const nameInput = document.querySelector('#player-name');
const diceInput = document.querySelector('#dice-command');
const diceResult = document.querySelector('#dice-result');

let entries = [];

function now() {
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function api(action, values = {}) {
  return new Promise((resolve, reject) => {
    const callback = `ttrpgCallback${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const params = new URLSearchParams({ action, key: ROOM_KEY, callback, ...values });
    const script = document.createElement('script');
    const cleanup = () => { delete window[callback]; script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('共有ログへの接続がタイムアウトしました。')); }, 10000);
    window[callback] = (data) => { clearTimeout(timer); cleanup(); data.ok ? resolve(data) : reject(new Error(data.error)); };
    script.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error('共有ログに接続できません。')); };
    script.src = `${API_URL}?${params}`;
    document.head.append(script);
  });
}

function render() {
  logElement.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.textContent = 'まだログはありません。最初の発言、またはダイスをどうぞ。';
    empty.style.color = '#85808c';
    logElement.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const node = template.content.cloneNode(true);
    node.querySelector('strong').textContent = entry.name;
    node.querySelector('time').textContent = entry.time;
    node.querySelector('p').textContent = entry.message;
    logElement.append(node);
  });
  logElement.scrollTop = logElement.scrollHeight;
}

async function addEntry(name, message) {
  await api('write', { name, message });
  await loadEntries();
}

async function loadEntries() {
  try {
    const data = await api('read');
    entries = data.logs;
    render();
  } catch (error) {
    logElement.replaceChildren();
    const notice = document.createElement('p');
    notice.textContent = error.message;
    notice.style.color = '#e7bc70';
    logElement.append(notice);
  }
}

function roll(command) {
  const cleaned = command.trim().replace(/\s/g, '');
  const match = cleaned.match(/^(\d{1,2})d(\d{1,4})([+-]\d{1,5})?$/i);
  if (!match) throw new Error('「2d6+3」のように入力してください。');
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (count < 1 || sides < 2 || count > 100 || sides > 1000) throw new Error('ダイスは1〜100個、面数は2〜1000で指定してください。');
  const values = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const total = values.reduce((sum, value) => sum + value, modifier);
  return { cleaned, values, modifier, total };
}

document.querySelector('#dice-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const result = roll(diceInput.value);
    const modifierText = result.modifier ? ` ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)}` : '';
    const detail = `[${result.values.join(', ')}]${modifierText}`;
    const message = `${result.cleaned.toUpperCase()} → ${result.total}（${detail}）`;
    diceResult.textContent = message;
    await addEntry(nameInput.value.trim() || 'プレイヤー', `[DICE] ${message}`);
  } catch (error) { diceResult.textContent = error.message; }
});

document.querySelectorAll('[data-dice]').forEach((button) => button.addEventListener('click', () => {
  diceInput.value = button.dataset.dice;
  document.querySelector('#dice-form').requestSubmit();
}));

document.querySelector('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const field = document.querySelector('#chat-message');
  const message = field.value.trim();
  if (!message) return;
  try {
    await addEntry(nameInput.value.trim() || 'プレイヤー', message);
    field.value = '';
    field.focus();
  } catch (error) { window.alert(error.message); }
});

document.querySelector('#clear-log').addEventListener('click', () => {
  window.alert('共有ログは消去できない設定です。必要ならGoogleスプレッドシートから管理者が削除します。');
});

loadEntries();
setInterval(loadEntries, 5000);
