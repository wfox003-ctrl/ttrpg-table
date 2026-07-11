const API_URL = 'https://script.google.com/macros/s/AKfycbzwFBACQdvp_jgYs1ZDlrmf3NkOlTZrXx35zK7fbGPPWi0TOAFYLFWkq581DMg-nV1W/exec';
const ROOM_KEY = 'kousuke-table-2026';
const logElement = document.querySelector('#log');
const template = document.querySelector('#log-entry-template');
const nameInput = document.querySelector('#player-name');
const diceInput = document.querySelector('#dice-command');
const diceResult = document.querySelector('#dice-result');

let entries = [];
let roomState = { sceneText: '', sceneImageId: '', combat: { active: false, round: 1, enemies: [] }, players: Array.from({ length: 4 }, () => ({ name: '', portraitImageId: '', hp: 10, maxHp: 10, mp: 0, sp: 0, equipment: '', items: '', condition: '', personality: '' })) };
const imageUrls = new Map();
let isLoading = false;
let isSavingState = false;
let isRolling = false;
let isSendingChat = false;
let stateDirty = false;

function setSyncStatus(message, syncing = false) {
  document.querySelector('#sync-status').textContent = message;
  document.querySelector('#hourglass').classList.toggle('syncing', syncing);
}

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

function renderState() {
  document.querySelector('#scene-text').value = roomState.sceneText || '';
  showImage(document.querySelector('#scene-image'), roomState.sceneImageId);
  renderCombat(roomState.combat);
  const container = document.querySelector('#players');
  container.replaceChildren();
  roomState.players.forEach((player, index) => {
    const node = document.querySelector('#player-template').content.cloneNode(true);
    const card = node.querySelector('.player-card');
    card.dataset.index = index;
    showImage(card.querySelector('.portrait'), player.portraitImageId);
    card.querySelector('.character-name').value = player.name || '';
    card.querySelector('.hp').value = player.hp ?? 10;
    card.querySelector('.max-hp').value = player.maxHp ?? 10;
    card.querySelector('.mp').value = player.mp ?? 0;
    card.querySelector('.sp').value = player.sp ?? 0;
    card.querySelector('.equipment').value = player.equipment || '';
    card.querySelector('.items').value = player.items || '';
    card.querySelector('.condition').value = player.condition || '';
    card.querySelector('.personality').value = player.personality || '';
    card.querySelector('.hp-value').textContent = `${player.hp ?? 10} / ${player.maxHp ?? 10}`;
    container.append(node);
  });
  renderPlayerSelector();
}

function renderCombat(combat) {
  const board = document.querySelector('#combat-board');
  const safeCombat = combat || { active: false, round: 1, enemies: [] };
  const enemies = Array.isArray(safeCombat.enemies) ? safeCombat.enemies : [];
  board.hidden = !safeCombat.active;
  if (!safeCombat.active) return;
  document.querySelector('#combat-round').textContent = `第${Math.max(1, Number(safeCombat.round) || 1)}ラウンド`;
  const list = document.querySelector('#enemy-list');
  list.replaceChildren();
  enemies.forEach((enemy) => {
    const card = document.createElement('article'); card.className = 'enemy-card';
    const name = document.createElement('h3'); name.textContent = enemy.name || '未設定の敵'; card.append(name);
    const hp = Math.max(0, Number(enemy.hp) || 0); const maxHp = Math.max(1, Number(enemy.maxHp) || 1);
    const hpText = document.createElement('p'); hpText.textContent = `HP ${hp} / ${maxHp}`; card.append(hpText);
    const bar = document.createElement('div'); bar.className = 'enemy-hp'; const fill = document.createElement('span'); fill.style.width = `${Math.min(100, hp / maxHp * 100)}%`; bar.append(fill); card.append(bar);
    const condition = document.createElement('p'); condition.textContent = `状態：${enemy.condition || '正常'}`; card.append(condition);
    if (enemy.note) { const note = document.createElement('p'); note.textContent = `特徴：${enemy.note}`; card.append(note); }
    list.append(card);
  });
}

function renderPlayerSelector() {
  const selected = nameInput.value;
  nameInput.replaceChildren();
  const gm = new Option('GM', 'GM');
  nameInput.add(gm);
  roomState.players.forEach((player, index) => {
    if (player.name) nameInput.add(new Option(player.name, player.name));
    else nameInput.add(new Option(`プレイヤー ${index + 1}（未設定）`, `プレイヤー ${index + 1}`));
  });
  nameInput.value = [...nameInput.options].some((option) => option.value === selected) ? selected : 'GM';
}

function readStateFromScreen() {
  return {
    sceneText: document.querySelector('#scene-text').value.trim(),
    sceneImageId: roomState.sceneImageId || '', combat: roomState.combat || { active: false, round: 1, enemies: [] },
    players: [...document.querySelectorAll('.player-card')].map((card) => ({
      name: card.querySelector('.character-name').value.trim(), portraitImageId: roomState.players[Number(card.dataset.index)]?.portraitImageId || '', hp: Number(card.querySelector('.hp').value) || 0,
      maxHp: Number(card.querySelector('.max-hp').value) || 1, mp: Number(card.querySelector('.mp').value) || 0,
      sp: Number(card.querySelector('.sp').value) || 0, equipment: card.querySelector('.equipment').value.trim(),
      items: card.querySelector('.items').value.trim(), condition: card.querySelector('.condition').value.trim(), personality: card.querySelector('.personality').value.trim(),
    })),
  };
}

async function getImageUrl(imageId) {
  if (!imageId) return '';
  if (imageUrls.has(imageId)) return imageUrls.get(imageId);
  const cached = sessionStorage.getItem(`trpg-image-${imageId}`);
  if (cached) { imageUrls.set(imageId, cached); return cached; }
  const data = await api('image', { id: imageId });
  const url = `data:${data.mimeType};base64,${data.base64}`;
  imageUrls.set(imageId, url);
  try { sessionStorage.setItem(`trpg-image-${imageId}`, url); } catch (error) {}
  return url;
}

function showImage(container, imageId) {
  if (!container) return;
  const img = container.querySelector('img');
  if (!imageId) { container.hidden = true; img.removeAttribute('src'); return; }
  container.hidden = false;
  if (img.dataset.imageId === imageId && img.src) return;
  img.dataset.imageId = imageId;
  getImageUrl(imageId).then((url) => {
    if (img.dataset.imageId === imageId) img.src = url;
  }).catch(() => { if (img.dataset.imageId === imageId) container.hidden = true; });
}

function isEditingState() {
  const active = document.activeElement;
  return active === document.querySelector('#scene-text') || active === document.querySelector('#scene-image-url') || Boolean(active?.closest?.('.player-card'));
}

function hasUsableState(state) {
  return Array.isArray(state?.players) && state.players.length === 4;
}

async function saveState() {
  if (isSavingState) return;
  isSavingState = true;
  document.querySelectorAll('#save-scene, #save-status').forEach((button) => { button.disabled = true; });
  setSyncStatus('保存中...', true);
  roomState = readStateFromScreen();
  try {
    await api('state', { state: JSON.stringify(roomState) });
    stateDirty = false;
    renderState();
    setSyncStatus('保存しました');
  }
  finally { isSavingState = false; document.querySelectorAll('#save-scene, #save-status').forEach((button) => { button.disabled = false; }); }
}

async function addEntry(name, message) {
  await api('write', { name, message });
  await loadEntries();
}

async function loadEntries() {
  if (isLoading) return;
  isLoading = true;
  setSyncStatus('同期中...', true);
  try {
    const data = await api('read');
    entries = data.logs;
    if (hasUsableState(data.state) && !stateDirty) {
      roomState = data.state;
      renderState();
    }
    setSyncStatus('同期済み・5秒ごとに更新');
    render();
  } catch (error) {
    logElement.replaceChildren();
    const notice = document.createElement('p');
    notice.textContent = error.message;
    notice.style.color = '#e7bc70';
    logElement.append(notice);
    setSyncStatus('同期できません');
  } finally {
    isLoading = false;
    document.querySelector('#hourglass').classList.remove('syncing');
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
  if (isRolling) return;
  isRolling = true;
  const diceButtons = document.querySelectorAll('#dice-form button, .quick-dice button');
  diceButtons.forEach((button) => { button.disabled = true; });
  try {
    const result = roll(diceInput.value);
    const modifierText = result.modifier ? ` ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)}` : '';
    const detail = `[${result.values.join(', ')}]${modifierText}`;
    const message = `${result.cleaned.toUpperCase()} → ${result.total}（${detail}）`;
    diceResult.textContent = message;
    await addEntry(nameInput.value.trim() || 'プレイヤー', `[DICE] ${message}`);
  } catch (error) { diceResult.textContent = error.message; }
  finally {
    isRolling = false;
    diceButtons.forEach((button) => { button.disabled = false; });
  }
});

document.querySelectorAll('[data-dice]').forEach((button) => button.addEventListener('click', () => {
  diceInput.value = button.dataset.dice;
  document.querySelector('#dice-form').requestSubmit();
}));

document.querySelector('#chat-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSendingChat) return;
  const field = document.querySelector('#chat-message');
  const message = field.value.trim();
  if (!message) return;
  isSendingChat = true;
  const sendButton = document.querySelector('#chat-form button');
  sendButton.disabled = true;
  try {
    await addEntry(nameInput.value.trim() || 'プレイヤー', message);
    field.value = '';
    field.focus();
  } catch (error) { window.alert(error.message); }
  finally { isSendingChat = false; sendButton.disabled = false; }
});

document.querySelector('#clear-log').addEventListener('click', () => {
  window.alert('共有ログは消去できない設定です。必要ならGoogleスプレッドシートから管理者が削除します。');
});

document.querySelector('#save-scene').addEventListener('click', () => saveState().catch((error) => window.alert(error.message)));
document.querySelector('#save-status').addEventListener('click', () => saveState().catch((error) => window.alert(error.message)));
document.querySelector('#players').addEventListener('input', (event) => {
  stateDirty = true;
  const card = event.target.closest('.player-card');
  if (card) card.querySelector('.hp-value').textContent = `${card.querySelector('.hp').value} / ${card.querySelector('.max-hp').value}`;
});
document.querySelector('#scene-text').addEventListener('input', () => { stateDirty = true; });

renderState();
loadEntries();
setInterval(loadEntries, 5000);
