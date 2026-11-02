import * as E from "./engine.js";
import * as S from "./storage.js";
const $ = (q) => document.querySelector(q);
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (x) =>
  `£${Number(x).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<small>m</small>`;
const wage = (x) => "£" + Math.round(x * 1e6).toLocaleString("en-GB");
const season = (y) => `${y}/${String(y + 1).slice(-2)}`;
const paths = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  squad:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  season: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16 M8 15h2 M14 15h2",
  manager:
    "M4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3 M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M9 13l3 5 3-5",
  records:
    "M8 21h8 M12 17v4 M7 3h10v8a5 5 0 0 1-10 0z M7 5H3v3a4 4 0 0 0 4 4 M17 5h4v3a4 4 0 0 1-4 4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chevron: "M9 5l7 7-7 7",
  search: "M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  close: "M6 6l12 12 M18 6L6 18",
  save: "M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8",
  check: "M5 12l4 4L19 6",
  download: "M12 3v12 M6 9l6 6 6-6 M4 16v5h16v-5",
  up: "M6 14l6-6 6 6",
  info: "M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  chart: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  swap: "M4 7h16l-4-4 M20 17H4l4 4",
  wallet: "M3 5h16v15H3z M3 5V3h14v2 M15 10h6v6h-6z",
  mail: "M3 5h18v14H3z M3 5l9 7 9-7",
  flag: "M4 22V3 M4 3h15l-3 4 3 4H4",
};
function icon(n, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[n] ?? paths.info}"/></svg>`;
}
function badge(c, size = "") {
  return `<span class="crest ${size}" style="--club:${esc(c?.color ?? "#666")}">${esc(c?.short ?? "FA")}</span>`;
}
const btn = (label, action, cl = "button", extra = "") =>
  `<button class="${cl}" data-action="${action}" ${extra}>${label}</button>`;
let data,
  state = null,
  saved = null,
  view = "home",
  sub = "own",
  seasonTab = "table",
  recordTab = "history",
  selected = "c1237",
  busy = false,
  page = 0,
  search = "",
  pos = "",
  league = "",
  minCa = 0,
  maxAge = 50,
  maxValue = 300,
  sort = "ability",
  modal = null,
  saveError = false,
  loadError = "";
let playerMap, clubMap;
const cBy = (id) => clubMap?.get(id),
  pBy = (id) => playerMap?.get(id);
const refreshMaps = () => {
  clubMap = new Map((state?.clubs ?? data.clubs).map((c) => [c.id, c]));
  playerMap = new Map((state?.players ?? data.players).map((p) => [p.id, p]));
};
function toast(text, error = false) {
  const el = $("#toast");
  el.textContent = text;
  el.className = "visible" + (error ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.className = ""), 4200);
}
function errorMessage(e) {
  console.error(e);
  toast(e.message ?? "처리를 완료하지 못했습니다.", true);
}
async function persist() {
  try {
    await S.save(state);
    saved = state;
    saveError = false;
    const status = $("#save-label");
    if (status) status.textContent = "저장됨";
  } catch (e) {
    saveError = true;
    toast(
      "브라우저 저장에 실패했습니다. 설정에서 저장 파일을 내보내 주세요.",
      true,
    );
  }
}
function render() {
  refreshMaps();
  $("#app").innerHTML = state ? shell() : startScreen();
  renderModal();
}
function shell() {
  const c = E.club(state);
  const pages = {
    home: home,
    squad: squadView,
    season: seasonView,
    manager: managerView,
    records: recordsView,
  };
  return `<header class="appbar"><div class="appbar-inner"><a href="#" class="wordmark" data-action="nav-home">TOUCHLINE<span>OWNER’S CLUB</span></a><div class="bar-right"><span class="save-state"><i class="${saveError ? "bad" : ""}"></i><span id="save-label">${saveError ? "저장 실패" : "자동 저장"}</span></span>${btn(icon("settings"), "settings", "icon-button", 'aria-label="설정 및 저장"')}</div></div></header><main class="main"><div class="clubbar"><div class="club-identity">${badge(c)}<div><b>${esc(c.ko)}</b><span>${season(state.year)} · 프리미어리그</span></div></div><span class="phase-pill">${state.gameOver ? "커리어 종료" : E.PHASES[state.phase]}</span></div>${pages[view]()}</main><nav class="bottom-nav" aria-label="주 메뉴"><div>${[
    ["home", "홈"],
    ["squad", "스쿼드"],
    ["season", "시즌"],
    ["manager", "감독"],
    ["records", "기록"],
  ]
    .map(([id, n]) =>
      btn(
        `${icon(id)}<span>${n}</span>`,
        "nav-" + id,
        "nav-item " + (view === id ? "active" : ""),
        view === id ? 'aria-current="page"' : "",
      ),
    )
    .join(
      "",
    )}</div></nav>${busy ? `<div class="processing" role="status"><div class="loader"></div><b>축구 세계가 움직이고 있습니다.</b><span>경기 결과와 구단 운영을 계산하는 중입니다.</span></div>` : ""}`;
}
function heading(kicker, title, right = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1></div>${right}</div>`;
}
function startScreen() {
  const c =
    cBy(selected) ?? data.clubs.find((c) => c.id === data.meta.eplIds[0]);
  const roster = data.players
    .filter((p) => p.clubId === c.id)
    .sort((a, b) => b.ca - a.ca);
  const m = data.managers.find((m) => m.clubId === c.id);
  return `<header class="appbar"><div class="appbar-inner"><div class="wordmark">TOUCHLINE<span>OWNER’S CLUB</span></div>${btn(icon("info"), "sources", "icon-button", 'aria-label="데이터 출처"')}</div></header><main class="start-main"><div class="start-heading"><div class="eyebrow">PREMIER LEAGUE · 2026/27</div><h1>당신이 결정할,<br>구단의 다음 장.</h1><p>20개 구단. 하나의 선택. 당신만의 축구 역사.</p></div>${loadError ? `<div class="alert danger">${esc(loadError)} ${btn("다시 불러오기", "retry-load", "text-button")}</div>` : ""}${saved ? `<div class="continue-card"><div>${badge(data.clubs.find((c) => c.id === saved.userId))}<div><b>진행 중인 커리어</b><span>${esc(saved.clubs.find((c) => c.id === saved.userId)?.ko)} · ${season(saved.year)} · ${E.PHASES[saved.phase]}</span></div></div>${btn(`이어서 하기 ${icon("arrow")}`, "continue", "button dark")}</div>` : ""}<div class="selection-layout"><section><div class="section-title"><h2>구단을 선택하세요</h2><span>20 CLUBS</span></div><div class="club-grid">${data.meta.eplIds
    .map((id) => {
      const cc = cBy(id);
      return `<button class="club-choice ${id === c.id ? "selected" : ""}" data-action="select-club" data-id="${id}" aria-pressed="${id === c.id}">${badge(cc)}<span><b>${esc(cc.ko)}</b><small>${cc.target <= 4 ? "우승·챔피언스리그" : cc.target <= 10 ? "유럽 무대 도전" : "프리미어리그 잔류"}</small></span><span class="choice-rating">${cc.rep}</span></button>`;
    })
    .join(
      "",
    )}</div></section><aside class="club-preview"><div class="preview-top" style="--club:${esc(c.color)}"><span>YOUR NEXT CHAPTER</span>${badge(c, "large")}<h2>${esc(c.ko)}</h2><p>${esc(c.name)}</p></div><div class="preview-body"><div class="preview-stats"><div><span>초기 이적 예산</span><strong>${money(c.budget)}</strong></div><div><span>운영 난이도</span><strong class="difficulty">${c.rep >= 85 ? "보통" : c.rep >= 76 ? "도전적" : "매우 어려움"}</strong></div></div><dl class="detail-list"><div><dt>감독</dt><dd>${esc(m?.name)}</dd></div><div><dt>구단 전력</dt><dd>${roster.length ? Math.round(roster.slice(0, 16).reduce((s, p) => s + p.ca, 0) / Math.min(16, roster.length)) : c.rep} / 100</dd></div><div><dt>가용 자금</dt><dd>${money(c.balance)}</dd></div><div><dt>시즌 목표</dt><dd>${c.target === 1 ? "리그 우승" : `${c.target}위 이내`}</dd></div><div><dt>재정 상태</dt><dd>${c.budget > 100 ? "매우 안정" : c.budget > 40 ? "안정" : "제한적"}</dd></div></dl><div class="key-players"><span class="eyebrow">KEY PLAYERS</span>${roster
    .slice(0, 3)
    .map((p) => `<div><span>${esc(p.name)}</span><b>${p.ca}</b></div>`)
    .join(
      "",
    )}</div>${btn(`이 구단으로 시작 ${icon("arrow")}`, "start", "button green full")}<p class="tiny">18~20위 강등 시 커리어가 종료됩니다.</p></div></aside></div><div class="start-dock"><div>${badge(c, "mini")}<b>${esc(c.ko)}</b></div>${btn("구단주로 시작", "start", "button green")}</div><div class="data-footer"><span><b>${data.meta.realPlayers.toLocaleString()}</b> 실존 선수 · <b>${Object.keys(data.meta.leagues).length}</b>개 리그 자료 · EPL 소속 2026.11.02 기준</span><div>${btn("저장 파일 불러오기", "import", "text-button")} <span class="footer-dot">·</span> ${btn("자료·추정치 안내", "sources", "text-button")}</div></div></main>`;
}
function steps() {
  return `<div class="steps" aria-label="시즌 진행"><div class="step-line"></div>${E.PHASES.map((n, i) => `<div class="step ${state.phase === i ? "current" : state.phase > i ? "complete" : ""}"><span>${state.phase > i ? icon("check", 13) : "0" + (i + 1)}</span><b>${n}</b></div>`).join("")}</div>`;
}
const nextLabel = () =>
  [
    "전반기 19경기 진행",
    "겨울 이적시장 열기",
    "후반기 19경기 진행",
    "시즌 결산 확인",
    "다음 시즌 시작",
  ][state.phase];
function advanceButton() {
  return state.gameOver
    ? btn("커리어 결산 보기", "nav-records", "button dark")
    : btn(`${nextLabel()} ${icon("arrow")}`, "advance", "button green");
}
function home() {
  const c = E.club(state),
    t = state.table[state.userId],
    m = E.manager(state),
    report = state.reports.filter((r) => r.year === state.year).at(-1);
  const pending = state.decisions.filter((d) => !d.resolved);
  const power = E.lineup(state, state.userId);
  return `${heading("THE BOARDROOM", "구단주 오피스", `<span class="season-date">${["JUL", "DEC", "JAN", "MAY", "JUN"][state.phase]} ${state.phase < 2 ? state.year : state.year + 1}</span>`)}${state.gameOver ? `<div class="gameover-banner"><div class="eyebrow">END OF THE ROAD</div><h2>프리미어리그에서의 여정이 끝났습니다.</h2><p>${E.rank(state)}위로 강등되었습니다. ${state.history.length}시즌의 경영 기록을 확인하세요.</p>${btn("커리어 결산", "nav-records", "button light")}${btn("새 커리어 시작", "new-game", "button outline-light")}</div>` : ""}<section class="overview"><div class="overview-main"><div class="eyebrow">LEAGUE POSITION</div><div class="big-position">${t.p ? E.rank(state) : "—"}<span>/ 20</span></div><div class="overview-points"><b>${t.pts} PTS</b><span>${t.p}경기 · ${t.w}승 ${t.d}무 ${t.l}패</span></div><div class="form">${t.form.length ? t.form.map((f) => `<i class="${f}">${{ W: "승", D: "무", L: "패" }[f]}</i>`).join("") : "<span>새 시즌의 시작</span>"}</div></div><div class="overview-stats"><div><span>이적 예산</span><strong>${money(c.budget)}</strong><small>가용 자금 ${money(c.balance)}</small></div><div><span>선수단 주급</span><strong>${wage(E.wages(state))}</strong><small>한도 ${wage(c.wageLimit)}</small></div><div><span>팬 만족도</span><strong>${Math.round(c.fans)}<small> / 100</small></strong><div class="meter"><i style="width:${c.fans}%"></i></div></div><div><span>팀 분위기</span><strong>${c.morale >= 75 ? "좋음" : c.morale >= 55 ? "안정" : "흔들림"}</strong><small>시즌 목표 ${c.target}위 이내</small></div></div></section>${steps()}<div class="advance-row"><span>${state.phase === 0 ? "여름 이적시장 개방" : state.phase === 2 ? "겨울 이적시장 개방" : state.phase === 4 ? "시즌 결산 완료" : `${state.round} / 38경기 완료`}<small>${E.marketOpen(state) ? "영입과 계약을 정리하고 시즌을 진행하세요." : state.phase === 4 ? "새로운 시즌에도 구단의 역사는 이어집니다." : "경기별 기록은 시즌 메뉴에서 확인할 수 있습니다."}</small></span>${advanceButton()}</div>${report && state.phase !== 2 ? `<section class="report-strip"><div><span class="eyebrow">${report.half === "전반기" ? "MID-SEASON" : "FULL-TIME"} REPORT</span><h3>${report.half} 보고서</h3></div><div><b>${report.w}<small>승</small> ${report.draws}<small>무</small> ${19 - report.w - report.draws}<small>패</small></b><span>19경기 성적</span></div><div><b>${report.goals} : ${report.against}</b><span>득점 : 실점</span></div><div><b>${report.position}위</b><span>리그 순위</span></div></section>` : ""}<div class="dashboard-grid"><section class="panel inbox"><div class="section-title"><h2>결재함 <em>${pending.length}</em></h2><span>BOARD DECISIONS</span></div>${pending.length ? pending.map((d) => `<button class="inbox-row" data-action="decision" data-id="${d.id}"><span class="event-icon">${icon(d.type === "raise" ? "wallet" : d.type === "scout" ? "search" : "mail", 19)}</span><span><b>${esc(d.title)}</b><small>${esc(d.description)}</small></span>${icon("chevron", 17)}</button>`).join("") : '<div class="empty compact">처리할 안건이 없습니다.</div>'}${state.offers.length ? `<div class="incoming-offer">${icon("swap")}<span>선수 이적 제안 <b>${state.offers.length}건</b></span>${btn("검토", "offers", "text-button")}</div>` : ""}</section><section class="panel coach-panel"><div class="section-title"><h2>감독 리포트</h2>${btn("자세히", "nav-manager", "text-button")}</div><div class="coach-ident"><span class="monogram">${
    m
      ? esc(
          m.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join(""),
        )
      : "—"
  }</span><div><b>${esc(m?.name ?? "감독 대행")}</b><span>${m ? `${m.formation} · ${m.style}` : "새 감독 선임이 필요합니다."}</span></div><span class="rating">${Math.round((m?.attack ?? 65) / 2 + (m?.defense ?? 65) / 2)}</span></div><div class="mini-pitch"><div class="pitch-circle"></div><div class="pitch-box top"></div><div class="pitch-box bottom"></div>${pitch(power)}</div><div class="coach-summary"><span>예상 선발 전력 <b>${Math.round(power.power)}</b></span><span>전술 적응도 <b>${Math.round(100 - c.adaptation * 7)}%</b></span></div></section></div><div class="dashboard-grid lower"><section class="panel"><div class="section-title"><h2>클럽 브리핑</h2><span>LATEST</span></div>${state.news
    .slice(0, 5)
    .map(
      (n) =>
        `<div class="news-row"><i class="news-dot ${n.type}"></i><div><span>${esc(n.text)}</span><small>${season(n.year)} · ${E.PHASES[n.phase]}</small></div></div>`,
    )
    .join(
      "",
    )}</section><section class="panel"><div class="section-title"><h2>장기 투자</h2><span>CLUB DEVELOPMENT</span></div>${[
    ["academy", "유소년 아카데미", 8, "유망주 성장과 배출"],
    ["facilities", "훈련 시설", 6, "컨디션 회복"],
    ["stadium", "경기장 확장", 15, "좌석 +4,500 · 입장 수익"],
  ]
    .map(
      ([id, n, cost, d]) =>
        `<div class="investment-row"><div><b>${n} <small>Lv.${c[id]}</small></b><span>${d}</span></div>${btn(c.invested.includes(id) ? "투자 완료" : money(cost), "invest", "button small subtle", `data-id="${id}" ${c.invested.includes(id) || state.gameOver ? "disabled" : ""}`)}</div>`,
    )
    .join(
      "",
    )}<div class="target-setting"><label for="target">시즌 목표</label><select id="target" ${!E.marketOpen(state) ? "disabled" : ""}>${[
    [1, "우승"],
    [4, "4위 이내"],
    [6, "6위 이내"],
    [10, "상위 10위"],
    [14, "14위 이내"],
    [17, "잔류 (17위)"],
    ...(![1, 4, 6, 10, 14, 17].includes(c.target)
      ? [[c.target, c.target + "위 이내"]]
      : []),
  ]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([v, n]) =>
        `<option value="${v}" ${c.target === v ? "selected" : ""}>${n}</option>`,
    )
    .join("")}</select></div></section></div>`;
}
function pitch(line) {
  const rows = { GK: [], DF: [], MF: [], FW: [] };
  for (const x of line.xi) (rows[E.GROUP[x.pos]] ?? rows.MF).push(x);
  return ["FW", "MF", "DF", "GK"]
    .map(
      (g, i) =>
        `<div class="pitch-row row-${i}">${rows[g].map(({ p }) => `<button data-action="player" data-id="${p.id}" title="${esc(p.name)}"><b>${p.ca}</b><span>${esc(p.name.split(" ").at(-1))}</span></button>`).join("")}</div>`,
    )
    .join("");
}
function tabs(items, current, action) {
  return `<div class="tabs" role="tablist">${items.map(([id, n]) => btn(n, action, "tab " + (id === current ? "active" : ""), `data-id="${id}" role="tab" aria-selected="${id === current}"`)).join("")}</div>`;
}
function squadView() {
  const roster = E.squad(state, state.userId);
  const loans = state.players.filter((p) => p.loanParent === state.userId);
  return `${heading("FOOTBALL OPERATIONS", "스쿼드", `<div class="heading-note"><b>${roster.length}</b>명의 선수 · 임대 방출 ${loans.length}명</div>`)}${tabs(
    [
      ["own", "선수단"],
      ["market", "이적시장"],
      ["contracts", "계약 관리"],
      ["offers", `제안함 ${state.offers.length}`],
    ],
    sub,
    "squad-tab",
  )}${
    sub === "offers"
      ? offersView()
      : `<div class="squad-toolbar"><div class="search-field">${icon("search", 18)}<input id="search" type="search" placeholder="${sub === "market" ? "선수 또는 구단 검색" : "선수 이름 검색"}" value="${esc(search)}" aria-label="선수 검색"></div><select id="position" aria-label="포지션 필터"><option value="">모든 포지션</option>${["GK", "DF", "MF", "FW", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"].map((p) => `<option ${pos === p ? "selected" : ""}>${p}</option>`).join("")}</select><select id="sort" aria-label="정렬">${[
          ["ability", "능력순"],
          ["age", "나이순"],
          ["value", "가치순"],
          ["goals", "득점순"],
          ["contract", "계약 만료순"],
        ]
          .map(
            ([v, n]) =>
              `<option value="${v}" ${sort === v ? "selected" : ""}>${n}</option>`,
          )
          .join("")}</select></div>${
          sub === "market"
            ? `<div class="market-filter"><label>리그<select id="league"><option value="">전체 리그</option><option value="FREE" ${league === "FREE" ? "selected" : ""}>자유계약</option>${Object.entries(
                data.meta.leagues,
              )
                .map(
                  ([id, l]) =>
                    `<option value="${id}" ${league === id ? "selected" : ""}>${esc(l.country)} · ${esc(l.name)}</option>`,
                )
                .join(
                  "",
                )}</select></label><label>최소 능력<input id="minca" type="number" min="0" max="99" value="${minCa}"></label><label>최대 나이<input id="maxage" type="number" min="15" max="50" value="${maxAge}"></label><label>최대 가치 (£m)<input id="maxvalue" type="number" min="0" max="999" value="${maxValue}"></label></div><div class="market-status"><i class="${E.marketOpen(state) ? "open" : ""}"></i>${E.marketOpen(state) ? "이적시장 개방 · 선수에게 제안할 수 있습니다." : "이적시장 종료 · 다음 시장을 준비하세요."}<span>${data.meta.realPlayers.toLocaleString()} real players</span></div>`
            : ""
        }<div id="player-list">${playerList()}</div>`
  }`;
}
function filtered() {
  let a =
    sub === "market"
      ? state.players.filter((p) => p.clubId !== state.userId && !p.retired)
      : sub === "contracts"
        ? state.players.filter(
            (p) => p.clubId === state.userId || p.loanParent === state.userId,
          )
        : E.squad(state, state.userId);
  if (search) {
    const q = search
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    a = a.filter((p) =>
      (
        p.name +
        " " +
        (cBy(p.clubId)?.name ?? "") +
        " " +
        (cBy(p.clubId)?.ko ?? "")
      )
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(q),
    );
  }
  if (pos) a = a.filter((p) => p.pos === pos || E.GROUP[p.pos] === pos);
  if (sub === "market") {
    if (league)
      a = a.filter((p) =>
        league === "FREE"
          ? !p.clubId && !p.unverifiedAffiliation
          : cBy(p.clubId)?.league === league,
      );
    a = a.filter(
      (p) =>
        p.ca >= minCa &&
        (p.age === null || p.age <= maxAge) &&
        p.value <= maxValue,
    );
  }
  a.sort((a, b) =>
    sort === "age"
      ? (a.age ?? 99) - (b.age ?? 99)
      : sort === "value"
        ? b.value - a.value
        : sort === "goals"
          ? b.stats.goals - a.stats.goals
          : sort === "contract"
            ? a.contract - b.contract
            : b.ca - a.ca,
  );
  return a;
}
function playerList() {
  const a = filtered();
  page = Math.min(page, Math.max(0, Math.ceil(a.length / 40) - 1));
  const rows = a.slice(page * 40, page * 40 + 40);
  return `<div class="list-meta"><span>${a.length.toLocaleString()}명${sub === "contracts" ? " · 1년 이내 만료 선수를 먼저 확인하세요." : ""}</span><span class="tiny">능력·가치·계약은 게임 추정치</span></div><div class="table-wrap player-table"><table><thead><tr><th>선수</th><th class="center">나이</th><th class="center">능력</th><th class="hide-xs">${sub === "contracts" ? "만료" : "잠재력"}</th><th>${sub === "contracts" ? "주급" : "시장 가치"}</th><th class="hide-sm">${sub === "market" ? "소속" : "상태"}</th><th class="hide-xs">${sub === "market" ? "자료 기준" : "출전 / 골"}</th></tr></thead><tbody>${rows.map((p) => `<tr tabindex="0" data-action="player" data-id="${p.id}" role="button" aria-label="${esc(p.name)} 상세"><td><div class="player-cell"><span class="position pos-${E.GROUP[p.pos]}">${p.pos}</span><div><b>${esc(p.name)} ${!p.real ? '<i class="generated-label">가상</i>' : ""}</b><small>${esc(p.nat)}${sub === "contracts" && p.loanParent === state.userId ? " · 임대 방출" : ""}</small></div></div></td><td class="center muted">${p.age ?? "—"}</td><td class="center"><span class="ability ${p.ca >= 80 ? "elite" : p.ca >= 70 ? "good" : ""}">${p.ca}</span></td><td class="hide-xs muted">${sub === "contracts" ? `<span class="${p.contract <= state.year + 1 ? "danger-text" : ""}">${p.contract}</span>` : p.pa}</td><td class="num">${sub === "contracts" ? wage(p.wage) : money(p.value)}</td><td class="hide-sm"><span class="${p.injury ? "danger-text" : "muted"}">${sub === "market" ? esc(cBy(p.clubId)?.ko ?? (p.unverifiedAffiliation ? "소속 미확인" : "자유계약")) : p.injury ? `부상 · ${p.injury}경기` : p.loanParent ? "임대 영입" : p.listed ? "이적 명단" : p.morale < 60 ? "불만" : "정상"}</span></td><td class="hide-xs muted">${sub === "market" ? (p.source === "fpl-2026-11-02" ? "26.11 EPL" : p.real ? "26.07 자료" : "게임 생성") : `${p.stats.apps} / ${p.stats.goals}`}</td></tr>`).join("")}</tbody></table>${!rows.length ? '<div class="empty">조건에 맞는 선수가 없습니다.</div>' : ""}</div><div class="pagination">${btn("이전", "prev-page", "button subtle small", page === 0 ? "disabled" : "")}<span>${page + 1} / ${Math.max(1, Math.ceil(a.length / 40))}</span>${btn("다음", "next-page", "button subtle small", (page + 1) * 40 >= a.length ? "disabled" : "")}</div>`;
}
function offersView() {
  return `<div class="offer-list">${
    state.offers.length
      ? state.offers
          .map((o) => {
            const p = pBy(o.playerId),
              c = cBy(o.buyerId);
            return `<section class="offer-card"><div class="offer-top"><div>${badge(c)}<span><b>${esc(c?.ko)}</b><small>${esc(p?.name)} 영입 제안</small></span></div><strong>${money(o.fee)}</strong></div><div class="offer-actions">${btn("선수 확인", "player", "text-button", `data-id="${o.playerId}"`)}<div>${btn("거절", "reject-offer", "button subtle small", `data-id="${o.id}" ${!E.marketOpen(state) ? "disabled" : ""}`)}${btn("제안 수락", "accept-offer", "button green small", `data-id="${o.id}" ${!E.marketOpen(state) ? "disabled" : ""}`)}</div></div></section>`;
          })
          .join("")
      : '<div class="empty">도착한 이적 제안이 없습니다.<small>이적 명단에 선수를 등록하면 관심 구단의 제안을 받을 수 있습니다.</small></div>'
  }</div>`;
}
function seasonView() {
  const completed = state.fixtures.filter((g) => g.hg !== null).length;
  return `${heading("THE COMPETITION", "시즌", `<span class="heading-note">${state.round} / 38 MATCHWEEKS</span>`)}${steps()}<div class="season-actions"><span>리그 전체 ${completed} / 380경기</span>${advanceButton()}</div>${tabs(
    [
      ["table", "순위표"],
      ["fixtures", "일정·결과"],
      ["players", "개인 기록"],
      ["review", "시즌 보고서"],
    ],
    seasonTab,
    "season-tab",
  )}${seasonTab === "table" ? leagueTable() : seasonTab === "fixtures" ? fixtureList() : seasonTab === "players" ? leaders() : review()}`;
}
function leagueTable() {
  return `<div class="table-wrap league-table"><table><thead><tr><th class="center">순위</th><th>구단</th><th>경기</th><th class="hide-xs">승</th><th class="hide-xs">무</th><th class="hide-xs">패</th><th class="hide-sm">득점</th><th class="hide-sm">실점</th><th>득실</th><th>승점</th><th class="hide-sm">최근 5경기</th></tr></thead><tbody>${E.table(
    state,
  )
    .map(
      (t, i) =>
        `<tr class="${t.id === state.userId ? "my-team" : ""}"><td class="rank-cell ${i < 4 ? "europe" : i >= 17 ? "relegation" : ""}">${i + 1}</td><td><div class="team-cell">${badge(cBy(t.id), "mini")}<b>${esc(cBy(t.id)?.ko)}</b></div></td><td>${t.p}</td><td class="hide-xs">${t.w}</td><td class="hide-xs">${t.d}</td><td class="hide-xs">${t.l}</td><td class="hide-sm">${t.gf}</td><td class="hide-sm">${t.ga}</td><td>${t.gf - t.ga > 0 ? "+" : ""}${t.gf - t.ga}</td><td class="points">${t.pts}</td><td class="hide-sm"><div class="form small-form">${t.form.map((f) => `<i class="${f}">${f}</i>`).join("")}</div></td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><div class="table-legend"><span><i class="legend europe"></i>1~4위 챔피언스리그권</span><span><i class="legend secondary"></i>5~6위 유럽대항전권</span><span><i class="legend relegation"></i>18~20위 강등</span></div><p class="tiny">유럽대항전은 경영 보너스에 반영됩니다. 별도 대회 경기는 진행하지 않습니다.</p>`;
}
function fixtureList() {
  const games = state.fixtures.filter(
    (g) => g.home === state.userId || g.away === state.userId,
  );
  return `<div class="fixture-list">${games
    .map((g) => {
      const ownHome = g.home === state.userId,
        result =
          g.hg === null
            ? ""
            : g.hg === g.ag
              ? "draw"
              : (ownHome ? g.hg : g.ag) > (ownHome ? g.ag : g.hg)
                ? "win"
                : "loss";
      return `<button class="fixture-row ${result}" data-action="match" data-id="${g.id}" ${g.hg === null ? "disabled" : ""}><span class="match-round">${String(g.round).padStart(2, "0")}<small>ROUND</small></span><span class="fixture-team home-team">${esc(cBy(g.home)?.ko)} ${badge(cBy(g.home), "mini")}</span><b class="score">${g.hg === null ? "vs" : `${g.hg} : ${g.ag}`}</b><span class="fixture-team away-team">${badge(cBy(g.away), "mini")} ${esc(cBy(g.away)?.ko)}</span><span class="match-tag">${g.hg === null ? "예정" : result === "win" ? "승" : result === "draw" ? "무" : "패"}</span></button>`;
    })
    .join("")}</div>`;
}
function leaders() {
  const a = state.players.filter((p) => p.stats.apps > 0);
  return `<div class="leader-grid">${[
    ["goals", "득점 순위", "GOLDEN BOOT"],
    ["assists", "도움 순위", "PLAYMAKERS"],
  ]
    .map(
      ([k, n, label]) =>
        `<section class="panel"><div class="section-title"><h2>${n}</h2><span>${label}</span></div>${
          a.length
            ? [...a]
                .sort((a, b) => b.stats[k] - a.stats[k] || b.ca - a.ca)
                .slice(0, 15)
                .map(
                  (p, i) =>
                    `<button class="leader-row" data-action="player" data-id="${p.id}"><span>${i + 1}</span><div><b>${esc(p.name)}</b><small>${esc(cBy(p.clubId)?.ko ?? "자유계약")}</small></div><strong>${p.stats[k]}</strong></button>`,
                )
                .join("")
            : '<div class="empty compact">첫 경기를 기다리고 있습니다.</div>'
        }</section>`,
    )
    .join("")}</div>`;
}
function review() {
  const summaries = state.reports.filter((r) => r.year === state.year),
    last = state.history.find((h) => h.year === state.year);
  return `<div class="reports">${last ? `<section class="season-review"><div class="eyebrow">SEASON ${season(last.year)}</div><h2>${last.position === 1 ? "프리미어리그 챔피언." : last.position >= 18 ? "다음 도전을 기약하며." : last.achieved ? "계획이 성과가 되었습니다." : "새로운 도전은 계속됩니다."}</h2><div class="review-stats"><div><strong>${last.position}위</strong><span>최종 순위</span></div><div><strong>${last.points}</strong><span>승점</span></div><div><strong>${last.w}-${last.d}-${last.l}</strong><span>승-무-패</span></div><div><strong>${last.gf} : ${last.ga}</strong><span>득점 : 실점</span></div></div><div class="review-note"><p>시즌 MVP <b>${esc(last.mvp?.name ?? "—")}</b></p><p>감독 평가 <b>${esc(last.managerRating)}</b></p><p>손익 <b class="${last.income - last.expenses < 0 ? "danger-text" : ""}">${money(last.income - last.expenses)}</b></p></div></section>` : ""}${summaries.map((r) => `<section class="panel"><div class="section-title"><h2>${r.half} 보고서</h2><span>19 MATCHES</span></div><div class="review-stats"><div><strong>${r.position}위</strong><span>보고 시점 순위</span></div><div><strong>${r.w}-${r.draws}-${19 - r.w - r.draws}</strong><span>승-무-패</span></div><div><strong>${r.goals} : ${r.against}</strong><span>득점 : 실점</span></div></div><p class="muted">${r.position <= E.club(state).target ? "시즌 목표를 향해 순조롭게 나아가고 있습니다." : "선수단 구성과 감독의 운영 방향을 검토할 때입니다."}</p></section>`).join("")}${!summaries.length ? '<div class="empty">전반기 19경기 진행 후 첫 보고서가 도착합니다.</div>' : ""}</div>`;
}
function managerView() {
  const m = E.manager(state),
    c = E.club(state);
  return `${heading("THE DUGOUT", "감독", `<span class="heading-note">전술과 선발은 감독이 결정합니다.</span>`)}${
    m
      ? `<section class="manager-profile"><div class="manager-profile-top"><span class="coach-avatar">${esc(
          m.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join(""),
        )}</span><div><span class="eyebrow">HEAD COACH ${m.real ? "" : "· 가상 감독"}</span><h2>${esc(m.name)}</h2><p>${m.formation} · ${m.style} · ${esc(m.nat)}${m.age !== null ? " · " + m.age + "세" : ""}</p></div><span class="rating large-rating">${Math.round((m.attack + m.defense) / 2)}</span></div><div class="manager-attributes">${[
          ["attack", "공격 운영"],
          ["defense", "수비 운영"],
          ["youth", "유망주 육성"],
          ["management", "선수단 관리"],
          ["relationship", "구단주 관계"],
        ]
          .map(
            ([k, n]) =>
              `<div><span>${n}</span><div class="meter"><i style="width:${m[k]}%"></i></div><b>${m[k]}</b></div>`,
          )
          .join(
            "",
          )}</div><div class="manager-contract"><div><span>주급</span><b>${wage(m.wage)}</b></div><div><span>계약 만료</span><b>${m.contract}년</b></div><div><span>승률</span><b>${m.games ? Math.round((m.wins / m.games) * 100) : 0}% <small>(${m.games}경기)</small></b></div><div><span>전술 적응도</span><b>${Math.round(100 - c.adaptation * 7)}%</b></div></div><div class="manager-actions">${btn("계약 갱신", "manager-renew", "button subtle", state.gameOver ? "disabled" : "")}${btn("감독 경질", "manager-sack", "button danger-outline", state.gameOver ? "disabled" : "")}</div></section><div class="tactical-note"><b>${m.style} 축구</b><p>${{ 점유율: "중원 자원을 중심으로 경기를 풀어갑니다. 미드필더의 능력과 포지션 적합도가 공격 전개에 영향을 줍니다.", 압박: "공격적으로 공을 되찾습니다. 공격 기회가 늘어나며 수비 뒷공간의 위험도 함께 커집니다.", 역습: "수비의 안정감을 바탕으로 빠르게 전환합니다. 공격진의 결정력이 성적을 좌우합니다.", 실리: "수비 조직을 우선합니다. 강한 상대에게도 승점을 얻을 가능성을 높입니다.", 직선적: "빠르게 전방으로 전개합니다. 전방 공격수와 측면 자원의 구성이 중요합니다.", 균형: "공격과 수비의 균형을 유지합니다. 전체 포지션의 깊이가 성적에 반영됩니다." }[m.style]}</p><span>${m.youth >= 78 ? "어린 선수에게 적극적으로 기회를 줍니다." : "현재 능력이 높은 선수를 우선 기용합니다."}</span></div>`
      : `<div class="alert"><b>새 감독을 선임하세요.</b><p>공석 기간에는 코칭스태프가 기본 전술로 경기를 운영합니다.</p></div>`
  }<div class="section-title spaced"><h2>감독 시장</h2><span>능력·급여는 게임 추정치</span></div><div class="manager-market">${state.managers
    .filter((x) => x.clubId !== state.userId)
    .sort((a, b) => !!a.clubId - !!b.clubId || b.rep - a.rep)
    .slice(0, 30)
    .map(
      (x) =>
        `<button class="manager-candidate" data-action="manager-detail" data-id="${x.id}"><div><span class="monogram small-mono">${esc(
          x.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join(""),
        )}</span><span><b>${esc(x.name)} ${!x.real ? '<i class="generated-label">가상</i>' : ""}</b><small>${esc(cBy(x.clubId)?.ko ?? "자유계약")} · ${x.formation}</small></span></div><span class="candidate-style">${x.style}</span><b class="ability ${x.rep >= 80 ? "elite" : ""}">${x.rep}</b></button>`,
    )
    .join("")}</div>`;
}
function recordsView() {
  const hist = state.history;
  const titles = hist.filter((h) => h.position === 1).length;
  return `${heading("THE CLUB ARCHIVE", "기록", `<span class="heading-note">${state.gameOver ? "CAREER COMPLETE" : "YOUR LEGACY"}</span>`)}<div class="career-stats"><div><span>함께한 시즌</span><b>${hist.length}</b></div><div><span>리그 우승</span><b>${titles}</b></div><div><span>최고 순위</span><b>${hist.length ? Math.min(...hist.map((h) => h.position)) + "위" : "—"}</b></div><div><span>통산 승리</span><b>${hist.reduce((a, h) => a + h.w, 0)}</b></div></div>${tabs(
    [
      ["history", "시즌 역사"],
      ["transfers", "이적 기록"],
      ["finance", "재정 장부"],
      ["managers", "역대 감독"],
      ["players", "주요 선수"],
    ],
    recordTab,
    "record-tab",
  )}${
    recordTab === "history"
      ? hist.length
        ? `<div class="history-list">${[...hist]
            .reverse()
            .map(
              (h) =>
                `<section class="history-card"><div><span class="eyebrow">${season(h.year)}</span><h2>${h.position}위 ${h.position === 1 ? icon("records", 24) : ""}</h2><span class="${h.achieved ? "positive" : "muted"}">${h.achieved ? "목표 달성" : "목표 미달"} · ${h.points}점</span></div><dl><div><dt>승·무·패</dt><dd>${h.w} · ${h.d} · ${h.l}</dd></div><div><dt>감독</dt><dd>${esc(h.manager ?? "대행")}</dd></div><div><dt>시즌 MVP</dt><dd>${esc(h.mvp?.name ?? "—")}</dd></div><div><dt>수익 / 지출</dt><dd>${money(h.income)} / ${money(h.expenses)}</dd></div><div><dt>리그 챔피언</dt><dd>${esc(h.champion)}</dd></div></dl></section>`,
            )
            .join("")}</div>`
        : '<div class="empty">첫 시즌이 끝나면 구단의 역사가 기록됩니다.</div>'
      : recordTab === "transfers"
        ? transferHistory()
        : recordTab === "finance"
          ? financeView()
          : recordTab === "managers"
            ? `<div class="panel">${[...state.managerHistory]
                .reverse()
                .map(
                  (m) =>
                    `<div class="archive-row"><span>${season(m.year)} · ${E.PHASES[m.phase]}</span><b>${esc(m.name)}</b><span>${m.action}</span>${m.fee ? `<b>${money(m.fee)}</b>` : ""}</div>`,
                )
                .join("")}</div>`
            : careerPlayers()
  }`;
}
function transferHistory() {
  const a = state.transfers.filter(
    (t) => t.from === state.userId || t.to === state.userId,
  );
  return `<div class="panel">${
    a.length
      ? a
          .slice(0, 150)
          .map(
            (t) =>
              `<div class="transfer-row"><span class="transfer-kind ${t.to === state.userId ? "in" : "out"}">${esc(t.kind)}</span><div><b>${esc(t.name)}</b><span>${esc(cBy(t.from)?.ko ?? "자유계약")} → ${esc(cBy(t.to)?.ko ?? "자유계약")}</span></div><div><b>${money(Math.abs(t.fee))}</b><small>${season(t.year)}</small></div></div>`,
          )
          .join("")
      : '<div class="empty compact">아직 이적 기록이 없습니다.</div>'
  }</div>`;
}
function financeView() {
  const a = state.ledger.filter((l) => l.year === state.year);
  const cats = {};
  for (const l of a) cats[l.category] = (cats[l.category] ?? 0) + l.amount;
  return `<section class="panel finance-panel"><div class="section-title"><h2>${season(state.year)} 재정</h2><span>£ MILLION</span></div><div class="finance-total"><span>현재 가용 자금</span><b>${money(E.club(state).balance)}</b></div>${Object.entries(
    cats,
  )
    .map(
      ([n, v]) =>
        `<div class="finance-line"><span>${n}</span><b class="${v >= 0 ? "positive" : "danger-text"}">${v >= 0 ? "+" : "−"}${money(Math.abs(v))}</b></div>`,
    )
    .join(
      "",
    )}<div class="finance-line total"><span>시즌 손익</span><b>${money(a.reduce((v, l) => v + l.amount, 0))}</b></div><p class="tiny">현금 잔액은 이전 시즌에서 누적됩니다. 이적 예산은 구단이 배정한 별도의 지출 한도입니다.</p></section>`;
}
function careerPlayers() {
  const a = state.players
    .filter((p) => (p.ownerStats?.apps ?? 0) > 0)
    .sort((a, b) => (b.ownerStats?.goals ?? 0) - (a.ownerStats?.goals ?? 0))
    .slice(0, 30);
  return `<div class="panel">${a.length ? a.map((p, i) => `<button class="leader-row" data-action="player" data-id="${p.id}"><span>${i + 1}</span><div><b>${esc(p.name)}</b><small>${p.retired ? "은퇴" : esc(cBy(p.clubId)?.ko ?? "자유계약")} · 이 구단에서 ${p.ownerStats?.apps ?? 0}경기</small></div><strong>${p.ownerStats?.goals ?? 0}<small>골</small></strong></button>`).join("") : '<div class="empty compact">경기가 진행되면 주요 선수의 기록이 쌓입니다.</div>'}</div>`;
}
function renderModal() {
  const root = $("#modal-root");
  if (!modal) {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    return;
  }
  document.body.classList.add("modal-open");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal ${modal.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(modal.title ?? "상세 정보")}"><div class="modal-header"><span class="eyebrow">${esc(modal.label ?? "TOUCHLINE")}</span>${btn(icon("close"), "close-modal", "icon-button", 'aria-label="닫기"')}</div>${modal.html}</section></div>`;
  setTimeout(() => root.querySelector("button,input")?.focus(), 20);
}
function showModal(
  html,
  title = "상세 정보",
  label = "TOUCHLINE",
  wide = false,
) {
  modal = { html, title, label, wide };
  renderModal();
}
function confirmAction(title, description, action, id = "", label = "확인") {
  showModal(
    `<h2>${title}</h2><p class="modal-description">${description}</p><div class="modal-buttons">${btn("취소", "close-modal", "button subtle")}${btn(label, action, "button green", `data-id="${esc(id)}"`)}</div>`,
    title,
    "CONFIRM DECISION",
  );
}
function playerModal(id) {
  const p = pBy(id);
  if (!p) return;
  const own = p.clubId === state.userId;
  const out = p.loanParent === state.userId;
  const mkt = E.marketOpen(state);
  const c = cBy(p.clubId);
  showModal(
    `<div class="player-profile-head"><span class="position big-pos pos-${E.GROUP[p.pos]}">${p.pos}</span><div><h2>${esc(p.name)}</h2><p>${esc(c?.ko ?? (p.unverifiedAffiliation ? "소속 미확인" : "자유계약"))} · ${esc(p.nat)} · ${p.age === null ? "나이 미확인" : p.age + "세"} ${!p.real ? '<i class="generated-label">가상 유망주</i>' : ""}</p></div></div><div class="profile-abilities"><div><strong>${p.ca}</strong><span>현재 능력</span></div><div><strong>${p.pa}</strong><span>잠재 능력</span></div><div><strong>${money(p.value)}</strong><span>시장 가치</span></div></div><div class="profile-stats">${[
      ["출전", p.stats.apps],
      ["골", p.stats.goals],
      ["도움", p.stats.assists],
      ["출전 시간", p.stats.minutes + "′"],
    ]
      .map(([n, v]) => `<div><b>${v}</b><span>${n}</span></div>`)
      .join(
        "",
      )}</div><dl class="detail-list"><div><dt>주급</dt><dd>${wage(p.wage)}</dd></div><div><dt>계약 만료</dt><dd>${p.contract}년 ${p.loanParent ? "· 시즌 임대" : ""}</dd></div><div><dt>부 포지션</dt><dd>${p.secondary.length ? p.secondary.join(" / ") : "—"}</dd></div><div><dt>컨디션 / 사기</dt><dd>${Math.round(p.fitness)} / ${Math.round(p.morale)}</dd></div><div><dt>상태</dt><dd class="${p.injury ? "danger-text" : ""}">${p.retired ? "은퇴" : p.injury ? `부상 · ${p.injury}경기 결장 예상` : "출전 가능"} ${p.trend > 0 ? "· 성장 +" + p.trend : p.trend < 0 ? "· 능력 " + p.trend : ""}</dd></div><div><dt>자료 기준</dt><dd>${p.real ? (p.source === "fpl-2026-11-02" ? "2026.11.02 EPL 대조" : "2026.07.06 해외 자료") : "게임 내 생성"}${state.year > 2026 ? " · 이후 게임 세계" : ""}</dd></div></dl><p class="tiny">능력·잠재력·가치·급여·계약은 게임 내 추정치입니다.</p>${state.gameOver || p.retired ? "" : own ? `${p.loanParent ? '<div class="alert">시즌 종료 시 원소속팀으로 복귀합니다.</div>' : `<div class="modal-section"><h3>재계약 제안</h3><div class="form-grid"><label>주급 (£k)<input id="renew-wage" type="number" min="1" step="1" value="${Math.ceil(p.wage * 1.2 * 1000)}"></label><label>기간<select id="renew-years">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 3 ? "selected" : ""} value="${n}">${n}년</option>`).join("")}</select></label>${btn("재계약 제안", "renew-player", "button green", `data-id="${p.id}"`)}</div></div><div class="player-actions">${btn(p.listed ? "이적 명단 해제" : "이적 명단 등록", "list-player", "button subtle", `data-id="${p.id}" ${mkt ? "" : "disabled"}`)}${btn("임대 방출", "loan-player", "button subtle", `data-id="${p.id}" ${mkt ? "" : "disabled"}`)}${btn("계약 해지", "release-confirm", "text-button danger-text", `data-id="${p.id}"`)}</div>`}` : out ? '<div class="alert">임대 방출 중입니다. 시즌 종료 후 복귀합니다.</div>' : p.unverifiedAffiliation ? '<div class="alert">현재 소속을 확인하지 못한 선수입니다. 잘못된 자유계약 영입을 막기 위해 협상 대상에서 제외했습니다.</div>' : `<div class="modal-section"><h3>${mkt ? "영입 제안" : "이적시장 종료"}</h3><div class="form-grid transfer-form"><label>이적료 (£m)<input id="offer-fee" type="number" min="0" step="0.1" value="${(p.value * 1.2).toFixed(1)}" ${p.clubId ? "" : "disabled"}></label><label>주급 (£k)<input id="offer-wage" type="number" min="1" step="1" value="${Math.ceil(p.wage * 1.25 * 1000)}"></label><label>기간<select id="offer-years">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 3 ? "selected" : ""} value="${n}">${n}년</option>`).join("")}</select></label></div><div class="modal-buttons">${p.clubId ? btn(`시즌 임대 · ${money(p.value * 0.08)}`, "loan-in", "button subtle", `data-id="${p.id}" ${!mkt || p.loanParent ? "disabled" : ""}`) : '<span class="tiny">이적료 없이 계약 보너스를 지급합니다.</span>'}${btn("제안 보내기", "buy-player", "button green", `data-id="${p.id}" ${!mkt || p.loanParent ? "disabled" : ""}`)}</div><div id="negotiation-result" role="status"></div></div>`}`,
    p.name,
    "PLAYER PROFILE",
  );
}
function decisionModal(id) {
  const d = state.decisions.find((d) => d.id === id);
  if (!d) return;
  showModal(
    `<div class="decision-symbol">${icon(d.type === "raise" ? "wallet" : "mail", 28)}</div><h2>${esc(d.title)}</h2><p class="modal-description">${esc(d.description)}</p><div class="decision-choices">${d.choices.map((c, i) => btn(`<b>${esc(c.label)}</b><span>${esc(c.effect)}</span>${icon("arrow", 18)}`, "resolve-decision", "decision-choice", `data-id="${id}" data-choice="${i}"`)).join("")}</div>`,
    d.title,
    "BOARD DECISION",
  );
}
function managerModal(id) {
  const m = state.managers.find((m) => m.id === id);
  if (!m) return;
  showModal(
    `<h2>${esc(m.name)} ${!m.real ? '<i class="generated-label">가상 감독</i>' : ""}</h2><p class="modal-description">${esc(cBy(m.clubId)?.ko ?? "자유계약")} · ${m.formation} · ${m.style}</p><div class="manager-attributes">${[
      ["attack", "공격"],
      ["defense", "수비"],
      ["youth", "육성"],
      ["management", "관리"],
    ]
      .map(
        ([k, n]) =>
          `<div><span>${n}</span><div class="meter"><i style="width:${m[k]}%"></i></div><b>${m[k]}</b></div>`,
      )
      .join(
        "",
      )}</div><dl class="detail-list"><div><dt>국적 / 나이</dt><dd>${esc(m.nat)} / ${m.age ?? "미확인"}</dd></div><div><dt>요구 주급</dt><dd>${wage(m.wage)}</dd></div><div><dt>선임 비용</dt><dd>${money(m.clubId ? m.wage * 52 : m.wage * 8)}</dd></div></dl><p class="tiny">감독의 능력·급여·성향은 게임 내 추정치입니다.</p><div class="form-grid"><label>주급 (£k)<input id="hire-wage" type="number" value="${Math.ceil(m.wage * 1.1 * 1000)}" min="1"></label><label>기간<select id="hire-years"><option value="2">2년</option><option value="3" selected>3년</option><option value="4">4년</option></select></label>${btn("감독 선임", "hire-manager", "button green", `data-id="${m.id}" ${E.manager(state) || state.gameOver ? "disabled" : ""}`)}</div>${E.manager(state) ? '<p class="tiny">현재 감독의 계약을 정리한 후 선임할 수 있습니다.</p>' : ""}`,
    m.name,
    "MANAGER PROFILE",
  );
}
function matchModal(id) {
  const g = state.fixtures.find((g) => g.id === id);
  if (!g || g.hg === null) return;
  showModal(
    `<span class="eyebrow">MATCHWEEK ${g.round} · ${season(state.year)}</span><div class="match-detail"><div>${badge(cBy(g.home), "large")}<b>${esc(cBy(g.home)?.ko)}</b></div><strong>${g.hg} : ${g.ag}</strong><div>${badge(cBy(g.away), "large")}<b>${esc(cBy(g.away)?.ko)}</b></div></div><div class="xg-row"><span>기대 득점</span><b>${g.hx.toFixed(2)} — ${g.ax.toFixed(2)}</b></div><div class="match-events">${g.events.map((e) => `<div class="${e.home ? "home-goal" : "away-goal"}"><span>${e.minute}′</span><div><b>${esc(pBy(e.playerId)?.name ?? "선수")}</b><small>${e.assistId ? "도움 " + esc(pBy(e.assistId)?.name ?? "선수") : "도움 없음"}</small></div><span>${e.home ? "HOME" : "AWAY"}</span></div>`).join("") || '<div class="empty compact">득점 없이 경기를 마쳤습니다.</div>'}</div>`,
    "경기 기록",
    "MATCH REPORT",
  );
}
function sourcesModal() {
  showModal(
    `<h2>데이터와 게임 세계</h2><div class="source-count"><b>${data.meta.realPlayers.toLocaleString()}</b><span>실존 선수 · ${data.meta.clubs.toLocaleString()}개 구단 자료</span></div><div class="source-notice"><b>시작 세계의 기준</b><p>EPL 20개 구단 및 ${data.meta.eplPlayers}명의 소속을 2026.11.02 활동 명단과 대조했습니다. 개막 전의 선수단을 재현한 버전은 아닙니다. 해외 소속은 2026.07.06 자료를 사용합니다.</p><b>게임 내 추정치</b><p>능력, 잠재력, 시장 가치, 급여, 계약, 예산, 감독 능력·성향은 시뮬레이션용 수치입니다. 실제 계약이나 가격으로 해석하면 안 됩니다.</p><b>이후의 변화</b><p>게임을 시작한 뒤의 이적, 경기 결과, 승강, 성장과 은퇴는 가상의 시뮬레이션입니다. 생성 선수·감독은 ‘가상’으로 표시합니다.</p></div><div class="source-links">${data.meta.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(s.name)}<small>${s.date}</small></span>${icon("arrow", 16)}</a>`).join("")}</div><p class="tiny">해외 데이터: CC0-1.0 공개 배포본. 구단 마크는 자체 제작 문자 식별자이며 공식 엠블럼·선수 사진을 사용하지 않았습니다.</p><p class="tiny">일부 국적·나이는 미확인입니다. 해외 선수의 최신 이적 및 세계 모든 리그의 완전한 명단은 포함하지 못했습니다.</p>`,
    "데이터 출처",
    "DATA PROVENANCE",
    true,
  );
}
function settingsModal() {
  showModal(
    `<h2>커리어 설정</h2><p class="modal-description">자동 저장은 현재 브라우저에 보관됩니다. 기기를 바꾸기 전에 파일을 내보내세요.</p><div class="settings-list">${btn(`${icon("save")}<span>지금 저장</span>${icon("chevron", 16)}`, "manual-save", "settings-button")}${btn(`${icon("download")}<span>저장 파일 내보내기</span>${icon("chevron", 16)}`, "export", "settings-button")}${btn(`${icon("swap")}<span>저장 파일 불러오기</span>${icon("chevron", 16)}`, "import", "settings-button")}${btn(`${icon("info")}<span>데이터 출처와 추정치</span>${icon("chevron", 16)}`, "sources", "settings-button")}${btn(`${icon("flag")}<span>새 커리어 시작</span>${icon("chevron", 16)}`, "new-game", "settings-button")}${btn("현재 저장 초기화", "reset-confirm", "text-button danger-text full")}</div><p class="tiny">버전 1.0 · 오프라인 경기 엔진 · 마지막 저장 ${state.lastSaved ? new Date(state.lastSaved).toLocaleString("ko-KR") : "대기 중"}</p>`,
    "커리어 설정",
    "SETTINGS",
  );
}
async function mutate(fn, { close = true, playerId = null } = {}) {
  try {
    const result = fn();
    refreshMaps();
    if (close) modal = null;
    render();
    await persist();
    if (result?.message) toast(result.message, !result.ok);
    if (playerId) playerModal(playerId);
    return result;
  } catch (e) {
    errorMessage(e);
  }
}
async function advanceGame() {
  if (busy) return;
  modal = null;
  busy = true;
  render();
  await new Promise((r) => setTimeout(r, 50));
  try {
    E.advance(state);
    refreshMaps();
    view = "home";
    await persist();
  } catch (e) {
    errorMessage(e);
  } finally {
    busy = false;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
const actions = {
  "select-club": (el) => {
    selected = el.dataset.id;
    render();
  },
  start: () =>
    saved
      ? confirmAction(
          "새 커리어를 시작할까요?",
          "현재 브라우저의 저장이 새 커리어로 바뀝니다. 진행 중인 커리어는 설정에서 내보낼 수 있습니다.",
          "start-confirm",
          "",
          "새 게임 시작",
        )
      : actions["start-confirm"](),
  "start-confirm": async () => {
    state = E.newGame(data, selected);
    modal = null;
    view = "home";
    render();
    await persist();
    window.scrollTo(0, 0);
  },
  continue: () => {
    state = saved;
    view = "home";
    render();
    window.scrollTo(0, 0);
  },
  "retry-load": async () => {
    try {
      saved = S.assertSave(await S.load());
      loadError = "";
      render();
    } catch (e) {
      errorMessage(e);
    }
  },
  "close-modal": () => {
    modal = null;
    renderModal();
  },
  settings: settingsModal,
  sources: sourcesModal,
  advance: () => {
    const label = nextLabel();
    confirmAction(
      label,
      state.phase === 0 || state.phase === 2
        ? "이적시장을 마감하고 20개 구단의 19경기를 각각 진행합니다. 이후 결과와 보고서를 확인할 수 있습니다."
        : state.phase === 4
          ? "선수 성장과 노화, 계약 만료, 은퇴 및 승격·강등을 반영해 새 시즌을 시작합니다."
          : "다음 시즌 단계로 진행합니다.",
      "advance-confirm",
      "",
      label,
    );
  },
  "advance-confirm": advanceGame,
  "squad-tab": (el) => {
    sub = el.dataset.id;
    search = "";
    page = 0;
    pos = "";
    render();
  },
  "season-tab": (el) => {
    seasonTab = el.dataset.id;
    render();
  },
  "record-tab": (el) => {
    recordTab = el.dataset.id;
    render();
  },
  player: (el) => playerModal(el.dataset.id),
  decision: (el) => decisionModal(el.dataset.id),
  match: (el) => matchModal(el.dataset.id),
  "resolve-decision": (el) =>
    mutate(() =>
      E.resolveDecision(state, el.dataset.id, Number(el.dataset.choice)),
    ),
  invest: (el) =>
    confirmAction(
      "구단에 투자할까요?",
      {
        academy: "£8m을 투자해 유소년 배출과 성장 환경을 개선합니다.",
        facilities: "£6m을 투자해 경기 사이 선수들의 컨디션 회복을 돕습니다.",
        stadium: "£15m을 투자해 4,500석을 확장하고 입장 수익을 늘립니다.",
      }[el.dataset.id],
      "invest-confirm",
      el.dataset.id,
      "투자 실행",
    ),
  "invest-confirm": (el) =>
    mutate(() => {
      E.invest(state, el.dataset.id);
      toast("시설 투자를 완료했습니다.");
    }),
  offers: () => {
    view = "squad";
    sub = "offers";
    render();
    window.scrollTo(0, 0);
  },
  "prev-page": () => {
    page--;
    $("#player-list").innerHTML = playerList();
    $(".tabs").scrollIntoView({ behavior: "smooth" });
  },
  "next-page": () => {
    page++;
    $("#player-list").innerHTML = playerList();
    $(".tabs").scrollIntoView({ behavior: "smooth" });
  },
  "buy-player": (el) => buy(el.dataset.id, false),
  "loan-in": (el) => buy(el.dataset.id, true),
  "renew-player": (el) => {
    const w = Number($("#renew-wage").value) / 1000,
      y = Number($("#renew-years").value);
    mutate(() => E.renewPlayer(state, el.dataset.id, w, y), {
      playerId: el.dataset.id,
    });
  },
  "list-player": (el) =>
    mutate(
      () => {
        const listed = E.listPlayer(state, el.dataset.id);
        toast(
          listed
            ? "이적 명단에 등록했습니다. 제안함을 확인하세요."
            : "이적 명단에서 해제했습니다.",
        );
      },
      { playerId: el.dataset.id },
    ),
  "loan-player": (el) =>
    confirmAction(
      "시즌 임대로 방출할까요?",
      "관심 구단으로 임대하고 주급의 50%를 부담합니다. 시즌 종료 후 복귀합니다.",
      "loan-confirm",
      el.dataset.id,
      "임대 방출",
    ),
  "loan-confirm": (el) =>
    mutate(() => {
      const n = E.loanOut(state, el.dataset.id);
      toast(n + "로 임대했습니다.");
    }),
  "release-confirm": (el) => {
    const p = pBy(el.dataset.id),
      fee = p.wage * 26 * Math.max(1, p.contract - state.year);
    confirmAction(
      "계약을 해지할까요?",
      `${esc(p.name)}에게 보상금 £${fee.toFixed(1)}m을 지급합니다.`,
      "release-player",
      p.id,
      "계약 해지",
    );
  },
  "release-player": (el) => mutate(() => E.releasePlayer(state, el.dataset.id)),
  "accept-offer": (el) =>
    confirmAction(
      "이적 제안을 수락할까요?",
      "선수가 제안한 구단으로 이적하며 이적료가 재정과 예산에 반영됩니다.",
      "accept-confirm",
      el.dataset.id,
      "선수 판매",
    ),
  "accept-confirm": (el) =>
    mutate(() => E.respondOffer(state, el.dataset.id, true)),
  "reject-offer": (el) =>
    mutate(() => E.respondOffer(state, el.dataset.id, false)),
  "manager-detail": (el) => managerModal(el.dataset.id),
  "manager-sack": () => {
    const m = E.manager(state),
      fee = m.wage * 26 * Math.max(1, m.contract - state.year);
    confirmAction(
      "감독을 경질할까요?",
      `${esc(m.name)} 감독에게 위약금 £${fee.toFixed(1)}m을 지급합니다. 새 감독의 전술에 적응할 시간이 필요합니다.`,
      "sack-confirm",
      "",
      "감독 경질",
    );
  },
  "sack-confirm": () => mutate(() => E.sackManager(state)),
  "hire-manager": (el) => {
    const w = Number($("#hire-wage").value) / 1000,
      y = Number($("#hire-years").value);
    mutate(() => E.hireManager(state, el.dataset.id, w, y));
  },
  "manager-renew": () => {
    const m = E.manager(state);
    showModal(
      `<h2>감독 계약 갱신</h2><p class="modal-description">${esc(m.name)} · 현재 계약 ${m.contract}년</p><div class="form-grid"><label>주급 (£k)<input id="manager-wage" type="number" min="1" value="${Math.ceil(m.wage * 1.1 * 1000)}"></label><label>기간<select id="manager-years"><option>2</option><option selected>3</option><option>4</option></select></label>${btn("재계약", "renew-manager", "button green")}</div>`,
      "감독 재계약",
      "CONTRACT",
    );
  },
  "renew-manager": () => {
    const w = Number($("#manager-wage").value) / 1000,
      y = Number($("#manager-years").value);
    mutate(() => E.renewManager(state, w, y));
  },
  "manual-save": async () => {
    await persist();
    if (!saveError) toast("커리어를 저장했습니다.");
  },
  export: () => S.exportSave(state),
  import: () => $("#import-save").click(),
  "new-game": () =>
    confirmAction(
      "새 커리어를 시작할까요?",
      "현재 커리어는 새 구단으로 시작하기 전까지 보존됩니다. 구단 선택 화면으로 이동합니다.",
      "select-new",
      "",
      "구단 선택",
    ),
  "select-new": () => {
    saved = state;
    state = null;
    modal = null;
    refreshMaps();
    render();
    window.scrollTo(0, 0);
  },
  "reset-confirm": () =>
    confirmAction(
      "현재 저장을 초기화할까요?",
      "브라우저에 저장된 커리어를 삭제합니다. 먼저 저장 파일을 내보내면 이후 다시 불러올 수 있습니다.",
      "reset-save",
      "",
      "저장 삭제",
    ),
  "reset-save": async () => {
    await S.clear();
    state = null;
    saved = null;
    modal = null;
    render();
    toast("현재 저장을 삭제했습니다.");
  },
};
async function buy(id, loan) {
  const fee = Number($("#offer-fee").value),
    w = Number($("#offer-wage").value) / 1000,
    years = Number($("#offer-years").value);
  try {
    const result = E.offerTransfer(state, id, { fee, wage: w, years, loan });
    refreshMaps();
    if (result.ok) {
      modal = null;
      render();
      toast(result.message);
    } else {
      const el = $("#negotiation-result");
      el.className = "negotiation-result";
      el.innerHTML = `<b>${esc(result.message)}</b><span>요구 이적료 £${result.counterFee.toFixed(1)}m · 주급 ${wage(result.counterWage)} · 남은 협상 ${result.remaining}회</span>`;
    }
    await persist();
  } catch (e) {
    errorMessage(e);
  }
}
document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled || busy) return;
  event.preventDefault();
  const action = el.dataset.action;
  try {
    if (action.startsWith("nav-")) {
      view = action.slice(4);
      modal = null;
      render();
      window.scrollTo({ top: 0, behavior: "instant" });
    } else await actions[action]?.(el);
  } catch (e) {
    errorMessage(e);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal) {
    modal = null;
    renderModal();
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("tr[data-action]")
  ) {
    event.preventDefault();
    playerModal(event.target.dataset.id);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    search = event.target.value;
    page = 0;
    $("#player-list").innerHTML = playerList();
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target,
    id = el.id;
  const filters = {
    position: (v) => (pos = v),
    sort: (v) => (sort = v),
    league: (v) => (league = v),
    minca: (v) => (minCa = E.clamp(Number(v) || 0, 0, 99)),
    maxage: (v) => (maxAge = E.clamp(Number(v) || 50, 15, 50)),
    maxvalue: (v) => (maxValue = E.clamp(Number(v) || 0, 0, 999)),
  };
  if (filters[id]) {
    filters[id](el.value);
    page = 0;
    $("#player-list").innerHTML = playerList();
  }
  if (id === "target") await mutate(() => E.setTarget(state, Number(el.value)));
  if (id === "import-save" && el.files[0]) {
    try {
      if (el.files[0].size > 100 * 1024 * 1024)
        throw Error("100MB 이하의 저장 파일을 선택해 주세요.");
      const incoming = S.assertSave(JSON.parse(await el.files[0].text()));
      modal = null;
      state = incoming;
      view = "home";
      await persist();
      render();
      toast("커리어를 불러왔습니다.");
    } catch (e) {
      errorMessage(e);
    }
    el.value = "";
  }
});
async function init() {
  try {
    const names = ["meta", "clubs", "players", "managers"];
    const values = await Promise.all(
      names.map(async (n) => {
        const r = await fetch(new URL(`../data/${n}.json`, import.meta.url));
        if (!r.ok) throw Error("선수 자료를 불러올 수 없습니다.");
        return r.json();
      }),
    );
    data = Object.fromEntries(names.map((n, i) => [n, values[i]]));
    try {
      const value = await S.load();
      if (value) saved = S.assertSave(value);
    } catch (e) {
      loadError =
        "브라우저의 저장 정보를 확인하지 못했습니다. 저장 파일이 있다면 설정에서 불러오세요.";
    }
    refreshMaps();
    render();
  } catch (e) {
    $("#app").innerHTML =
      `<div class="boot"><h2>축구 세계를 불러오지 못했습니다.</h2><p>${esc(e.message)}</p><button class="button green" onclick="location.reload()">다시 시도</button></div>`;
  }
}
init();
