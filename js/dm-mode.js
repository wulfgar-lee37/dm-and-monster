import { renderStatBlock } from './stat-block.js';
import {
  debounce, loadJSON, saveJSON, rollD20, rollDice, rollDie,
  parseDiceExpr, formatCR, getXP, parseCR, showToast,
} from './utils.js';

const SCENE_HOOKS = [
  'A wounded messenger collapses at the party\'s feet, clutching a sealed letter.',
  'Strange lights flicker in the distance — magic, or something else?',
  'The road ahead is blocked by a recent rockslide. Something dug through from the other side.',
  'Villagers whisper about livestock vanishing without a trace.',
  'An old shrine stands abandoned. Fresh offerings sit at its base.',
  'Two factions argue in the town square. Both want the party\'s help.',
  'A merchant\'s cart has overturned. Something in the cargo is scratching to get out.',
  'Tracks lead into the wilderness — too large to be any natural beast.',
  'A child offers to guide the party through a shortcut. Their eyes never blink.',
  'Rain begins to fall, but it smells of sulfur and ash.',
];

const SCENE_SETTINGS = [
  'A mist-shrouded forest at dusk',
  'A crumbling stone bridge over a raging river',
  'A torchlit dungeon corridor with fresh scorch marks',
  'A bustling market square on festival day',
  'A windswept mountain pass',
  'An underground cavern with bioluminescent fungi',
  'A haunted manor\'s overgrown garden',
  'A coastal cliff during a storm',
  'A desert oasis with suspiciously calm waters',
  'A fey crossing where reality feels thin',
];

const SCENE_COMPLICATIONS = [
  'A timer is ticking — reinforcements arrive in 5 rounds.',
  'The terrain is difficult: rubble, mud, or ice.',
  'Innocent bystanders are caught in the crossfire.',
  'A environmental hazard activates (fire, gas, collapsing ceiling).',
  'One combatant has secret orders that change mid-fight.',
  'Visibility is limited — fog, darkness, or smoke.',
  'The enemy tries to flee or negotiate if bloodied.',
  'A third party arrives unexpectedly.',
];

export function initDMMode(monsters) {
  let combatants = loadJSON('dm_initiative', []);
  let encounter = loadJSON('dm_encounter', []);
  let turnIndex = loadJSON('dm_turn_index', 0);

  // Tool tabs
  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.dm-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`dm${capitalize(tab.dataset.dmTab)}`).classList.add('active');
    });
  });

  // Initiative
  const initList = document.getElementById('initiativeList');

  function saveInit() {
    saveJSON('dm_initiative', combatants);
    saveJSON('dm_turn_index', turnIndex);
  }

  function renderInitiative() {
    initList.innerHTML = combatants.length
      ? combatants.map((c, i) => `
          <li class="initiative-item ${i === turnIndex ? 'active-turn' : ''}" data-id="${c.id}">
            <span class="init-value">${c.init}</span>
            <div class="combatant-info">
              <strong>${esc(c.name)}</strong>
              ${c.hp != null ? `<small>HP ${c.hp}${c.ac != null ? ` · AC ${c.ac}` : ''}</small>` : ''}
            </div>
            <div class="init-actions">
              <button class="btn small init-remove" data-id="${c.id}">✕</button>
            </div>
          </li>`).join('')
      : '<li class="hint">No combatants yet. Add names and initiative values above.</li>';

    initList.querySelectorAll('.init-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const idx = combatants.findIndex(c => c.id === id);
        combatants = combatants.filter(c => c.id !== id);
        if (turnIndex >= combatants.length) turnIndex = 0;
        else if (idx < turnIndex) turnIndex--;
        saveInit();
        renderInitiative();
      });
    });
  }

  document.getElementById('addCombatantForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('combatantName').value.trim();
    const init = parseInt(document.getElementById('combatantInit').value, 10);
    const hpVal = document.getElementById('combatantHp').value;
    const acVal = document.getElementById('combatantAc').value;
    if (!name || Number.isNaN(init)) return;
    combatants.push({
      id: crypto.randomUUID(),
      name,
      init,
      hp: hpVal ? parseInt(hpVal, 10) : null,
      ac: acVal ? parseInt(acVal, 10) : null,
    });
    e.target.reset();
    saveInit();
    renderInitiative();
  });

  document.getElementById('sortInitBtn').addEventListener('click', () => {
    combatants.sort((a, b) => b.init - a.init);
    turnIndex = 0;
    saveInit();
    renderInitiative();
  });

  document.getElementById('nextTurnBtn').addEventListener('click', () => {
    if (!combatants.length) return;
    turnIndex = (turnIndex + 1) % combatants.length;
    saveInit();
    renderInitiative();
  });

  document.getElementById('clearInitBtn').addEventListener('click', () => {
    if (!confirm('Clear all combatants?')) return;
    combatants = [];
    turnIndex = 0;
    saveInit();
    renderInitiative();
  });

  // Encounter builder
  const encList = document.getElementById('encounterList');
  const encSummary = document.getElementById('encounterSummary');
  const encSearch = document.getElementById('encounterSearch');
  const encResults = document.getElementById('encounterSearchResults');

  function saveEncounter() {
    saveJSON('dm_encounter', encounter);
  }

  function renderEncounter() {
    let totalXP = 0;
    let totalCR = 0;
    encList.innerHTML = encounter.length
      ? encounter.map(e => {
          const xp = getXP(e.cr) * e.qty;
          totalXP += xp;
          totalCR += parseCR(e.cr) * e.qty;
          return `
            <li class="encounter-item" data-slug="${e.slug}">
              <div>
                <strong>${esc(e.name)}</strong>
                <small> CR ${formatCR(e.cr)} · ${xp.toLocaleString()} XP</small>
              </div>
              <div class="qty-controls">
                <button class="btn small enc-minus" data-slug="${e.slug}">−</button>
                <span>${e.qty}</span>
                <button class="btn small enc-plus" data-slug="${e.slug}">+</button>
                <button class="btn small enc-remove" data-slug="${e.slug}">✕</button>
              </div>
            </li>`;
        }).join('')
      : '<li class="hint">Search and add monsters to build an encounter.</li>';

    const diff = totalCR < 4 ? 'Easy' : totalCR < 8 ? 'Medium' : totalCR < 12 ? 'Hard' : 'Deadly';
    encSummary.textContent = encounter.length
      ? `${encounter.reduce((s, e) => s + e.qty, 0)} creatures · ${totalXP.toLocaleString()} XP · ~${diff} (adj. CR ${totalCR.toFixed(1)})`
      : '';

    encList.querySelectorAll('.enc-minus').forEach(b => b.addEventListener('click', () => adjustQty(b.dataset.slug, -1)));
    encList.querySelectorAll('.enc-plus').forEach(b => b.addEventListener('click', () => adjustQty(b.dataset.slug, 1)));
    encList.querySelectorAll('.enc-remove').forEach(b => b.addEventListener('click', () => {
      encounter = encounter.filter(e => e.slug !== b.dataset.slug);
      saveEncounter();
      renderEncounter();
    }));
  }

  function adjustQty(slug, delta) {
    const item = encounter.find(e => e.slug === slug);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) encounter = encounter.filter(e => e.slug !== slug);
    saveEncounter();
    renderEncounter();
  }

  function addToEncounter(monster) {
    const existing = encounter.find(e => e.slug === monster.slug);
    if (existing) existing.qty++;
    else encounter.push({
      slug: monster.slug,
      name: monster.name,
      cr: monster.challenge_rating ?? monster.cr,
      qty: 1,
    });
    saveEncounter();
    renderEncounter();
    encSearch.value = '';
    encResults.classList.add('hidden');
    showToast(`Added ${monster.name}`);
  }

  setupSearch(encSearch, encResults, monsters, addToEncounter);

  // Dice
  const diceResult = document.getElementById('diceResult');

  document.getElementById('rollDiceBtn').addEventListener('click', () => {
    const sides = parseInt(document.getElementById('diceType').value, 10);
    const count = parseInt(document.getElementById('diceCount').value, 10) || 1;
    const mod = parseInt(document.getElementById('diceMod').value, 10) || 0;
    const mode = document.querySelector('input[name="rollMode"]:checked')?.value || 'normal';

    if (count === 1 && sides === 20) {
      const roll = rollD20(mode);
      diceResult.innerHTML = `<div class="total">${roll + mod}</div><div class="breakdown">d20 (${roll}) ${mod >= 0 ? '+' : ''}${mod}${mode !== 'normal' ? ` · ${mode}` : ''}</div>`;
      return;
    }

    const rolls = rollDice(count, sides);
    const sum = rolls.reduce((a, b) => a + b, 0);
    diceResult.innerHTML = `<div class="total">${sum + mod}</div><div class="breakdown">${count}d${sides} [${rolls.join(', ')}] ${mod >= 0 ? '+' : ''}${mod}</div>`;
  });

  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const expr = btn.dataset.quick;
      const p = parseDiceExpr(expr);
      if (!p) return;
      const rolls = rollDice(p.count, p.sides);
      const sum = rolls.reduce((a, b) => a + b, 0);
      diceResult.innerHTML = `<div class="total">${sum}</div><div class="breakdown">${expr} [${rolls.join(', ')}]</div>`;
    });
  });

  // Scenes
  document.getElementById('generateSceneBtn').addEventListener('click', () => {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    document.getElementById('sceneOutput').innerHTML = `
      <h4>Setting</h4><p>${pick(SCENE_SETTINGS)}</p>
      <h4>Hook</h4><p>${pick(SCENE_HOOKS)}</p>
      <h4>Complication</h4><p>${pick(SCENE_COMPLICATIONS)}</p>
      <h4>Weather &amp; Mood</h4><p>${pick(['Overcast and tense', 'Clear starlit night', 'Heavy fog', 'Oppressive heat', 'Cold wind', 'Eerie silence'])}</p>`;
  });

  // Notes
  const notesEl = document.getElementById('sessionNotes');
  notesEl.value = loadJSON('dm_notes', '');
  notesEl.addEventListener('input', debounce(() => saveJSON('dm_notes', notesEl.value), 400));

  // Stat lookup
  const statBlock = document.getElementById('dmStatBlock');
  setupSearch(
    document.getElementById('dmStatSearch'),
    document.getElementById('dmStatSearchResults'),
    monsters,
    m => { statBlock.innerHTML = renderStatBlock(m); },
    false,
  );

  renderInitiative();
  renderEncounter();
}

function setupSearch(input, resultsEl, monsters, onSelect, addMode = true) {
  const search = debounce(q => {
    q = q.trim().toLowerCase();
    if (q.length < 1) { resultsEl.classList.add('hidden'); return; }
    const matches = monsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 12);
    if (!matches.length) { resultsEl.classList.add('hidden'); return; }
    resultsEl.innerHTML = matches.map(m => `
      <div class="search-result-item" data-slug="${m.slug}">
        ${esc(m.name)}<small>CR ${formatCR(m.challenge_rating ?? m.cr)} · ${m.type}</small>
      </div>`).join('');
    resultsEl.classList.remove('hidden');
    resultsEl.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const m = monsters.find(x => x.slug === el.dataset.slug);
        if (m) onSelect(m);
        resultsEl.classList.add('hidden');
        if (addMode) input.value = '';
        else input.value = m.name;
      });
    });
  }, 150);

  input.addEventListener('input', () => search(input.value));
  input.addEventListener('focus', () => { if (input.value.trim()) search(input.value); });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !resultsEl.contains(e.target)) resultsEl.classList.add('hidden');
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
