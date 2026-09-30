import { initDMMode } from './dm-mode.js';
import { initMonsterMode } from './monster-mode.js';

let monsters = [];

async function loadMonsters() {
  const res = await fetch('data/monsters.json');
  if (!res.ok) throw new Error('Failed to load monster data');
  const data = await res.json();
  return data.monsters || data;
}

function setMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === `${mode}View`);
  });
}

function setupNavigation() {
  document.getElementById('modeNav').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (btn) setMode(btn.dataset.mode);
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => setMode(el.dataset.goto));
  });
}

async function init() {
  setupNavigation();

  try {
    monsters = await loadMonsters();
    console.info(`Loaded ${monsters.length} SRD 5.2.1 monsters`);
  } catch (err) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state">
        <h2>Could not load monster data</h2>
        <p>Run a local server from the project folder:<br><code>python3 -m http.server 8080</code></p>
        <p style="color:var(--text-muted)">${err.message}</p>
      </div>`;
    return;
  }

  initDMMode(monsters);
  initMonsterMode(monsters);
}

init();
