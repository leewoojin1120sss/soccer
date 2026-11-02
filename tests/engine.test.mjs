import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as E from "../src/engine.js";
import { assertSave } from "../src/storage.js";
const data = {};
for (const n of ["meta", "players", "clubs", "managers"])
  data[n] = JSON.parse(
    await readFile(new URL(`../data/${n}.json`, import.meta.url)),
  );
const make = (id = "c281", seed = 1120) => E.newGame(data, id, seed);
const finish = (s) => {
  while (s.phase !== 4 && !s.gameOver) E.advance(s);
  return s;
};
test("verified 2026/27 membership, distinct real IDs, first teams and provenance", () => {
  assert.equal(data.meta.eplIds.length, 20);
  assert(data.meta.eplIds.includes("c990"));
  assert(data.meta.eplIds.includes("c3008"));
  assert(!data.meta.eplIds.includes("c379"));
  assert(data.players.length > 20000);
  assert.equal(
    new Set(data.players.map((p) => p.id)).size,
    data.players.length,
  );
  assert(data.players.every((p) => p.real && p.name && p.source));
  for (const id of data.meta.eplIds) {
    assert(data.players.filter((p) => p.clubId === id).length >= 20);
    assert.equal(data.managers.filter((m) => m.clubId === id).length, 1);
  }
  assert.equal(data.players.filter((p) => p.id === "tm105470").length, 1);
});
test("circle fixture generation: 380 unique matches, 19 home and away, every pair twice", () => {
  const s = make();
  assert.equal(s.fixtures.length, 380);
  for (const id of s.activeIds) {
    assert.equal(s.fixtures.filter((g) => g.home === id).length, 19);
    assert.equal(s.fixtures.filter((g) => g.away === id).length, 19);
    for (let r = 1; r <= 38; r++)
      assert.equal(
        s.fixtures.filter(
          (g) => g.round === r && (g.home === id || g.away === id),
        ).length,
        1,
      );
  }
  assert.equal(new Set(s.fixtures.map((g) => g.home + "|" + g.away)).size, 380);
});
test("exact five phases, 19+19 games, points, goals and financial settlement agree", () => {
  const s = make();
  E.advance(s);
  assert.equal(s.phase, 1);
  assert.equal(s.round, 19);
  assert(E.table(s).every((t) => t.p === 19));
  assert.deepEqual(E.validateSeason(s).errors, []);
  const fixtures = s.fixtures.filter((g) => g.hg !== null).length;
  E.advance(s);
  assert.equal(s.phase, 2);
  assert.equal(s.fixtures.filter((g) => g.hg !== null).length, fixtures);
  E.advance(s);
  assert.equal(s.phase, 3);
  assert.equal(s.round, 38);
  assert(E.table(s).every((t) => t.p === 38));
  assert(E.validateSeason(s).ok);
  E.advance(s);
  assert.equal(s.phase, 4);
  assert.equal(s.history.length, 1);
  assert.equal(s.gameOver, E.rank(s) >= 18);
  const c = E.club(s).balance;
  E.settle(s);
  assert.equal(E.club(s).balance, c);
  assert.equal(s.history.length, 1);
  assert(s.ledger.some((l) => l.category === "선수 급여"));
  assert.equal(
    s.fixtures.reduce((a, g) => a + g.hg + g.ag, 0),
    s.players.reduce((a, p) => a + p.stats.goals, 0),
  );
});
test("reproducible seed and independently changing match results", () => {
  const a = make("c1237", 173),
    b = make("c1237", 173),
    c = make("c1237", 174);
  E.advance(a);
  E.advance(b);
  E.advance(c);
  assert.deepEqual(a.table, b.table);
  assert.notDeepEqual(a.table, c.table);
});
test("transfer negotiation changes roster, wages, budget and starting team; failed offers charge nothing", () => {
  const s = make();
  let p = s.players.find(
    (p) =>
      p.clubId !== s.userId &&
      !p.unverifiedAffiliation &&
      !p.loanParent &&
      p.ca >= 70 &&
      p.ca < 76 &&
      p.pos === "ST" &&
      p.value < 15,
  );
  const c = E.club(s),
    cash = c.balance,
    budget = c.budget;
  const fail = E.offerTransfer(s, p.id, { fee: 0, wage: 0.001, years: 1 });
  assert(!fail.ok);
  assert.equal(c.balance, cash);
  assert.equal(c.budget, budget);
  let result;
  for (let i = 0; i < 2; i++) {
    result = E.offerTransfer(s, p.id, {
      fee: p.value * 2,
      wage: Math.max(0.025, p.wage * 2),
      years: 4,
    });
    if (result.ok) break;
  }
  assert(result.ok);
  assert.equal(p.clubId, s.userId);
  assert(c.balance < cash);
  assert(c.budget < budget);
  assert.equal(p.contract, 2030);
  assert(E.squad(s, s.userId).some((x) => x.id === p.id));
  E.advance(s);
  assert.throws(
    () =>
      E.offerTransfer(s, s.players.find((x) => x.clubId !== s.userId).id, {
        fee: 1,
        wage: 0.01,
        years: 3,
      }),
    /기간/,
  );
});
test("unknown affiliation is not treated as a freely signable real player", () => {
  const s = make();
  const p = s.players.find((p) => p.unverifiedAffiliation);
  assert(p);
  assert.throws(
    () => E.offerTransfer(s, p.id, { fee: 0, wage: 0.02, years: 3 }),
    /확인/,
  );
});
test("sales and loans update actual ownership and cash; contracts can be renewed or expire", () => {
  const s = make();
  const roster = E.squad(s, s.userId),
    p = roster.find((p) => p.age && p.age < 26 && !p.loanParent);
  const before = E.club(s).balance;
  E.listPlayer(s, p.id);
  const o = s.offers.find((o) => o.playerId === p.id);
  assert(o);
  E.respondOffer(s, o.id, true);
  assert.equal(p.clubId, o.buyerId);
  assert(E.club(s).balance > before);
  const q = E.squad(s, s.userId).find(
    (p) => p.age && p.age < 25 && !p.loanParent,
  );
  let result = E.renewPlayer(s, q.id, q.wage * 1.4, 5);
  if (!result.ok) result = E.renewPlayer(s, q.id, q.wage * 1.4, 5);
  assert(result.ok);
  assert.equal(q.contract, 2031);
  E.loanOut(s, q.id);
  assert.equal(q.loanParent, s.userId);
  assert.notEqual(q.clubId, s.userId);
  finish(s);
  assert(!s.gameOver);
  E.advance(s);
  assert.equal(q.clubId, s.userId);
  assert.equal(q.loanParent, null);
  assert.equal(q.stats.apps, 0);
});
test("injured star cannot play, manager selection and investment have measurable effects", () => {
  const s = make();
  const star = E.squad(s, s.userId).sort((a, b) => b.ca - a.ca)[0];
  star.injury = 80;
  assert(!E.lineup(s, s.userId).xi.some((x) => x.p.id === star.id));
  const balance = E.club(s).balance;
  E.invest(s, "stadium");
  assert.equal(
    E.club(s).capacity,
    data.clubs.find((c) => c.id === s.userId).capacity + 4500,
  );
  assert(E.club(s).balance < balance);
  E.advance(s);
  assert.equal(star.stats.apps, 0);
  assert.equal(star.injury, 61);
});
test("manager firing and hiring charge compensation and change tactical adaptation", () => {
  const s = make();
  const old = E.manager(s),
    cash = E.club(s).balance;
  E.sackManager(s);
  assert.equal(old.clubId, null);
  assert(!E.manager(s));
  assert(E.club(s).balance < cash);
  const candidate = s.managers.find((m) => !m.clubId && m.rep < 80);
  const result = E.hireManager(s, candidate.id, candidate.wage * 1.1, 3);
  assert(result.ok);
  assert.equal(E.manager(s).id, candidate.id);
  assert(E.club(s).adaptation > 0);
  assert.equal(s.managerHistory.length, 3);
});
test("owner decisions affect morale, money and fan satisfaction and cannot repeat", () => {
  const s = make();
  const d = s.decisions[0];
  const snapshot = JSON.stringify({
    club: E.club(s),
    players: E.squad(s, s.userId),
    manager: E.manager(s),
  });
  E.resolveDecision(s, d.id, 0);
  assert(d.resolved);
  assert.notEqual(
    JSON.stringify({
      club: E.club(s),
      players: E.squad(s, s.userId),
      manager: E.manager(s),
    }),
    snapshot,
  );
  assert.throws(() => E.resolveDecision(s, d.id, 0));
});
test("save round trip validates state and rejects corrupt standings / duplicate players", () => {
  const s = make();
  E.advance(s);
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(assertSave(loaded).year, 2026);
  loaded.table[s.userId].pts++;
  assert.throws(() => assertSave(loaded), /검증/);
  loaded.table[s.userId].pts--;
  loaded.players[1].id = loaded.players[0].id;
  assert.throws(() => assertSave(loaded), /선수/);
});
test("negative finances and missed targets never end the career", () => {
  const s = make();
  E.club(s).balance = -500;
  E.club(s).budget = 0;
  E.club(s).target = 1;
  E.advance(s);
  assert(!s.gameOver);
  assert(E.club(s).balance < 0);
  assert.equal(s.phase, 1);
});
test("all 20 clubs play seasons safely and only the bottom three get game over", () => {
  for (const id of data.meta.eplIds) {
    const s = make(id, 20261102);
    finish(s);
    assert(E.validateSeason(s).ok);
    assert.equal(s.gameOver, E.rank(s) >= 18);
    if (s.gameOver) assert.throws(() => E.advance(s), /강등/);
    else {
      E.advance(s);
      assert.equal(s.activeIds.length, 20);
      assert(!s.activeIds.some((id) => s.history[0].relegated.includes(id)));
      assert.equal(s.year, 2027);
      assert(E.validateSeason(s).ok);
    }
  }
});
test(
  "20-year world soak: aging, youth, promotion, retirement, records, 380 games remain sound",
  { timeout: 180000 },
  () => {
    const s = make("c281", 7100);
    for (let year = 0; year < 20; year++) {
      // Deliberately strong owner squad isolates longevity from the separately tested game-over path.
      for (const p of E.squad(s, s.userId)) {
        p.ca = 96;
        p.pa = 98;
        p.injury = 0;
        p.wage = Math.min(p.wage, 0.04);
      }
      E.club(s).balance = 500;
      E.club(s).budget = 200;
      finish(s);
      assert(E.validateSeason(s).ok);
      assert(!s.gameOver, `year ${year}, position ${E.rank(s)}`);
      assert.equal(s.history.length, year + 1);
      E.advance(s);
      assert.equal(s.year, 2027 + year);
      assert.equal(s.activeIds.length, 20);
      assert.equal(s.fixtures.length, 380);
      assert(E.squad(s, s.userId).length >= 23);
      assert(E.validateSeason(s).ok);
    }
    assert(s.players.some((p) => !p.real));
    assert(s.players.some((p) => p.retired));
    assert.equal(s.history.length, 20);
  },
);

test("foreign clubs renew independently while the owner’s expired contracts are released", () => {
  const s = make();
  const p = E.squad(s, s.userId).find(
    (p) => p.age !== null && p.age < 25 && !p.loanParent,
  );
  p.contract = 2027;
  const foreign = s.players.filter(
    (p) => p.clubId === "c27" && !p.initialLoanParent,
  );
  assert(foreign.length > 15);
  for (const x of foreign) x.contract = 2027;
  finish(s);
  assert(!s.gameOver);
  E.advance(s);
  assert.equal(p.clubId, null);
  assert(
    foreign.filter((p) => p.clubId === "c27").length > foreign.length * 0.6,
  );
  assert(s.players.some((p) => p.clubId === "c27" && !p.real));
  assert(!s.players.find((p) => p.id === "tm1034026")?.fplCode);
});
