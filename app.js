const STORAGE_KEY = 'ttrpg-table-log-v1';
const logElement = document.querySelector('#log');
const template = document.querySelector('#log-entry-template');
const nameInput = document.querySelector('#player-name');
const diceInput = document.querySelector('#dice-command');
const diceResult = document.querySelector('#dice-result');

let entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function now() {
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

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

function addEntry(name, message) {
  entries.push({ name, message, time: now() });
  entries = entries.slice(-100);
  save();
  render();
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

document.querySelector('#dice-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const result = roll(diceInput.value);
    const modifierText = result.modifier ? ` ${result.modifier > 0 ? '+' : '-'} ${Math.abs(result.modifier)}` : '';
    const detail = `[${result.values.join(', ')}]${modifierText}`;
    const message = `${result.cleaned.toUpperCase()} → ${result.total}（${detail}）`;
    diceResult.textContent = message;
    addEntry(nameInput.value.trim() || 'プレイヤー', `🎲 ${message}`);
  } catch (error) { diceResult.textContent = error.message; }
});

document.querySelectorAll('[data-dice]').forEach((button) => button.addEventListener('click', () => {
  diceInput.value = button.dataset.dice;
  document.querySelector('#dice-form').requestSubmit();
}));

document.querySelector('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const field = document.querySelector('#chat-message');
  const message = field.value.trim();
  if (!message) return;
  addEntry(nameInput.value.trim() || 'プレイヤー', message);
  field.value = '';
  field.focus();
});

document.querySelector('#clear-log').addEventListener('click', () => {
  if (window.confirm('このブラウザのログをすべて消しますか？')) {
    entries = [];
    save();
    render();
  }
});

render();
