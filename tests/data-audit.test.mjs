import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { migrateCareer } from "../src/data-migration.js";
import * as E from "../src/engine.js";
import { assertSave } from "../src/storage.js";
const load = async (n) =>
  JSON.parse(
    await readFile(new URL("../data/" + n + ".json", import.meta.url)),
  );
const data = {};
for (const n of ["meta", "clubs", "players", "managers"])
  data[n] = await load(n);
const input = await load("pl-audit-input"),
  patch = await load("roster-patch");
const byid = new Map(data.players.map((p) => [p.id, p]));
const pl = data.players.filter((p) => data.meta.eplIds.includes(p.clubId));
const byName = (n) => pl.find((p) => p.name === n);
function legacy() {
  const s = E.newGame(data, "c1237", 1120);
  delete s.dataRevision;
  const additions = new Set(
    patch.membershipIds.filter((id) => !patch.baseline[id]),
  );
  s.players = s.players.filter((p) => !additions.has(p.id));
  for (const [id, b] of Object.entries(patch.baseline)) {
    const p = s.players.find((p) => p.id === id);
    if (p) {
      Object.assign(p, structuredClone(b));
      p.loanParent = b.initialLoanParent ?? null;
      delete p.ratingRevision;
    }
  }
  return s;
}
test("20 official squads are exhaustively reconciled; every audited nationality is sourced", () => {
  assert.equal(input.clubs.length, 20);
  assert.equal(input.officialCount, 601);
  assert.equal(
    input.players.filter((p) => p.rosterStatus === "firstTeam").length,
    601,
  );
  assert.equal(
    new Set(input.players.map((p) => p.id)).size,
    input.players.length,
  );
  for (const q of input.players) {
    const p = byid.get(q.id);
    assert(p, q.name);
    assert.equal(p.clubId, q.clubId);
    assert.equal(p.nat, q.nationality);
    assert(p.factsSource.startsWith("https://"));
    assert.equal(p.ratingRevision, 2);
    assert(p.ca <= p.pa);
    assert(p.potentialBand[0] >= p.ca);
    assert(p.potentialBand[0] <= p.pa && p.pa <= p.potentialBand[1]);
  }
  assert.equal(pl.filter((p) => p.nat === "미확인" || !p.nat).length, 0);
});
test("confirmed departed players cannot silently remain in their old EPL first team", () => {
  assert.equal(byid.get("tm660860").clubId, "c10004");
  assert(!byid.get("tm660860").initialLoanParent);
  for (const q of input.departures) {
    const p = byid.get(q.id);
    assert.equal(p.clubId, q.destinationId);
    assert.equal(p.initialLoanParent ?? null, q.loanParent);
  }
  assert(byid.get("tm834742").unverifiedAffiliation);
  assert.equal(byid.get("tm834742").clubId, null);
});
test("Brighton regressions: veterans retain ability, prices do not determine quality, youth is bounded", () => {
  assert(byName("Lewis Dunk").ca >= 76);
  assert(byName("Pascal Groß").ca >= 79);
  assert(byName("Jason Steele").ca >= 70);
  const y = byName("Zadok Yohanna");
  assert(y.ca >= 65 && y.pa >= 82 && y.pa <= 90);
  assert.equal(byName("Younes Ibrahim").nat, "Egypt");
  assert.equal(byName("Femi Azeez").nat, "Nigeria");
  assert.equal(byName("Femi Azeez").pos, "RW");
  assert(byName("Pascal Groß").value < byName("Charalampos Kostoulas").value);
  assert(byName("Pascal Groß").ca > byName("Charalampos Kostoulas").ca);
  assert(byName("Luka Vuskovic").pa < 97);
  assert(byName("Max Dowman").ca < byName("Bukayo Saka").ca);
});
test("veteran underpricing and goalkeeper aging are corrected across teams, not just Brighton", () => {
  for (const n of [
    "Alisson Becker",
    "Jordan Pickford",
    "Bernd Leno",
    "Matz Sels",
    "Nick Pope",
  ])
    assert(byName(n).ca >= 78, n);
  for (const n of ["Bruno Fernandes", "Virgil van Dijk", "Granit Xhaka"])
    assert(byName(n).ca >= 79, n);
  assert(
    E.ageProfile({ pos: "GK" }).declineStart >
      E.ageProfile({ pos: "ST" }).declineStart,
  );
  assert(
    E.ageProfile({ pos: "GK" }).maximumAge >
      E.ageProfile({ pos: "ST" }).maximumAge,
  );
});
test("migration corrects untouched first-season records and keeps exact match totals/cash/history", () => {
  const s = legacy(),
    before = {
      cash: E.club(s).balance,
      budget: E.club(s).budget,
      fixtures: JSON.stringify(s.fixtures),
      history: JSON.stringify(s.history),
    };
  const report = migrateCareer(s, data, patch);
  assert(report.changed);
  assert.equal(s.players.find((p) => p.id === "tm660860").clubId, "c10004");
  assert.equal(
    s.players.find((p) => p.id === byName("Femi Azeez").id).nat,
    "Nigeria",
  );
  assert.equal(E.club(s).balance, before.cash);
  assert.equal(E.club(s).budget, before.budget);
  assert.equal(JSON.stringify(s.fixtures), before.fixtures);
  assert.equal(JSON.stringify(s.history), before.history);
  assert(E.validateSeason(s).ok);
  assertSave(s);
  assert.equal(migrateCareer(s, data, patch).changed, false);
});
test("migration preserves user acquisitions, renewals, development and later-season fictional ownership", () => {
  const s = legacy(),
    coppola = s.players.find((p) => p.id === "tm660860");
  s.transfers.push({
    playerId: coppola.id,
    from: "c10004",
    to: s.userId,
    year: 2026,
  });
  coppola.ca += 2;
  coppola.wage = 0.08;
  coppola.contract = 2031;
  migrateCareer(s, data, patch);
  assert.equal(coppola.clubId, s.userId);
  assert.equal(coppola.wage, 0.08);
  assert.equal(coppola.contract, 2031);
  const later = legacy();
  later.year = 2029;
  const old = later.players.find((p) => p.id === "tm660860");
  old.clubId = "c281";
  migrateCareer(later, data, patch);
  assert.equal(old.clubId, "c281");
  assert(E.validateSeason(later).ok);
});
test("verified midfield/winger details are retained when broad official display categories differ", () => {
  assert.equal(byName("Kaoru Mitoma").pos, "LW");
  assert.equal(byName("Kaoru Mitoma").officialPositionGroup, "Midfielders");
  assert.equal(byName("Younes Ibrahim").pos, "AM");
  for (const p of pl) {
    assert(E.GROUP[p.pos], p.name);
    if (p.age === null) assert(p.developmentAge >= 15);
  }
});

test("mid-season correction preserves 190 played games, every goal event and the cash ledger", () => {
  const s = legacy();
  E.advance(s);
  const fixtures = JSON.stringify(s.fixtures),
    ledger = JSON.stringify(s.ledger),
    cash = E.club(s).balance;
  migrateCareer(s, data, patch);
  assert.equal(JSON.stringify(s.fixtures), fixtures);
  assert.equal(JSON.stringify(s.ledger), ledger);
  assert.equal(E.club(s).balance, cash);
  assert.equal(E.validateSeason(s).played, 190);
  assert(E.validateSeason(s).ok);
  assertSave(s);
});
