import { renderStatBlock } from './stat-block.js';
import {
  abilityMod, formatMod, formatCR, debounce, loadJSON, saveJSON,
  rollD20, rollExpression, parseAttackFromDesc, showToast,
} from './utils.js';

const PERSONA_BY_TYPE = {
  aberration: ['Speak in riddles. Describe unsettling anatomy. Refer to "the deep places."', 'You perceive time differently. Mention memories that haven\'t happened yet.', 'Your motives are alien — hunger, curiosity, or something worse.'],
  beast: ['You act on instinct. Growl, snarl, circle your prey.', 'Territory matters. You warn before you strike — once.', 'Pack tactics: coordinate with allies or flee if outnumbered.'],
  celestial: ['Speak with gravitas. Invoke duty, light, or divine purpose.', 'Offer mercy once. Do not offer it twice.', 'Your presence should feel otherworldly and awe-inspiring.'],
  construct: ['You follow orders literally. No emotion, only function.', 'Protect your creator\'s domain at all costs.', 'Repeat a programmed phrase when damaged.'],
  dragon: ['Demand respect. Refer to yourself in the third person.', 'Hoard something — gold, knowledge, or trophies.', 'Offer a bargain before unleashing your breath weapon.'],
  elemental: ['Embody your element in speech and mannerisms.', 'You are chaos given form — unpredictable but themed.', 'Speak of the Plane you hail from.'],
  fey: ['Be mischievous, cruel, or whimsically dangerous.', 'Make deals with hidden catches. Never give straight answers.', 'Take offense at iron, broken promises, or being mocked.'],
  fiend: ['Whisper temptations. Offer power at a price.', 'Enjoy suffering. Mock the party\'s ideals.', 'Refer to your master in the Lower Planes.'],
  giant: ['Speak simply and loudly. Talk about strength and honor (or its lack).', 'Dismiss "small folk" unless they prove themselves.', 'Remember ancient grudges against other giant kin.'],
  humanoid: ['You have goals beyond combat — gold, revenge, survival.', 'Negotiate if losing. Most humanoids fear death.', 'Use the environment and cover. You\'re not mindless.'],
  monstrosity: ['You are a nightmare made flesh. Describe how wrong you look.', 'Hunt with cunning, not just brute force.', 'Your origin is unnatural — lean into the horror.'],
  ooze: ['No speech — describe acidic sizzling, pseudopod movements.', 'Mindlessly consume. Split when struck (if applicable).', 'Leave a trail. Players can track you.'],
  plant: ['Slow, patient, rooted in place. Vines and spores.', 'Protect the grove. Sun and soil are sacred.', 'Communicate through rustling leaves or pollen scents.'],
  undead: ['Speak of hunger — for life, warmth, or souls.', 'You feel no pain. Describe decay and cold.', 'Driven by curse, master\'s will, or endless torment.'],
};

const PERSONA_GENERIC = [
  'Describe what your monster wants in this fight — food, territory, orders, or sport.',
  'Use your senses: what does the party smell like? Sound like? Look like to you?',
  'React to the last thing a player said — mock it, fear it, or ignore it.',
  'Announce your most dangerous ability before using it for dramatic effect.',
  'If bloodied, change tactics: flee, rage, or surrender depending on your nature.',
];

export function initMonsterMode(monsters) {
  let selected = null;
  let currentHp = 0;
  let maxHp = 0;

  const typeFilter = document.getElementById('typeFilter');
  const types = [...new Set(monsters.map(m => m.type).filter(Boolean))].sort();
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    typeFilter.appendChild(opt);
  });

  const monsterList = document.getElementById('monsterList');
  const searchInput = document.getElementById('monsterSearch');
  const crFilter = document.getElementById('crFilter');

  function filterMonsters() {
    const q = searchInput.value.trim().toLowerCase();
    const cr = crFilter.value;
    const type = typeFilter.value;
    return monsters.filter(m => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (type && m.type !== type) return false;
      if (cr) {
        const mcr = parseFloat(m.cr ?? m.challenge_rating ?? 0);
        if (cr === '5') { if (mcr < 5) return false; }
        else if (mcr !== parseFloat(cr)) return false;
      }
      return true;
    });
  }

  function renderList() {
    const filtered = filterMonsters();
    monsterList.innerHTML = filtered.slice(0, 80).map(m => `
      <li class="monster-list-item ${selected?.slug === m.slug ? 'selected' : ''}" data-slug="${m.slug}">
        ${esc(m.name)}
        <small>CR ${formatCR(m.challenge_rating ?? m.cr)} · ${m.type}</small>
      </li>`).join('') + (filtered.length > 80 ? `<li class="hint">+${filtered.length - 80} more — refine search</li>` : '');

    monsterList.querySelectorAll('.monster-list-item[data-slug]').forEach(el => {
      el.addEventListener('click', () => selectMonster(el.dataset.slug));
    });
  }

  function selectMonster(slug) {
    selected = monsters.find(m => m.slug === slug);
    if (!selected) return;
    maxHp = selected.hit_points ?? 1;
    const saved = loadJSON(`monster_hp_${slug}`, null);
    currentHp = saved ?? maxHp;

    document.getElementById('monsterEmpty').classList.add('hidden');
    document.getElementById('monsterPlay').classList.remove('hidden');
    document.getElementById('playMonsterName').textContent = selected.name;
    document.getElementById('playMonsterMeta').textContent =
      `${selected.size} ${selected.type} · CR ${formatCR(selected.challenge_rating ?? selected.cr)} · AC ${selected.armor_class}`;

    updateHpUI();
    renderQuickStats();
    renderActions();
    renderPersona();
    document.getElementById('playStatBlock').innerHTML = renderStatBlock(selected);
    document.getElementById('rollLog').innerHTML = '';
    renderList();
    saveJSON('last_monster', slug);
  }

  function updateHpUI() {
    document.getElementById('currentHp').value = currentHp;
    document.getElementById('maxHp').textContent = maxHp;
    const pct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
    const fill = document.getElementById('hpBarFill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', pct <= 25);
    if (selected) saveJSON(`monster_hp_${selected.slug}`, currentHp);
  }

  function changeHp(delta) {
    currentHp = Math.max(0, Math.min(maxHp, currentHp + delta));
    updateHpUI();
  }

  document.getElementById('hpMinus').addEventListener('click', () => changeHp(-1));
  document.getElementById('hpPlus').addEventListener('click', () => changeHp(1));
  document.getElementById('hpMinus10').addEventListener('click', () => changeHp(-10));
  document.getElementById('hpPlus10').addEventListener('click', () => changeHp(10));
  document.getElementById('hpReset').addEventListener('click', () => { currentHp = maxHp; updateHpUI(); });
  document.getElementById('currentHp').addEventListener('change', e => {
    currentHp = Math.max(0, Math.min(maxHp, parseInt(e.target.value, 10) || 0));
    updateHpUI();
  });

  function renderQuickStats() {
    const m = selected;
    const dexMod = abilityMod(m.dexterity ?? 10);
    const init = m.initiative ?? dexMod;
    document.getElementById('quickStats').innerHTML = `
      <div class="quick-stat"><span class="label">AC</span><span class="value">${m.armor_class}</span></div>
      <div class="quick-stat"><span class="label">Init</span><span class="value">${formatMod(init)}</span></div>
      <div class="quick-stat"><span class="label">PB</span><span class="value">+${m.proficiency_bonus ?? profFromCR(m.challenge_rating ?? m.cr)}</span></div>
      <div class="quick-stat"><span class="label">STR</span><span class="value">${formatMod(abilityMod(m.strength ?? 10))}</span></div>
      <div class="quick-stat"><span class="label">DEX</span><span class="value">${formatMod(abilityMod(m.dexterity ?? 10))}</span></div>
      <div class="quick-stat"><span class="label">CON</span><span class="value">${formatMod(abilityMod(m.constitution ?? 10))}</span></div>`;
  }

  document.getElementById('rollInitBtn').addEventListener('click', () => {
    const m = selected;
    const mod = m.initiative ?? abilityMod(m.dexterity ?? 10);
    const roll = rollD20('normal');
    logRoll(`Initiative: d20 (${roll}) ${formatMod(mod)} = <strong>${roll + mod}</strong>`);
  });

  function renderActions() {
    const container = document.getElementById('actionButtons');
    const sections = [
      ['Actions', selected.actions],
      ['Bonus Actions', selected.bonus_actions],
      ['Reactions', selected.reactions],
      ['Legendary', selected.legendary_actions],
    ];

    container.innerHTML = sections.flatMap(([label, items]) => {
      if (!items || !items.length) return [];
      const list = Array.isArray(items) ? items : [items];
      return list.filter(i => i?.name).map(action => `
        <button class="action-btn" data-action="${escAttr(action.name)}" data-section="${label}">
          <span class="action-name">${esc(action.name)}${label !== 'Actions' ? ` (${label})` : ''}</span>
          <span class="action-desc">${esc(truncate(action.desc, 120))}</span>
        </button>`);
    }).join('') || '<p class="hint">No actions listed for this creature.</p>';

    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => rollAction(btn.dataset.action, btn.dataset.section));
    });
  }

  function rollAction(name, section) {
    const sections = {
      Actions: selected.actions,
      'Bonus Actions': selected.bonus_actions,
      Reactions: selected.reactions,
      Legendary: selected.legendary_actions,
    };
    const items = sections[section];
    const action = (Array.isArray(items) ? items : []).find(a => a.name === name);
    if (!action) return;

    const parsed = parseAttackFromDesc(action.desc);
    const attackBonus = action.attack_bonus ?? parsed?.attackBonus;
    const damageDice = action.damage_dice ?? parsed?.damageDice;
    const damageBonus = action.damage_bonus ?? parsed?.damageBonus ?? 0;

    let msg = `<strong>${name}:</strong> `;

    if (attackBonus != null) {
      const atkRoll = rollD20('normal');
      const total = atkRoll + attackBonus;
      const hit = atkRoll === 20 ? true : atkRoll === 1 ? false : null;
      msg += `Attack d20 (${atkRoll}) + ${attackBonus} = <strong>${total}</strong>`;
      if (hit === true) msg += ' <span class="hit">CRIT!</span>';
      if (hit === false) msg += ' <span class="miss">Fumble!</span>';

      if (damageDice && hit !== false) {
        const dmg = rollExpression(damageDice, damageBonus);
        const dmgTotal = hit === true ? dmg.total + rollExpression(damageDice, damageBonus).total - damageBonus : dmg.total;
        msg += ` · Damage: ${dmg.expr} [${dmg.rolls.join(',')}] = <strong>${hit === true ? dmgTotal : dmg.total}</strong>`;
      }
    } else if (damageDice) {
      const dmg = rollExpression(damageDice, damageBonus);
      msg += `Damage: ${dmg.expr} [${dmg.rolls.join(',')}] = <strong>${dmg.total}</strong>`;
    } else {
      msg += esc(truncate(action.desc, 100));
    }

    logRoll(msg);
  }

  function logRoll(html) {
    const log = document.getElementById('rollLog');
    const entry = document.createElement('div');
    entry.className = 'roll-entry';
    entry.innerHTML = html;
    log.prepend(entry);
  }

  function renderPersona() {
    const type = (selected.type || 'monstrosity').toLowerCase();
    const pool = PERSONA_BY_TYPE[type] || PERSONA_GENERIC;
    const all = [...pool, ...PERSONA_GENERIC];
    const text = all[Math.floor(Math.random() * all.length)];
    document.getElementById('personaCard').innerHTML = `<p class="persona-text">${text}</p>`;
  }

  document.getElementById('newPersonaBtn').addEventListener('click', renderPersona);

  searchInput.addEventListener('input', debounce(renderList, 150));
  crFilter.addEventListener('change', renderList);
  typeFilter.addEventListener('change', renderList);

  renderList();

  const lastSlug = loadJSON('last_monster', null);
  if (lastSlug) selectMonster(lastSlug);
}

function profFromCR(cr) {
  const n = parseFloat(String(cr).replace('1/8', '0.125').replace('1/4', '0.25').replace('1/2', '0.5')) || 0;
  if (n <= 4) return 2;
  if (n <= 8) return 3;
  if (n <= 12) return 4;
  if (n <= 16) return 5;
  if (n <= 20) return 6;
  if (n <= 24) return 7;
  if (n <= 28) return 8;
  return 9;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
