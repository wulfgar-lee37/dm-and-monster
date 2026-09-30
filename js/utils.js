export function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

export function formatMod(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n >= 0 ? `+${n}` : `${n}`;
}

export function formatCR(cr) {
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr ?? '?');
}

export function parseCR(cr) {
  if (typeof cr === 'number') return cr;
  if (!cr) return 0;
  const map = { '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
  return map[String(cr)] ?? parseFloat(cr) ?? 0;
}

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  return rolls;
}

export function rollD20(mode = 'normal') {
  const a = rollDie(20);
  if (mode === 'advantage') return Math.max(a, rollDie(20));
  if (mode === 'disadvantage') return Math.min(a, rollDie(20));
  return a;
}

export function parseDiceExpr(expr) {
  if (!expr) return null;
  const m = String(expr).match(/(\d+)d(\d+)/i);
  if (!m) return null;
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10) };
}

export function rollExpression(expr, bonus = 0) {
  const parsed = parseDiceExpr(expr);
  if (!parsed) return { total: bonus, rolls: [], expr: String(expr) };
  const rolls = rollDice(parsed.count, parsed.sides);
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { total: sum + bonus, rolls, expr: `${parsed.count}d${parsed.sides}${bonus ? (bonus >= 0 ? `+${bonus}` : bonus) : ''}` };
}

export function parseAttackFromDesc(desc) {
  if (!desc) return null;
  const attackMatch = desc.match(/(?:Attack Roll|to hit):\s*\+(\d+)/i) || desc.match(/\+(\d+)\s*(?:to hit|attack)/i);
  const damageMatch = desc.match(/Hit:\s*\d+\s*\(([^)]+)\)/i) || desc.match(/\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
  let damageDice = null;
  let damageBonus = 0;
  if (damageMatch) {
    const inner = damageMatch[1].replace(/\s/g, '');
    const dm = inner.match(/(\d+d\d+)([+-]\d+)?/i);
    if (dm) {
      damageDice = dm[1];
      damageBonus = dm[2] ? parseInt(dm[2], 10) : 0;
    }
  }
  return {
    attackBonus: attackMatch ? parseInt(attackMatch[1], 10) : null,
    damageDice,
    damageBonus,
  };
}

export function formatSpeed(speed) {
  if (!speed) return '—';
  if (typeof speed === 'string') return speed;
  return Object.entries(speed)
    .map(([k, v]) => {
      if (k === 'walk') return `${v} ft.`;
      return `${k} ${v} ft.`;
    })
    .join(', ');
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

export const XP_BY_CR = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
  26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

export function getXP(cr) {
  const n = parseCR(cr);
  return XP_BY_CR[n] ?? XP_BY_CR[Math.floor(n)] ?? 0;
}
