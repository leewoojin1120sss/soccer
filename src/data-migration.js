import { clamp, log } from "./engine.js";
const empty = () => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0 });
/** Correct a save's starting-data defects without replaying matches or undoing user transactions. */
export function migrateCareer(s, data, patch) {
  if ((s.dataRevision ?? 1) >= patch.revision) return { changed: false };
  const current = new Map(data.players.map((p) => [p.id, p]));
  const saved = new Map(s.players.map((p) => [p.id, p]));
  const traded = new Set(s.transfers.map((t) => t.playerId));
  const membership = new Set(patch.membershipIds);
  const info = {
    changed: true,
    revision: patch.revision,
    facts: 0,
    ratings: 0,
    membership: 0,
    added: 0,
    protected: 0,
  };
  const years = Math.max(0, s.year - 2026);
  for (const id of patch.membershipIds) {
    const next = current.get(id),
      old = patch.baseline[id];
    let p = saved.get(id);
    if (!next) continue;
    if (!p) {
      if (s.year !== 2026) continue;
      p = {
        ...structuredClone(next),
        morale: 75,
        fitness: 100,
        injury: 0,
        stats: empty(),
        career: { apps: 0, goals: 0, assists: 0 },
        ownerStats: { apps: 0, goals: 0, assists: 0 },
        trend: 0,
        listed: false,
        retired: false,
        loanParent: next.initialLoanParent ?? null,
        simAge: next.age ?? next.developmentAge ?? 18,
      };
      s.players.push(p);
      saved.set(id, p);
      info.added++;
      continue;
    }
    const protectedPlayer =
      traded.has(id) ||
      p.listed ||
      (old &&
        (p.contract !== old.contract ||
          Math.abs(p.wage - (old.wage ?? 0)) > 0.00001));
    if (protectedPlayer) info.protected++;
    const originalAge = p.age;
    for (const k of [
      "name",
      "nat",
      "dob",
      "pos",
      "secondary",
      "source",
      "factsSource",
      "factsCheckedAt",
      "bioSource",
      "rosterStatus",
      "officialPositionGroup",
      "ratingRevision",
      "ratingBasis",
      "ratingEvidence",
      "ratingConfidence",
      "potentialBand",
      "ratingSources",
    ]) {
      if (next[k] !== undefined) p[k] = structuredClone(next[k]);
    }
    if (next.dob) {
      p.age = next.age + years;
      p.simAge = p.age;
    } else {
      p.age = originalAge ?? null;
      p.simAge ??= next.developmentAge ?? 18;
    }
    info.facts++;
    if (next.ratingRevision === 2) {
      const progress = old ? p.ca - old.ca : 0;
      p.ca = clamp(Math.round(next.ca + progress), 20, 99);
      p.pa = clamp(Math.max(p.ca, next.pa), p.ca, 99);
      if (p.potentialBand)
        p.potentialBand = [
          Math.max(p.ca, p.potentialBand[0]),
          Math.max(p.pa, p.potentialBand[1]),
        ];
      info.ratings++;
    }
    // Source corrections are applied in the first season only. Later careers already represent a fictional world.
    // A paid transfer, renewal, listing or loan is always preserved.
    if (s.year === 2026 && !protectedPlayer && old && p.clubId === old.clubId) {
      if (
        p.clubId !== next.clubId ||
        p.loanParent !== (next.initialLoanParent ?? null)
      )
        info.membership++;
      p.clubId = next.clubId;
      p.loanParent = next.initialLoanParent ?? null;
      if (next.unverifiedAffiliation) p.unverifiedAffiliation = true;
      else delete p.unverifiedAffiliation;
      if (s.round === 0) {
        p.value = next.value;
        p.wage = next.wage;
      }
    }
  }
  s.dataRevision = patch.revision;
  s.dataUpdateInfo = { ...info, firstSeasonRosterUpdated: s.year === 2026 };
  log(
    s,
    "data",
    `선수 데이터 v${patch.revision} 보정 · 인적 사항 ${info.facts}명, 능력 ${info.ratings}명. 경기 기록·거래·재정은 보존했습니다.`,
  );
  return info;
}
