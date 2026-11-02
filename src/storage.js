import { validateSeason } from "./engine.js";
const DB = "touchline-career-v1",
  STORE = "saves";
const open = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function read(key) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
async function put(key, value) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? Error("저장을 완료하지 못했습니다."));
    });
  } finally {
    db.close();
  }
}
export async function save(s) {
  s.lastSaved = new Date().toISOString();
  await put("career", s);
  localStorage.setItem(
    "touchline-summary",
    JSON.stringify({
      clubId: s.userId,
      year: s.year,
      phase: s.phase,
      gameOver: s.gameOver,
      date: s.lastSaved,
    }),
  );
}
export async function load() {
  return read("career");
}
export async function clear() {
  await put("career", null);
  localStorage.removeItem("touchline-summary");
}
export function assertSave(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Number.isInteger(s.year) ||
    s.year < 2026 ||
    s.year > 9999 ||
    !Number.isInteger(s.phase) ||
    s.phase < 0 ||
    s.phase > 4 ||
    !Array.isArray(s.players) ||
    s.players.length > 150000 ||
    !Array.isArray(s.clubs) ||
    !Array.isArray(s.managers) ||
    !Array.isArray(s.activeIds) ||
    s.activeIds.length !== 20 ||
    !s.clubs.some((c) => c.id === s.userId) ||
    !s.table ||
    !Array.isArray(s.fixtures) ||
    !Array.isArray(s.history) ||
    !Array.isArray(s.transfers) ||
    !Array.isArray(s.ledger) ||
    !Array.isArray(s.news) ||
    !Array.isArray(s.decisions) ||
    !Array.isArray(s.offers) ||
    !Array.isArray(s.reports) ||
    !Array.isArray(s.lowerIds) ||
    !Array.isArray(s.managerHistory) ||
    !Number.isFinite(s.seed) ||
    !Number.isFinite(s.serial)
  )
    throw Error("지원하지 않거나 손상된 저장 파일입니다.");
  const ids = new Set();
  for (const p of s.players) {
    if (
      !p ||
      typeof p.id !== "string" ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !Number.isFinite(p.ca) ||
      p.ca < 0 ||
      p.ca > 100 ||
      !Number.isFinite(p.wage) ||
      p.wage < 0 ||
      !p.stats ||
      !p.career
    )
      throw Error("선수 데이터가 손상되었습니다.");
    ids.add(p.id);
  }
  for (const c of s.clubs)
    if (!Number.isFinite(c.balance) || !Number.isFinite(c.budget))
      throw Error("재정 데이터가 손상되었습니다.");
  const result = validateSeason(s);
  if (!result.ok)
    throw Error("경기 기록을 검증할 수 없습니다: " + result.errors[0]);
  return s;
}
export function exportSave(s) {
  const blob = new Blob([JSON.stringify(s)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `touchline-${s.year}-${s.userId}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
