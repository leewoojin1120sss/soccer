/** Pure, seeded game engine. Money: £ million, wages: £ million/week.
 * Real identities belong to the dataset; all sporting and financial attributes are game estimates. */
export const PHASES = [
  "시즌 준비",
  "전반기",
  "겨울 이적시장",
  "후반기",
  "시즌 결산",
];
export const GROUP = {
  GK: "GK",
  CB: "DF",
  LB: "DF",
  RB: "DF",
  DM: "MF",
  CM: "MF",
  AM: "MF",
  LM: "MF",
  RM: "MF",
  LW: "FW",
  RW: "FW",
  ST: "FW",
};
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const round = (x) => Math.round(x * 1000) / 1000;
export function rng(s) {
  let t = (s.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  s.seed = s.seed >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, a) => a[Math.floor(rng(s) * a.length)];
export const squad = (s, cid) =>
  s.players.filter((p) => p.clubId === cid && !p.retired);
export const club = (s, id = s.userId) => s.clubs.find((c) => c.id === id);
export const manager = (s, cid = s.userId) =>
  s.managers.find((m) => m.clubId === cid);
export const marketOpen = (s) =>
  !s.gameOver && (s.phase === 0 || s.phase === 2);
export function table(s) {
  return Object.values(s.table).sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.id.localeCompare(b.id),
  );
}
export const rank = (s, id = s.userId) =>
  table(s).findIndex((t) => t.id === id) + 1;
export const wages = (s, id = s.userId) =>
  round(
    squad(s, id).reduce(
      (a, p) => a + (p.loanParent ? p.wage * 0.5 : p.wage),
      0,
    ) +
      s.players
        .filter((p) => p.loanParent === id)
        .reduce((a, p) => a + p.wage * 0.5, 0),
  );
export function log(s, type, text, detail = {}) {
  const v = {
    id: ++s.serial,
    year: s.year,
    phase: s.phase,
    type,
    text,
    ...detail,
  };
  s.news.unshift(v);
  if (s.news.length > 150) s.news.length = 150;
  return v;
}
function account(s, cid, amount, category) {
  const c = club(s, cid);
  if (!c) return;
  c.balance = round(c.balance + amount);
  if (cid === s.userId) {
    s.ledger.push({
      year: s.year,
      phase: s.phase,
      amount: round(amount),
      category,
    });
  }
}
export function fixtures(ids, year, seedState) {
  let ring = [...ids];
  if (seedState) {
    for (let i = ring.length - 1; i > 0; i--) {
      const j = Math.floor(rng(seedState) * (i + 1));
      [ring[i], ring[j]] = [ring[j], ring[i]];
    }
  }
  const rounds = [];
  for (let r = 0; r < 19; r++) {
    const games = [];
    for (let i = 0; i < 10; i++) {
      let a = ring[i],
        b = ring[19 - i];
      if ((r + i) % 2) [a, b] = [b, a];
      games.push({
        id: `${year}-${r}-${i}`,
        round: r + 1,
        home: a,
        away: b,
        hg: null,
        ag: null,
        events: [],
      });
    }
    rounds.push(games);
    ring = [ring[0], ring.at(-1), ...ring.slice(1, -1)];
  }
  return [
    ...rounds,
    ...rounds.map((games, r) =>
      games.map((g, i) => ({
        id: `${year}-${r + 19}-${i}`,
        round: r + 20,
        home: g.away,
        away: g.home,
        hg: null,
        ag: null,
        events: [],
      })),
    ),
  ].flat();
}
function emptyTable(ids) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] },
    ]),
  );
}
const emptyStats = () => ({
  apps: 0,
  starts: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
});
export function newGame(data, userId, seed = Date.now() >>> 0) {
  if (!data.meta.eplIds.includes(userId))
    throw Error("지원하지 않는 시작 구단입니다.");
  const s = {
    version: 1,
    seed,
    serial: 0,
    year: 2026,
    phase: 0,
    userId,
    activeIds: [...data.meta.eplIds],
    lowerIds: [...data.meta.promotionPool],
    players: structuredClone(data.players),
    clubs: structuredClone(data.clubs),
    managers: structuredClone(data.managers),
    history: [],
    transfers: [],
    managerHistory: [],
    ledger: [],
    news: [],
    decisions: [],
    reports: [],
    offers: [],
    negotiations: {},
    round: 0,
    gameOver: false,
    settled: false,
    lastSaved: null,
  };
  for (const c of s.clubs) {
    c.balance ??= Math.round(20 + c.rep);
    c.budget ??= Math.round(c.rep / 2);
    c.wageLimit ??= Math.max(0.3, (c.rep - 45) * 0.06);
    c.fans = 70;
    c.morale = 70;
    c.adaptation = 0;
    c.academy = 1;
    c.facilities = 1;
    c.stadium = 1;
    c.target ??= 15;
    c.debt = 0;
    c.invested = [];
  }
  for (const p of s.players) {
    p.morale = 75;
    p.fitness = 95;
    p.injury = 0;
    p.stats = emptyStats();
    p.career = { apps: 0, goals: 0, assists: 0 };
    p.trend = 0;
    p.ownerStats = { apps: 0, goals: 0, assists: 0 };
    p.listed = false;
    p.loanParent = p.initialLoanParent ?? null;
    p.retired = false;
  }
  for (const m of s.managers) {
    m.relationship = 75;
    m.games = 0;
    m.wins = 0;
  }
  ensureManagers(s);
  for (let i = 0; i < 6; i++) generateManager(s);
  s.fixtures = fixtures(s.activeIds, s.year, s);
  s.table = emptyTable(s.activeIds);
  s.managerHistory.push({
    year: s.year,
    phase: 0,
    name: manager(s)?.name ?? "감독 대행",
    action: "취임",
  });
  log(s, "club", `${club(s).ko}의 새로운 구단주로 부임했습니다.`);
  createDecisions(s);
  return s;
}
function ensureManagers(s, skipUser = false) {
  for (const id of [...s.activeIds, ...s.lowerIds]) {
    if ((skipUser && id === s.userId) || manager(s, id)) continue;
    let m = s.managers.find((x) => !x.clubId);
    if (!m) m = generateManager(s);
    m.clubId = id;
    m.contract = s.year + 2;
  }
}
function generateManager(s) {
  const n = s.managers.length;
  const m = {
    id: `gen-m-${s.year}-${n}`,
    name: `${pick(s, ["James", "Lucas", "Oliver", "Matteo", "Hugo", "Felix", "Theo", "Rafael"])} ${pick(s, ["Walker", "Costa", "Rossi", "Moreau", "Schmidt", "Taylor", "Silva", "Martin"])}`,
    nat: "가상",
    age: 38 + Math.floor(rng(s) * 24),
    formation: pick(s, ["4-3-3", "4-2-3-1", "3-4-3", "4-4-2"]),
    style: pick(s, ["점유율", "압박", "역습", "균형", "실리", "직선적"]),
    attack: 65 + Math.floor(rng(s) * 25),
    defense: 65 + Math.floor(rng(s) * 25),
    youth: 60 + Math.floor(rng(s) * 35),
    management: 60 + Math.floor(rng(s) * 35),
    rep: 65 + Math.floor(rng(s) * 23),
    wage: 0.04 + round(rng(s) * 0.06),
    real: false,
    clubId: null,
    relationship: 70,
    games: 0,
    wins: 0,
  };
  s.managers.push(m);
  return m;
}
const shape = {
  "4-3-3": ["GK", "RB", "CB", "CB", "LB", "DM", "CM", "CM", "RW", "ST", "LW"],
  "4-2-3-1": ["GK", "RB", "CB", "CB", "LB", "DM", "CM", "RW", "AM", "LW", "ST"],
  "3-4-3": ["GK", "CB", "CB", "CB", "RM", "CM", "CM", "LM", "RW", "ST", "LW"],
  "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RM", "CM", "CM", "LM", "ST", "ST"],
};
export function lineup(s, cid, roster = squad(s, cid)) {
  const m = manager(s, cid);
  const c = club(s, cid);
  const slots = shape[m?.formation] ?? shape["4-3-3"];
  const available = roster.filter((p) => p.injury === 0);
  const used = new Set();
  const result = [];
  for (const pos of slots) {
    let best = null,
      score = -Infinity;
    for (const p of available) {
      if (used.has(p.id)) continue;
      let fit =
        p.pos === pos
          ? 1
          : p.secondary?.includes(pos)
            ? 0.94
            : GROUP[p.pos] === GROUP[pos]
              ? 0.84
              : 0.58;
      if ((p.pos === "GK") !== (pos === "GK")) fit = 0.18;
      const ability =
        p.ca * fit * (0.85 + p.fitness / 650) * (0.9 + p.morale / 750);
      const preference =
        (m?.youth ?? 70) > 78 && p.age !== null && p.age < 23 ? 1.8 : 0;
      const n = ability + preference;
      if (n > score) {
        score = n;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      result.push({ p: best, pos, effective: score });
    }
  }
  const bench = available
    .filter((p) => !used.has(p.id) && p.pos !== "GK")
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 3);
  const groups = (g) => result.filter((x) => g.includes(GROUP[x.pos]));
  const avg = (a) =>
    a.reduce((v, x) => v + x.effective, 0) / Math.max(a.length, 1);
  const depth = result.length / 11;
  const att = avg(groups(["FW", "MF"]));
  const def = avg(groups(["DF", "GK"]));
  let styleA = 0,
    styleD = 0;
  if (m?.style === "압박") {
    styleA = 2;
    styleD = -1;
  }
  if (m?.style === "실리" || m?.style === "역습") {
    styleA = -1;
    styleD = 2;
  }
  const mood =
    ((c?.morale ?? 70) - 70) * 0.06 +
    ((m?.management ?? 70) - 70) * 0.04 +
    ((m?.relationship ?? 70) - 70) * 0.015;
  const adapt = c?.adaptation ?? 0;
  return {
    xi: result,
    bench,
    attack:
      (att * 0.84 + (m?.attack ?? 65) * 0.16 + styleA + mood - adapt) * depth,
    defense:
      (def * 0.84 + (m?.defense ?? 65) * 0.16 + styleD + mood - adapt) * depth,
    power: round(((att + def) / 2) * depth),
  };
}
function poisson(s, lambda) {
  const limit = Math.exp(-lambda);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= rng(s);
  } while (p > limit && k < 12);
  return k - 1;
}
function weighted(s, arr, fn) {
  let sum = arr.reduce((a, p) => a + fn(p), 0),
    n = rng(s) * sum;
  for (const p of arr) {
    n -= fn(p);
    if (n <= 0) return p;
  }
  return arr.at(-1);
}
function goals(s, side, count, fixture, home) {
  if (!side.xi.length) return;
  const gw = {
    GK: 0.001,
    CB: 0.12,
    LB: 0.15,
    RB: 0.15,
    DM: 0.3,
    CM: 0.65,
    AM: 1.2,
    LM: 0.9,
    RM: 0.9,
    LW: 1.9,
    RW: 1.9,
    ST: 3.8,
  };
  for (let i = 0; i < count; i++) {
    const minute = 1 + Math.floor(rng(s) * 90);
    const participants = (
      side.eventPlayers ?? side.xi.map((x) => ({ p: x.p, start: 0, end: 90 }))
    )
      .filter((x) => minute > x.start && minute <= x.end)
      .map((x) => x.p);
    const scorer = weighted(
      s,
      participants,
      (p) => (gw[p.pos] ?? 0.7) * Math.pow(p.ca / 65, 2),
    );
    scorer.stats.goals++;
    if (scorer.clubId === s.userId) {
      scorer.ownerStats ??= { apps: 0, goals: 0, assists: 0 };
      scorer.ownerStats.goals++;
    }
    let aid = null;
    if (rng(s) < 0.78) {
      const helpers = participants.filter(
        (p) => p.id !== scorer.id && p.pos !== "GK",
      );
      if (helpers.length) {
        const a = weighted(s, helpers, (p) =>
          ["AM", "CM", "LW", "RW", "LM", "RM"].includes(p.pos) ? 3 : 1,
        );
        a.stats.assists++;
        if (a.clubId === s.userId) {
          a.ownerStats ??= { apps: 0, goals: 0, assists: 0 };
          a.ownerStats.assists++;
        }
        aid = a.id;
      }
    }
    fixture.events.push({ playerId: scorer.id, assistId: aid, minute, home });
  }
}
function appearance(s, side) {
  const starters = side.xi.map((x) => x.p);
  let replace = starters
    .filter((p) => p.pos !== "GK")
    .sort((a, b) => a.fitness - b.fitness)
    .slice(0, side.bench.length);
  side.eventPlayers = [
    ...starters.map((p) => ({
      p,
      start: 0,
      end: replace.includes(p) ? 65 : 90,
    })),
    ...side.bench.map((p) => ({ p, start: 65, end: 90 })),
  ];
  for (const p of starters) {
    p.stats.apps++;
    if (p.clubId === s.userId) {
      p.ownerStats ??= { apps: 0, goals: 0, assists: 0 };
      p.ownerStats.apps++;
    }
    p.stats.starts++;
    p.stats.minutes += replace.includes(p) ? 65 : 90;
    p.fitness = clamp(p.fitness - 5 - rng(s) * 7, 30, 100);
  }
  for (const p of side.bench) {
    p.stats.apps++;
    if (p.clubId === s.userId) {
      p.ownerStats ??= { apps: 0, goals: 0, assists: 0 };
      p.ownerStats.apps++;
    }
    p.stats.minutes += 25;
    p.fitness = clamp(p.fitness - 3, 30, 100);
  }
}
function simulateMatch(s, g, rosters) {
  const h = lineup(s, g.home, rosters.get(g.home)),
    a = lineup(s, g.away, rosters.get(g.away));
  g.hx = round(clamp(1.5 * Math.exp((h.attack - a.defense) / 23), 0.2, 4.2));
  g.ax = round(clamp(1.13 * Math.exp((a.attack - h.defense) / 23), 0.15, 4));
  g.hg = poisson(s, g.hx);
  g.ag = poisson(s, g.ax);
  appearance(s, h);
  appearance(s, a);
  goals(s, h, g.hg, g, true);
  goals(s, a, g.ag, g, false);
  g.events.sort((a, b) => a.minute - b.minute);
  for (const [id, gf, ga] of [
    [g.home, g.hg, g.ag],
    [g.away, g.ag, g.hg],
  ]) {
    const t = s.table[id],
      c = club(s, id),
      m = manager(s, id);
    t.p++;
    t.gf += gf;
    t.ga += ga;
    if (gf > ga) {
      t.w++;
      t.pts += 3;
      t.form.push("W");
    } else if (gf === ga) {
      t.d++;
      t.pts++;
      t.form.push("D");
    } else {
      t.l++;
      t.form.push("L");
    }
    t.form = t.form.slice(-5);
    c.morale = clamp(c.morale + (gf > ga ? 2 : gf === ga ? 0 : -2), 30, 98);
    c.adaptation = Math.max(0, c.adaptation - 0.3);
    if (m) {
      m.games++;
      if (gf > ga) m.wins++;
    }
  }
  for (const side of [h, a])
    for (const { p } of side.xi)
      if (rng(s) < 0.012) {
        p.injury = 1 + Math.floor(rng(s) * 5);
        if (p.clubId === s.userId)
          log(s, "injury", `${p.name}, ${p.injury}경기 결장 예상`);
      }
}
function simulateHalf(s, from) {
  const rosters = new Map(s.activeIds.map((id) => [id, squad(s, id)]));
  for (let r = from; r < from + 19; r++) {
    for (const id of s.activeIds)
      for (const p of rosters.get(id)) {
        p.fitness = clamp(
          p.fitness + 9 + (club(s, id).facilities - 1) * 1.5,
          35,
          100,
        );
      }
    const injuries = new Map(
      [...rosters.values()].flat().map((p) => [p.id, p.injury]),
    );
    for (const g of s.fixtures.filter((g) => g.round === r + 1))
      simulateMatch(s, g, rosters);
    for (const rs of rosters.values())
      for (const p of rs)
        if ((injuries.get(p.id) ?? 0) > 0) p.injury = Math.max(0, p.injury - 1);
    s.round = r + 1;
  }
  financeHalf(s);
  const pos = rank(s);
  const own = s.fixtures.filter(
    (g) =>
      (g.home === s.userId || g.away === s.userId) &&
      g.round > from &&
      g.round <= from + 19,
  );
  const report = {
    year: s.year,
    half: from === 0 ? "전반기" : "후반기",
    position: pos,
    points: s.table[s.userId].pts,
    w: own.filter(
      (g) =>
        (g.home === s.userId ? g.hg : g.ag) >
        (g.home === s.userId ? g.ag : g.hg),
    ).length,
    draws: own.filter((g) => g.hg === g.ag).length,
    goals: own.reduce((v, g) => v + (g.home === s.userId ? g.hg : g.ag), 0),
    against: own.reduce((v, g) => v + (g.home === s.userId ? g.ag : g.hg), 0),
    balance: club(s).balance,
  };
  s.reports.push(report);
  log(s, "report", `${report.half} 종료 · ${pos}위, 승점 ${report.points}`, {
    report,
  });
  generateOffers(s);
  createDecisions(s);
}
function financeHalf(s) {
  for (const id of s.activeIds) {
    const c = club(s, id),
      m = manager(s, id);
    account(s, id, 45, "중계권");
    account(s, id, round(9 + (c.rep - 60) * 0.8 + c.fans * 0.04), "스폰서");
    account(
      s,
      id,
      round(((c.capacity * 9.5 * 55) / 1e6) * (0.8 + c.fans / 250)),
      "입장 수익",
    );
    account(s, id, -wages(s, id) * 26, "선수 급여");
    account(s, id, -(m?.wage ?? 0.04) * 26, "감독 급여");
    account(s, id, -(6 + c.capacity / 10000), "운영 비용");
    if (c.balance < 0) {
      const interest = Math.abs(c.balance) * 0.035;
      account(s, id, -interest, "차입 이자");
      c.debt = round(Math.abs(c.balance));
      c.fans = clamp(c.fans - 3, 10, 100);
      c.budget = 0;
    }
  }
}
function transfer(s, p, to, fee, kind = "영입") {
  const from = p.clubId;
  if (from === to) throw Error("이미 소속된 선수입니다.");
  const buyer = club(s, to),
    seller = club(s, from);
  if (buyer) {
    account(s, to, -fee, "선수 영입");
    buyer.budget = round(Math.max(0, buyer.budget - fee));
  }
  if (seller) {
    account(s, from, fee, "선수 판매");
    seller.budget = round(seller.budget + fee * 0.8);
  }
  p.clubId = to;
  p.morale = 80;
  p.listed = false;
  p.injury = 0;
  const item = {
    id: ++s.serial,
    year: s.year,
    phase: s.phase,
    playerId: p.id,
    name: p.name,
    from,
    to,
    fee: round(fee),
    kind,
  };
  s.transfers.unshift(item);
  if (from === s.userId || to === s.userId)
    log(
      s,
      "transfer",
      `${p.name} · ${to === s.userId ? kind : "이적"} £${fee.toFixed(1)}m`,
    );
  s.offers = s.offers.filter((o) => o.playerId !== p.id);
  return item;
}
function cpuMarket(s) {
  const all = new Map();
  for (const p of s.players) {
    if (p.retired) continue;
    if (!all.has(p.clubId)) all.set(p.clubId, []);
    all.get(p.clubId).push(p);
  }
  const eligible = s.players.filter(
    (p) =>
      !p.retired &&
      !p.unverifiedAffiliation &&
      !p.loanParent &&
      p.clubId !== s.userId &&
      p.ca >= 60 &&
      p.ca <= 89,
  );
  for (const id of s.activeIds) {
    if (id === s.userId) continue;
    const c = club(s, id);
    const roster = all.get(id) ?? [];
    const target = pick(s, ["GK", "DF", "MF", "FW"]);
    let candidates = [];
    for (let i = 0; i < 90; i++) {
      const p = pick(s, eligible);
      if (!p || p.clubId === id || p.clubId === s.userId) continue;
      const source = all.get(p.clubId) ?? [];
      if (p.clubId && source.length <= 19) continue;
      const fee = p.value * (p.listed ? 0.85 : 1.15);
      if (
        GROUP[p.pos] === target &&
        fee < c.budget * 0.7 &&
        fee < Math.max(0, c.balance - 8) &&
        p.wage + wages(s, id) < c.wageLimit &&
        p.ca < c.rep + 8
      )
        candidates.push(p);
    }
    if (candidates.length) {
      candidates.sort((a, b) => b.ca - a.ca);
      const p = candidates[0],
        old = p.clubId;
      transfer(s, p, id, round(p.value * 1.15), "AI 이적");
      all.set(
        old,
        (all.get(old) ?? []).filter((x) => x.id !== p.id),
      );
      roster.push(p);
      all.set(id, roster);
      p.contract = s.year + 3;
    }
    for (const p of roster)
      if (p.contract <= s.year + 1 && rng(s) < 0.8) {
        p.contract = s.year + 2 + Math.floor(rng(s) * 3);
        p.wage = round(p.wage * (0.95 + rng(s) * 0.15));
      }
    if (roster.length > 31) {
      const surplus = [...roster]
        .sort((a, b) => a.ca - b.ca)
        .find((p) => !p.loanParent);
      if (surplus) {
        const buyer = pick(
          s,
          s.clubs.filter(
            (x) =>
              x.id !== id &&
              x.id !== s.userId &&
              x.balance > surplus.value &&
              x.budget > surplus.value,
          ),
        );
        if (buyer)
          transfer(s, surplus, buyer.id, round(surplus.value * 0.8), "AI 판매");
      }
    }
    const pos = rank(s, id);
    if (s.round === 19 && pos > c.target + 6 && rng(s) < 0.2) {
      const old = manager(s, id),
        next =
          s.managers.find((m) => !m.clubId && m.rep > 60) ?? generateManager(s);
      if (old) {
        old.clubId = null;
        account(s, id, -old.wage * 26, "감독 위약금");
      }
      next.clubId = id;
      c.adaptation = 5;
    }
  }
}
function ensureCpuManagers(s) {
  for (const id of s.activeIds) {
    if (id === s.userId || manager(s, id)) continue;
    const m = s.managers.find((m) => !m.clubId) ?? generateManager(s);
    m.clubId = id;
    m.contract = s.year + 2;
  }
}
export function advance(s) {
  if (s.gameOver) throw Error("강등된 커리어입니다. 새 게임을 시작해 주세요.");
  if (s.phase === 0) {
    cpuMarket(s);
    ensureCpuManagers(s);
    s.phase = 1;
    simulateHalf(s, 0);
  } else if (s.phase === 1) {
    s.phase = 2;
    s.negotiations = {};
    log(s, "market", "겨울 이적시장이 열렸습니다.");
    createDecisions(s);
  } else if (s.phase === 2) {
    cpuMarket(s);
    ensureCpuManagers(s);
    s.phase = 3;
    simulateHalf(s, 19);
  } else if (s.phase === 3) {
    settle(s);
    s.phase = 4;
  } else nextSeason(s);
  return s;
}
export function settle(s) {
  if (s.settled) return;
  const standings = table(s),
    position = rank(s),
    c = club(s);
  const awards = s.players
    .filter((p) => p.stats.apps > 0)
    .sort(
      (a, b) =>
        b.stats.goals * 3 +
        b.stats.assists * 2 +
        b.ca * 0.1 -
        (a.stats.goals * 3 + a.stats.assists * 2 + a.ca * 0.1),
    );
  for (let i = 0; i < standings.length; i++) {
    const cc = club(s, standings[i].id);
    account(s, cc.id, round(8 + (20 - i) * 2.1), "리그 순위 상금");
    if (i < 5) account(s, cc.id, i === 0 ? 25 : 15, "유럽 진출 스폰서 보너스");
    cc.fans = clamp(cc.fans + (cc.target >= i + 1 ? 8 : -6), 10, 100);
    cc.rep = clamp(cc.rep + (cc.target >= i + 1 ? 1 : -1), 55, 95);
    cc.budget = round(
      Math.max(0, Math.min(cc.balance * 0.55, 15 + (cc.rep - 55) * 3)),
    );
  }
  const row = s.table[s.userId];
  const ledger = s.ledger.filter((l) => l.year === s.year);
  const income = round(
      ledger.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0),
    ),
    expenses = -round(
      ledger.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0),
    );
  const own = squad(s, s.userId).sort(
    (a, b) =>
      b.stats.goals * 3 +
      b.stats.assists * 2 +
      b.ca * 0.1 -
      (a.stats.goals * 3 + a.stats.assists * 2 + a.ca * 0.1),
  );
  const summary = {
    year: s.year,
    position,
    points: row.pts,
    w: row.w,
    d: row.d,
    l: row.l,
    gf: row.gf,
    ga: row.ga,
    target: c.target,
    achieved: position <= c.target,
    income,
    expenses,
    balance: c.balance,
    champion: club(s, standings[0].id).ko,
    mvp: own[0]
      ? { id: own[0].id, name: own[0].name, stats: { ...own[0].stats } }
      : null,
    topScorer: awards[0]
      ? { name: awards[0].name, goals: awards[0].stats.goals }
      : null,
    manager: manager(s)?.name,
    standings: structuredClone(standings),
    relegated: standings.slice(-3).map((t) => t.id),
    bestPlayers: own.slice(0, 5).map((p) => ({ name: p.name, ...p.stats })),
    managerRating: position <= c.target ? "목표 달성" : "목표 미달",
  };
  s.history.push(summary);
  s.settled = true;
  s.gameOver = position >= 18;
  log(
    s,
    "season",
    s.gameOver
      ? `${position}위 강등 · 커리어 종료`
      : `${s.year}/${String(s.year + 1).slice(-2)} 시즌 ${position}위 · ${summary.achieved ? "목표 달성" : "목표 미달"}`,
  );
  return summary;
}
function generateYouth(s, cid, n) {
  const c = club(s, cid);
  const id = `gen-${s.year}-${s.serial++}-${n}`;
  const ca = clamp(43 + Math.floor(rng(s) * 17) + c.academy * 2, 40, 70);
  const p = {
    id,
    name: `${pick(s, ["Oliver", "Lucas", "Noah", "Leo", "Hugo", "Adam", "Theo", "Milan", "Oscar", "Ethan", "Samuel", "Arthur", "Luca", "James", "Isaac", "Thomas"])} ${pick(s, ["Wilson", "Walker", "Martins", "Costa", "Laurent", "Bauer", "Silva", "Bennett", "Cole", "Moreau", "Rossi", "King", "Young", "Davis", "Wright", "Smith"])}`,
    nat: "가상",
    dob: null,
    age: 17,
    clubId: cid,
    pos: pick(s, ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"]),
    secondary: [],
    ca,
    pa: clamp(ca + 15 + Math.floor(rng(s) * 17) + c.academy, 60, 96),
    value: round(0.12 + ca / 100),
    wage: 0.002,
    contract: s.year + 3,
    real: false,
    source: "generated",
    morale: 80,
    fitness: 100,
    injury: 0,
    stats: emptyStats(),
    career: { apps: 0, goals: 0, assists: 0 },
    trend: 0,
    listed: false,
    loanParent: null,
    retired: false,
  };
  s.players.push(p);
  return p;
}
function nextSeason(s) {
  if (!s.settled) throw Error("시즌 결산이 필요합니다.");
  const relegated = table(s)
    .slice(-3)
    .map((t) => t.id);
  const pool = s.lowerIds.filter((id) => !s.activeIds.includes(id));
  const scored = pool
    .map((id) => ({ id, score: club(s, id).rep + rng(s) * 20 }))
    .sort((a, b) => b.score - a.score);
  const promoted = scored.slice(0, 3).map((x) => x.id);
  if (promoted.length !== 3) throw Error("승격 후보 구단이 부족합니다.");
  s.activeIds = s.activeIds
    .filter((id) => !relegated.includes(id))
    .concat(promoted);
  s.lowerIds = [
    ...s.lowerIds.filter((id) => !promoted.includes(id)),
    ...relegated,
  ];
  s.year++;
  s.phase = 0;
  s.round = 0;
  s.settled = false;
  s.decisions = [];
  s.offers = [];
  s.negotiations = {};
  const foreignCounts = new Map();
  for (const p of s.players)
    if (!p.retired && p.clubId && !s.activeIds.includes(p.clubId))
      foreignCounts.set(p.clubId, (foreignCounts.get(p.clubId) ?? 0) + 1);
  for (const p of s.players) {
    if (p.retired) continue;
    const old = p.ca;
    const m = manager(s, p.clubId);
    const cc = club(s, p.clubId);
    if (p.age !== null) p.age++;
    const apps = p.stats.apps;
    for (const k of ["apps", "goals", "assists"]) p.career[k] += p.stats[k];
    if (p.age !== null && p.age < 26) {
      const gain =
        ((rng(s) * 1.5 + (apps > 15 ? 1.4 : 0.1) + (cc?.academy ?? 1) * 0.18) *
          (m?.youth ?? 70)) /
        75;
      p.ca = Math.min(p.pa, p.ca + Math.round(gain));
    } else if (p.age !== null && p.age > 29)
      p.ca = Math.max(
        28,
        p.ca - Math.round((p.age - 29) * 0.32 + rng(s) * 1.3),
      );
    p.trend = p.ca - old;
    p.value = round(
      clamp(
        p.value *
          (1 + (p.ca - old) * 0.07 + (apps > 20 ? 0.04 : -0.04)) *
          (p.age !== null && p.age > 30 ? 0.88 : 1),
        0.05,
        230,
      ),
    );
    if (p.loanParent) {
      p.clubId = p.loanParent;
      p.loanParent = null;
    }
    if (
      p.age !== null &&
      (p.age > 40 || (p.age > 34 && rng(s) < (p.age - 33) * 0.055))
    ) {
      p.retired = true;
      if (p.clubId === s.userId) log(s, "contract", `${p.name} 은퇴`);
      p.clubId = null;
    } else if (
      p.contract <= s.year &&
      p.clubId &&
      p.clubId !== s.userId &&
      rng(s) < 0.9
    ) {
      // Foreign clubs renew independently; the whole overseas market must not expire together.
      p.contract = s.year + 2 + Math.floor(rng(s) * 4);
      p.wage = round(p.wage * (1 + rng(s) * 0.08));
    } else if (p.contract <= s.year) {
      if (p.clubId === s.userId)
        log(s, "contract", `${p.name}, 계약 만료로 자유계약 전환`);
      p.clubId = null;
      p.listed = false;
    }
    p.stats = emptyStats();
    p.injury = Math.max(0, p.injury - 8);
    p.fitness = 100;
    p.morale = 75;
  }
  for (const c of s.clubs) {
    c.invested = [];
    if (s.activeIds.includes(c.id)) {
      c.morale = 70;
      c.adaptation = 0;
      c.wageLimit = round(Math.max(0.65, (c.rep - 52) * 0.09));
      if (promoted.includes(c.id)) {
        account(s, c.id, 65, "승격 중계권 선지급");
        c.budget = Math.max(c.budget, 35);
        c.target = 17;
      }
      for (let i = 0; i < 3 + c.academy; i++) generateYouth(s, c.id, i);
      let r = squad(s, c.id);
      for (let i = r.length; i < 23; i++) generateYouth(s, c.id, i);
      c.target =
        c.id === s.userId
          ? clamp(c.target, 1, 17)
          : clamp(Math.round((93 - c.rep) * 0.6 + 1), 1, 17);
    }
  }
  // Keep the major overseas talent pools alive without simulating their fixtures.
  for (const [id, count] of foreignCounts)
    if (count >= 12 && club(s, id)) {
      generateYouth(s, id, 0);
      if (count < 18) generateYouth(s, id, 1);
    }
  for (const m of s.managers) {
    if (m.age !== null) m.age++;
    if (m.clubId && m.contract <= s.year) {
      if (m.clubId === s.userId) {
        log(s, "manager", `${m.name} 감독의 계약이 종료되었습니다.`);
        s.managerHistory.push({
          year: s.year,
          phase: 0,
          name: m.name,
          action: "계약 만료",
        });
      }
      m.clubId = null;
    }
  }
  ensureManagers(s, true);
  s.fixtures = fixtures(s.activeIds, s.year, s);
  s.table = emptyTable(s.activeIds);
  log(
    s,
    "league",
    `승격: ${promoted.map((id) => club(s, id).ko).join(", ")} · 강등: ${relegated.map((id) => club(s, id).ko).join(", ")}`,
  );
  createDecisions(s);
  if (s.year % 5 === 0) {
    s.players = s.players.filter((p) => !p.retired || p.career.apps > 0);
    s.ledger = s.ledger.filter((l) => l.year >= s.year - 5);
  }
  return s;
}
export function offerTransfer(
  s,
  playerId,
  { fee, wage, years = 3, loan = false },
) {
  if (!marketOpen(s)) throw Error("이적시장 개방 기간에만 제안할 수 있습니다.");
  const p = s.players.find((x) => x.id === playerId),
    c = club(s);
  if (!p || p.retired) throw Error("선수를 찾을 수 없습니다.");
  if (p.unverifiedAffiliation)
    throw Error("현재 소속을 확인할 수 없는 선수입니다.");
  if (p.clubId === s.userId || p.loanParent)
    throw Error("협상할 수 없는 선수입니다.");
  if (
    !Number.isFinite(fee) ||
    !Number.isFinite(wage) ||
    fee < 0 ||
    wage < 0.001 ||
    years < 1 ||
    years > 5
  )
    throw Error("제안 금액과 계약 기간을 확인해 주세요.");
  if (squad(s, s.userId).length >= 40)
    throw Error("선수단 40명 한도입니다. 선수를 먼저 판매해 주세요.");
  const cost = p.clubId
    ? loan
      ? round(p.value * 0.08)
      : fee
    : round(Math.max(0.1, p.value * 0.035));
  if (cost > c.budget || cost > Math.max(0, c.balance))
    throw Error("이적 예산 또는 가용 자금이 부족합니다.");
  if (wages(s) + (loan ? p.wage * 0.5 : wage) > c.wageLimit)
    throw Error("임금 예산을 초과합니다.");
  const attempts = s.negotiations[p.id] ?? 0;
  if (attempts >= 3)
    throw Error("이 선수와의 협상은 다음 이적시장에서 재개할 수 있습니다.");
  s.negotiations[p.id] = attempts + 1;
  const seller = club(s, p.clubId);
  const minFee =
    p.value *
    (p.listed ? 0.85 : 1.08) *
    (squad(s, p.clubId).length < 21 ? 1.3 : 1);
  const minWage = p.wage * (p.clubId ? 1.08 : 1);
  const ambition = clamp(1 + (c.rep - p.ca) * 0.022, 0.22, 0.97);
  const salary = clamp(wage / Math.max(0.001, minWage), 0.05, 1.15);
  const clubAcceptance = !seller || loan || fee >= minFee * 0.88;
  let chance = clamp(
    ambition * salary * (clubAcceptance ? 1 : 0.18),
    0.03,
    0.98,
  );
  if (years === 1 && p.age !== null && p.age < 28) chance *= 0.85;
  if (loan && p.ca > c.rep + 4) chance *= 0.45;
  if (!clubAcceptance || rng(s) > chance) {
    p.morale = clamp(p.morale - 1, 20, 100);
    const reason = !clubAcceptance
      ? "판매 구단이 이적료 상향을 요구합니다."
      : wage < minWage
        ? "선수 측이 급여 인상을 요구합니다."
        : p.ca > c.rep + 4
          ? "선수가 더 높은 수준의 구단을 원합니다."
          : "선수 측이 제안을 거절했습니다.";
    log(s, "negotiation", `${p.name}: ${reason}`);
    return {
      ok: false,
      message: reason,
      counterFee: round(minFee),
      counterWage: round(minWage),
      remaining: 2 - attempts,
    };
  }
  if (loan) {
    const parent = p.clubId;
    if (!parent) throw Error("자유계약 선수는 임대할 수 없습니다.");
    account(s, s.userId, -cost, "임대 수수료");
    account(s, parent, cost, "임대 수익");
    c.budget = round(c.budget - cost);
    p.loanParent = parent;
    p.clubId = s.userId;
    p.morale = 80;
    s.transfers.unshift({
      id: ++s.serial,
      year: s.year,
      phase: s.phase,
      playerId: p.id,
      name: p.name,
      from: parent,
      to: s.userId,
      fee: cost,
      kind: "임대 영입",
    });
    log(s, "transfer", `${p.name} 시즌 임대 영입`);
  } else {
    transfer(s, p, s.userId, cost, p.clubId ? "영입" : "자유계약");
    p.wage = round(wage);
    p.contract = s.year + years;
  }
  return { ok: true, message: `${p.name}, 영입을 완료했습니다.` };
}
export function renewPlayer(s, id, wage, years) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.clubId !== s.userId || p.loanParent)
    throw Error("재계약할 수 없는 선수입니다.");
  if (!Number.isFinite(wage) || wage <= 0 || years < 1 || years > 5)
    throw Error("계약 조건을 확인해 주세요.");
  if (wages(s) - p.wage + wage > club(s).wageLimit)
    throw Error("임금 예산이 부족합니다.");
  const wanted = round(p.wage * (1.05 + (p.ca > club(s).rep ? 0.15 : 0)));
  if (wage < wanted * 0.95 || rng(s) > 0.94) {
    p.morale = clamp(p.morale - 5, 20, 100);
    return {
      ok: false,
      message: `선수 측 요구 주급: £${Math.ceil(wanted * 1e6).toLocaleString()}`,
    };
  }
  const signing = round(wage * 8);
  if (club(s).balance < signing)
    throw Error("계약 보너스를 지급할 자금이 부족합니다.");
  account(s, s.userId, -signing, "계약 보너스");
  p.wage = round(wage);
  p.contract = s.year + years;
  p.morale = 90;
  log(s, "contract", `${p.name}, ${p.contract}년까지 재계약`);
  return { ok: true, message: "재계약을 완료했습니다." };
}
export function listPlayer(s, id) {
  if (!marketOpen(s)) throw Error("이적시장 기간에만 명단을 바꿀 수 있습니다.");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.clubId !== s.userId || p.loanParent)
    throw Error("등록할 수 없는 선수입니다.");
  p.listed = !p.listed;
  if (p.listed) {
    p.morale = clamp(p.morale - 7, 20, 100);
    makeOffer(s, p);
  }
  return p.listed;
}
function makeOffer(s, p) {
  if (s.offers.some((o) => o.playerId === p.id)) return;
  const buyers = s.clubs.filter(
    (c) =>
      c.id !== s.userId &&
      c.balance > p.value * 0.7 &&
      c.budget > p.value * 0.7 &&
      c.rep > p.ca - 18,
  );
  if (!buyers.length) return;
  const buyer = pick(s, buyers);
  s.offers.push({
    id: "bid-" + ++s.serial,
    playerId: p.id,
    buyerId: buyer.id,
    fee: round(p.value * (0.72 + rng(s) * 0.5)),
    year: s.year,
  });
}
function generateOffers(s) {
  s.offers = [];
  const r = squad(s, s.userId).filter((p) => !p.loanParent);
  for (const p of r.filter((p) => p.listed)) makeOffer(s, p);
  for (let i = 0; i < 2; i++) {
    const p = pick(s, r);
    if (p) makeOffer(s, p);
  }
}
export function respondOffer(s, id, accept) {
  if (!marketOpen(s)) throw Error("이적시장 기간에 처리해 주세요.");
  const o = s.offers.find((x) => x.id === id);
  if (!o) throw Error("만료된 제안입니다.");
  if (accept) {
    const p = s.players.find((x) => x.id === o.playerId);
    if (!p || p.clubId !== s.userId || p.loanParent)
      throw Error("현재 소속 선수가 아닙니다.");
    if (squad(s, s.userId).length <= 18)
      throw Error("최소 18명의 선수를 유지해야 합니다.");
    if (p.ca > club(s).rep) club(s).fans = clamp(club(s).fans - 5, 10, 100);
    transfer(s, p, o.buyerId, o.fee, "판매");
  }
  s.offers = s.offers.filter((x) => x.id !== id);
}
export function loanOut(s, id) {
  if (!marketOpen(s)) throw Error("이적시장 기간에만 임대할 수 있습니다.");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.clubId !== s.userId || p.loanParent)
    throw Error("임대할 수 없는 선수입니다.");
  if (squad(s, s.userId).length <= 18)
    throw Error("최소 18명의 선수를 유지해야 합니다.");
  const c = pick(
    s,
    s.clubs.filter(
      (c) => c.id !== s.userId && c.rep < p.ca + 10 && c.rep > p.ca - 15,
    ),
  );
  if (!c) throw Error("임대에 관심을 가진 구단이 없습니다.");
  p.loanParent = s.userId;
  p.clubId = c.id;
  account(s, s.userId, p.value * 0.06, "임대 수익");
  account(s, c.id, -p.value * 0.06, "임대 수수료");
  s.transfers.unshift({
    id: ++s.serial,
    year: s.year,
    phase: s.phase,
    playerId: p.id,
    name: p.name,
    from: s.userId,
    to: c.id,
    fee: round(p.value * 0.06),
    kind: "임대 방출",
  });
  log(s, "transfer", `${p.name}, ${c.ko}로 시즌 임대`);
  return c.ko;
}
export function releasePlayer(s, id) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  const p = s.players.find((x) => x.id === id);
  if (!p || p.clubId !== s.userId || p.loanParent)
    throw Error("계약 해지할 수 없는 선수입니다.");
  if (squad(s, s.userId).length <= 18)
    throw Error("최소 18명의 선수를 유지해야 합니다.");
  const cost = round(p.wage * 26 * Math.max(1, p.contract - s.year));
  account(s, s.userId, -cost, "계약 해지 보상");
  p.clubId = null;
  p.listed = false;
  s.transfers.unshift({
    id: ++s.serial,
    year: s.year,
    phase: s.phase,
    playerId: p.id,
    name: p.name,
    from: s.userId,
    to: null,
    fee: -cost,
    kind: "계약 해지",
  });
  log(s, "contract", `${p.name}, 보상금 £${cost.toFixed(1)}m에 계약 해지`);
  return cost;
}
export function sackManager(s) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  const m = manager(s);
  if (!m) throw Error("감독이 없습니다.");
  const fee = round(
    m.wage * 26 * Math.max(1, (m.contract ?? s.year + 1) - s.year),
  );
  account(s, s.userId, -fee, "감독 위약금");
  m.clubId = null;
  club(s).adaptation = 7;
  club(s).morale = clamp(club(s).morale - 7, 25, 98);
  s.managerHistory.push({
    year: s.year,
    phase: s.phase,
    name: m.name,
    action: "경질",
    fee,
  });
  log(s, "manager", `${m.name} 감독 경질 · 위약금 £${fee.toFixed(1)}m`);
  return fee;
}
export function hireManager(s, id, wage, years = 3) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  if (manager(s)) throw Error("현재 감독의 계약을 먼저 정리해 주세요.");
  const m = s.managers.find((m) => m.id === id);
  if (!m || m.clubId === s.userId) throw Error("선임할 수 없는 감독입니다.");
  if (!Number.isFinite(wage) || wage < m.wage || years < 1 || years > 5)
    throw Error("감독의 요구 조건을 충족해 주세요.");
  const fee = m.clubId ? round(m.wage * 52) : round(m.wage * 8);
  if (club(s).balance < fee) throw Error("선임 비용이 부족합니다.");
  if (m.rep > club(s).rep + 8 && rng(s) < 0.7)
    return { ok: false, message: "감독이 더 높은 수준의 구단을 선호합니다." };
  const old = m.clubId;
  account(s, s.userId, -fee, m.clubId ? "감독 보상금" : "감독 계약금");
  if (old) account(s, old, fee, "감독 보상 수익");
  m.clubId = s.userId;
  m.wage = round(wage);
  m.contract = s.year + years;
  m.relationship = 75;
  club(s).adaptation = 5;
  s.managerHistory.push({
    year: s.year,
    phase: s.phase,
    name: m.name,
    action: "선임",
    fee,
  });
  log(s, "manager", `${m.name} 감독 선임`);
  return { ok: true, message: "감독을 선임했습니다." };
}
export function renewManager(s, wage, years) {
  const m = manager(s);
  if (s.gameOver || !m) throw Error("재계약할 감독이 없습니다.");
  if (wage < m.wage * 1.05 || !Number.isFinite(wage) || years < 1 || years > 5)
    return { ok: false, message: "현재 급여보다 5% 높은 조건을 요구합니다." };
  m.wage = round(wage);
  m.contract = s.year + years;
  m.relationship = clamp(m.relationship + 10, 0, 100);
  log(s, "manager", `${m.name} 감독 재계약 · ${m.contract}년까지`);
  return { ok: true, message: "감독과 재계약했습니다." };
}
export function invest(s, type) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  const c = club(s),
    cost = { academy: 8, facilities: 6, stadium: 15 }[type];
  if (!cost) throw Error("잘못된 투자입니다.");
  if (c.invested.includes(type))
    throw Error("이 투자는 다음 시즌에 다시 가능합니다.");
  if (c.balance < cost || c.budget < cost)
    throw Error("투자할 자금이 부족합니다.");
  account(s, s.userId, -cost, "시설 투자");
  c.budget = round(c.budget - cost);
  c[type]++;
  c.invested.push(type);
  if (type === "stadium") {
    c.capacity += 4500;
    c.fans = clamp(c.fans + 4, 10, 100);
  }
  log(
    s,
    "investment",
    `${{ academy: "유소년 아카데미", facilities: "훈련 시설", stadium: "경기장" }[type]} 투자 완료`,
  );
}
export function setTarget(s, n) {
  if (!marketOpen(s)) throw Error("시장 개방 기간에 목표를 바꿀 수 있습니다.");
  if (!Number.isInteger(n) || n < 1 || n > 17)
    throw Error("목표를 확인해 주세요.");
  club(s).target = n;
}
function decision(s, type, title, description, choices, payload = {}) {
  return {
    id: "decision-" + ++s.serial,
    type,
    title,
    description,
    choices,
    payload,
    year: s.year,
    resolved: false,
  };
}
function createDecisions(s) {
  s.decisions = s.decisions
    .filter((d) => !d.resolved && d.year === s.year)
    .slice(0, 2);
  const c = club(s),
    r = squad(s, s.userId),
    m = manager(s);
  const talent = [...r].sort((a, b) => b.ca - a.ca)[0];
  const seen = new Set(s.decisions.map((d) => d.type));
  const defs = [];
  if (talent && !talent.loanParent)
    defs.push(
      decision(
        s,
        "raise",
        `${talent.name}의 급여 요구`,
        `${talent.stats.goals}골 · 능력 ${talent.ca}. 에이전트가 주급 20% 인상을 요청했습니다.`,
        [
          { label: "인상 수용", effect: "급여 +20% · 선수 사기 +15" },
          { label: "현 계약 유지", effect: "선수 사기 −12 · 감독 관계 −3" },
        ],
        { playerId: talent.id },
      ),
    );
  defs.push(
    decision(
      s,
      "scout",
      "감독의 보강 요청",
      `${m?.name ?? "코칭스태프"}: ${pick(s, ["수비진의 속도", "중원의 창의성", "공격진의 결정력", "골키퍼 경쟁"])} 보강이 필요합니다.`,
      [
        { label: "스카우팅 지원 £2m", effect: "예산 −2m · 감독 관계 +12" },
        { label: "현재 선수단 활용", effect: "감독 관계 −8 · 유망주 사기 +4" },
      ],
    ),
  );
  defs.push(
    decision(
      s,
      "sponsor",
      "새로운 지역 파트너",
      `${c.ko}의 지역 기업이 유소년 연계 후원과 상업 후원을 제안했습니다.`,
      [
        { label: "상업 후원 £5m", effect: "현금 +5m · 예산 +3m · 팬 −4" },
        { label: "유소년 파트너십", effect: "현금 +2m · 아카데미 +1" },
      ],
    ),
  );
  if (c.morale < 65)
    defs.push(
      decision(
        s,
        "morale",
        "선수단 분위기 회복",
        "최근 결과에 선수단의 자신감이 흔들리고 있습니다.",
        [
          { label: "팀 빌딩 £1m", effect: "현금 −1m · 팀 분위기 +12" },
          { label: "감독에게 일임", effect: "팀 분위기 +3 · 감독 관계 +4" },
        ],
      ),
    );
  defs.push(
    decision(
      s,
      "fan",
      "서포터스와의 대화",
      c.target <= 6
        ? "팬들이 유럽대항전 도전을 기대하고 있습니다."
        : "팬들이 장기적인 잔류 전략을 듣고 싶어 합니다.",
      [
        { label: "지역사회 투자 £1.5m", effect: "현금 −1.5m · 팬 +10" },
        { label: "스포츠 성적에 집중", effect: "팀 분위기 +3 · 팬 −3" },
      ],
    ),
  );
  defs.push(
    decision(
      s,
      "academy",
      "유소년의 1군 합류",
      `${c.ko} 아카데미가 선수단과 함께 훈련할 기회를 요청했습니다.`,
      [
        { label: "훈련 지원 £0.8m", effect: "예산 −0.8m · 어린 선수 능력 +1" },
        { label: "기존 시설 활용", effect: "어린 선수 사기 +3" },
      ],
    ),
  );
  defs.push(
    decision(
      s,
      "media",
      "언론의 감독 평가",
      `${m?.name ?? "감독 대행"}의 운영 방향에 대해 구단주의 입장을 묻고 있습니다.`,
      [
        { label: "공개적으로 신뢰", effect: "감독 관계 +8 · 팀 분위기 +4" },
        { label: "결과로 증명 요구", effect: "감독 관계 −5 · 팬 +3" },
      ],
    ),
  );
  defs.push(
    decision(
      s,
      "community",
      "시즌권 가격 조정",
      "새 시즌권 정책에 대한 상업팀 보고서가 도착했습니다.",
      [
        { label: "가격 동결", effect: "팬 +6 · 현금 −1m" },
        { label: "프리미엄 좌석 판매", effect: "현금 +3m · 팬 −5" },
      ],
    ),
  );
  for (let i = defs.length - 1; i > 0; i--) {
    const j = Math.floor(rng(s) * (i + 1));
    [defs[i], defs[j]] = [defs[j], defs[i]];
  }
  for (const d of defs) {
    if (s.decisions.length >= 4) break;
    if (!seen.has(d.type)) {
      s.decisions.push(d);
      seen.add(d.type);
    }
  }
}
export function resolveDecision(s, id, choice) {
  if (s.gameOver) throw Error("종료된 커리어입니다.");
  const d = s.decisions.find((x) => x.id === id);
  if (!d || d.resolved || ![0, 1].includes(choice))
    throw Error("이미 처리한 안건입니다.");
  const c = club(s),
    m = manager(s),
    r = squad(s, s.userId),
    a = choice === 0;
  const pay = (amount) => {
    account(s, s.userId, -amount, "구단주 의사결정");
    c.budget = round(Math.max(0, c.budget - amount));
  };
  if (d.type === "raise") {
    const p = r.find((p) => p.id === d.payload.playerId);
    if (p) {
      if (a && wages(s) + p.wage * 0.2 > c.wageLimit)
        throw Error("임금 예산이 부족합니다.");
      if (a) p.wage = round(p.wage * 1.2);
      p.morale = clamp(p.morale + (a ? 15 : -12), 10, 100);
    }
    if (m && !a) m.relationship = clamp(m.relationship - 3, 0, 100);
  }
  if (d.type === "scout") {
    if (a) {
      pay(2);
      if (m) m.relationship = clamp(m.relationship + 12, 0, 100);
    } else {
      if (m) m.relationship = clamp(m.relationship - 8, 0, 100);
      r.filter((p) => p.age !== null && p.age < 23).forEach(
        (p) => (p.morale = clamp(p.morale + 4, 10, 100)),
      );
    }
  }
  if (d.type === "sponsor") {
    account(s, s.userId, a ? 5 : 2, "스폰서");
    if (a) {
      c.budget += 3;
      c.fans = clamp(c.fans - 4, 10, 100);
    } else c.academy++;
  }
  if (d.type === "morale") {
    if (a) pay(1);
    c.morale = clamp(c.morale + (a ? 12 : 3), 10, 100);
    if (m && !a) m.relationship = clamp(m.relationship + 4, 0, 100);
  }
  if (d.type === "fan") {
    if (a) pay(1.5);
    c.fans = clamp(c.fans + (a ? 10 : -3), 10, 100);
    if (!a) c.morale = clamp(c.morale + 3, 10, 100);
  }
  if (d.type === "academy") {
    if (a) pay(0.8);
    r.filter((p) => p.age !== null && p.age < 22).forEach((p) => {
      if (a) p.ca = Math.min(p.pa, p.ca + 1);
      else p.morale = clamp(p.morale + 3, 10, 100);
    });
  }
  if (d.type === "media") {
    if (m) m.relationship = clamp(m.relationship + (a ? 8 : -5), 0, 100);
    if (a) c.morale = clamp(c.morale + 4, 10, 100);
    else c.fans = clamp(c.fans + 3, 10, 100);
  }
  if (d.type === "community") {
    if (a) pay(1);
    else account(s, s.userId, 3, "프리미엄 좌석");
    c.fans = clamp(c.fans + (a ? 6 : -5), 10, 100);
  }
  d.resolved = true;
  d.choice = choice;
  log(s, "decision", `${d.title} · ${d.choices[choice].label}`);
}
/** Recompute all league totals and goal records to detect saves or code that violate invariants. */
export function validateSeason(s) {
  const errors = [],
    check = emptyTable(s.activeIds);
  const pair = new Set(),
    goalsByPlayer = new Map(),
    assistsByPlayer = new Map();
  let played = 0;
  for (const g of s.fixtures) {
    const key = g.home + "-" + g.away;
    if (pair.has(key)) errors.push("중복 대진 " + key);
    pair.add(key);
    if (g.home === g.away || !check[g.home] || !check[g.away])
      errors.push("잘못된 구단");
    if (g.hg === null) {
      if (g.ag !== null) errors.push("부분 결과");
      continue;
    }
    played++;
    for (const [id, gf, ga] of [
      [g.home, g.hg, g.ag],
      [g.away, g.ag, g.hg],
    ]) {
      const t = check[id];
      t.p++;
      t.gf += gf;
      t.ga += ga;
      if (gf > ga) {
        t.w++;
        t.pts += 3;
      } else if (gf === ga) {
        t.d++;
        t.pts++;
      } else t.l++;
    }
    if (g.events.length !== g.hg + g.ag) errors.push("득점 사건 불일치");
    if (g.events.filter((e) => e.home).length !== g.hg)
      errors.push("홈 득점 불일치");
    for (const e of g.events) {
      goalsByPlayer.set(e.playerId, (goalsByPlayer.get(e.playerId) ?? 0) + 1);
      if (e.assistId)
        assistsByPlayer.set(
          e.assistId,
          (assistsByPlayer.get(e.assistId) ?? 0) + 1,
        );
    }
  }
  if (s.fixtures.length !== 380) errors.push("시즌 380경기 아님");
  for (const id of s.activeIds)
    for (const k of ["p", "w", "d", "l", "gf", "ga", "pts"])
      if (check[id][k] !== s.table[id][k]) errors.push(`${id} ${k} 불일치`);
  for (const p of s.players) {
    if (p.stats.goals !== (goalsByPlayer.get(p.id) ?? 0))
      errors.push("개인 득점 불일치 " + p.id);
    if (p.stats.assists !== (assistsByPlayer.get(p.id) ?? 0))
      errors.push("개인 도움 불일치 " + p.id);
    if (p.stats.starts > p.stats.apps) errors.push("선발 기록 불일치");
  }
  if (new Set(s.activeIds).size !== 20) errors.push("리그 20개 아님");
  return { ok: errors.length === 0, errors, played };
}
