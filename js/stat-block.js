import { abilityMod, formatMod, formatCR, formatSpeed } from './utils.js';

function renderAbilityScores(m) {
  const stats = [
    ['STR', m.strength],
    ['DEX', m.dexterity],
    ['CON', m.constitution],
    ['INT', m.intelligence],
    ['WIS', m.wisdom],
    ['CHA', m.charisma],
  ];
  return stats.map(([name, val]) => {
    const mod = abilityMod(val ?? 10);
    return `<div class="ability"><span class="ability-name">${name}</span>${val ?? '—'} (${formatMod(mod)})</div>`;
  }).join('');
}

function renderSaves(m) {
  const saves = [
    ['STR', m.strength_save, m.strength],
    ['DEX', m.dexterity_save, m.dexterity],
    ['CON', m.constitution_save, m.constitution],
    ['INT', m.intelligence_save, m.intelligence],
    ['WIS', m.wisdom_save, m.wisdom],
    ['CHA', m.charisma_save, m.charisma],
  ].filter(([, sv]) => sv != null);
  if (!saves.length) return '';
  return `<p class="stat-line"><strong>Saving Throws</strong> ${saves.map(([n, sv]) => `${n} ${formatMod(sv)}`).join(', ')}</p>`;
}

function renderSkills(m) {
  const skills = m.skills;
  if (!skills || (typeof skills === 'object' && !Object.keys(skills).length)) return '';
  const entries = typeof skills === 'object'
    ? Object.entries(skills).map(([k, v]) => `${k.replace(/_/g, ' ')} ${formatMod(v)}`)
    : [skills];
  return `<p class="stat-line"><strong>Skills</strong> ${entries.join(', ')}</p>`;
}

function renderSection(title, items) {
  if (!items || !items.length) return '';
  const list = Array.isArray(items) ? items : [items];
  const filtered = list.filter(i => i && (i.name || i.desc));
  if (!filtered.length) return '';
  return `
    <div class="stat-section">
      <h5>${title}</h5>
      ${filtered.map(item => `<p><strong>${item.name}.</strong> ${item.desc || ''}</p>`).join('')}
    </div>`;
}

function renderSpellcasting(sc) {
  if (!sc) return '';
  if (Array.isArray(sc)) return renderSection('Spellcasting', sc);
  if (typeof sc === 'object') {
    return `<div class="stat-section"><h5>Spellcasting</h5><p>${sc.desc || JSON.stringify(sc)}</p></div>`;
  }
  return '';
}

export function renderStatBlock(m) {
  if (!m) return '';

  const cr = m.challenge_rating ?? m.cr;
  const typeLine = [
    m.size,
    m.type + (m.subtype ? ` (${m.subtype})` : ''),
    m.alignment,
  ].filter(Boolean).join(', ');

  const ac = m.armor_desc ? `${m.armor_class} (${m.armor_desc})` : m.armor_class;
  const hp = m.hit_dice ? `${m.hit_points} (${m.hit_dice})` : m.hit_points;
  const init = m.initiative != null ? `${formatMod(m.initiative)} (${10 + m.initiative})` : formatMod(abilityMod(m.dexterity ?? 10));

  let immunities = '';
  if (m.damage_immunities) immunities += `<strong>Damage Immunities</strong> ${m.damage_immunities}. `;
  if (m.damage_resistances) immunities += `<strong>Damage Resistances</strong> ${m.damage_resistances}. `;
  if (m.damage_vulnerabilities) immunities += `<strong>Damage Vulnerabilities</strong> ${m.damage_vulnerabilities}. `;
  if (m.condition_immunities) immunities += `<strong>Condition Immunities</strong> ${m.condition_immunities}. `;

  return `
    <article class="stat-block">
      <header class="stat-block-header">
        <h4>${m.name}</h4>
        <p class="type-line">${typeLine}</p>
      </header>
      <p class="stat-line"><strong>Armor Class</strong> ${ac}</p>
      <p class="stat-line"><strong>Hit Points</strong> ${hp}</p>
      <p class="stat-line"><strong>Speed</strong> ${formatSpeed(m.speed)}</p>
      <div class="ability-scores">${renderAbilityScores(m)}</div>
      ${renderSaves(m)}
      ${renderSkills(m)}
      ${immunities ? `<p class="stat-line">${immunities}</p>` : ''}
      <p class="stat-line"><strong>Senses</strong> ${m.senses || '—'}</p>
      <p class="stat-line"><strong>Languages</strong> ${m.languages || '—'}</p>
      <p class="stat-line"><strong>Challenge</strong> ${formatCR(cr)}${getXP(cr) ? ` (${getXP(cr).toLocaleString()} XP)` : ''}</p>
      ${m.gear ? `<p class="stat-line"><strong>Gear</strong> ${m.gear}</p>` : ''}
      ${renderSection('Traits', m.special_abilities)}
      ${renderSpellcasting(m.spellcasting)}
      ${renderSection('Actions', m.actions)}
      ${renderSection('Bonus Actions', m.bonus_actions)}
      ${renderSection('Reactions', m.reactions)}
      ${m.legendary_desc ? `<div class="stat-section"><h5>Legendary Actions</h5><p>${m.legendary_desc}</p></div>` : ''}
      ${renderSection('Legendary Actions', m.legendary_actions)}
      ${renderSection('Lair Actions', m.lair_actions)}
    </article>`;
}

function getXP(cr) {
  const map = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100 };
  if (map[String(cr)] != null) return map[String(cr)];
  const n = parseFloat(cr);
  const table = { 1:200,2:450,3:700,4:1100,5:1800,6:2300,7:2900,8:3900,9:5000,10:5900,
    11:7200,12:8400,13:10000,14:11500,15:13000,16:15000,17:18000,18:20000,19:22000,20:25000,
    21:33000,22:41000,23:50000,24:62000,25:75000,26:90000,27:105000,28:120000,29:135000,30:155000 };
  return table[Math.floor(n)] ?? 0;
}
