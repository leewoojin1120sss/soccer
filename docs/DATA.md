# 데이터 기준과 출처 · v2

확인일 2026-11-02. PL 20개 공식 명단 601명 + 별도 공식 아카데미 7명, 총608명을 전수 대조했습니다. 전체 실존 DB는 22,383명입니다. 세부 감사 결과, 구단별 집계, 평가 방식, 전후 비교 및 불확실한 항목은 [PLAYER_AUDIT.md](PLAYER_AUDIT.md)를 참고하세요.

초기 세계는 2026/27 시즌 준비이지만 실제 소속은 확인일의 명단으로 구성한 대체 시작 세계입니다. 실제 7월 개막 전 명단이나 현실 경기 결과를 재현하지 않습니다. PL 선수 나이는 확인된 생일을 기준으로 2026-11-02에 계산합니다.

## 자료와 권리

- 해외 기본 자료: [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets), 2026-07-06 스냅샷, 원 배포 CC0-1.0. 이전 시즌 현역 기록과 연령을 기준으로 추렸습니다. 해외 전체의 여름 이적을 모두 반영하지 못했습니다.
- PL 사실: [Premier League 공식 구단 명단](https://www.premierleague.com/en/clubs), 구단 공식 이적·임대 발표, 일부 UEFA 및 구단 전기. 정확한 선수·필드별 출처는 `data/pl-audit-input.json`과 감사 문서에 있습니다.
- 출전 근거: 공식 FPL의 현 시즌 수치와 [FPL Historical Dataset — Vaastav Anand](https://github.com/vaastav/Fantasy-Premier-League)의 2024/25·2025/26 출전 사실. FPL 포인트·가격을 공식 능력으로 취급하지 않습니다. 이 자료 전체가 CC0라는 주장은 하지 않습니다.
- 유망주 참고: [Golden Boy 공식 후보](https://www.goldenboyaward.com/news-and-articles/golden-boy-2026-here-are-the-25-finalists) 및 공식 구단의 선수 경력·기용 자료.
- 사진·이미지 URL·공식 엠블럼은 배포하지 않습니다. 구단 문자는 자체 제작 식별자입니다.

## 사실과 게임 수치의 구분

이름·대표 국적·생일·포지션·확인일의 소속은 사실 데이터입니다. 생일을 확인하지 못한 신규 유소년은 미확인으로 남겼습니다. 대표 국적을 모든 시민권이나 출생지와 동일하게 취급하지 않습니다.

CA·PA·PA 범위·시장 가치·급여·계약·구단 예산·감독 능력은 게임 추정치입니다. 실제 계약 금액/기간이나 전문 기관의 확정된 선수 평가가 아닙니다. 과거 가격에 기반한 능력 대입과 ID 임의 PA 가산은 PL 검토 대상에서 제거했습니다. 고령에 따른 낮은 이적 가치가 곧 낮은 현재 실력을 의미하지 않도록 분리했습니다.

새 게임 이후 이적·경기·성장·노화·은퇴는 가상 세계의 결과입니다. 가상 유망주·감독은 `real:false`로 구분합니다.

## 갱신과 재현

```sh
npm run data:audit
```

이 명령은 `data/pl-audit-input.json`의 동결된 근거·원래 기준 수치에서 PL 오버레이와 감사 보고서를 다시 만듭니다. 같은 입력에서는 같은 결과가 나옵니다. 해외 기본 데이터를 `scripts/import-data.py`로 갱신해도 마지막에 이 오버레이를 재적용합니다. 기준일이 바뀌면 공식 명단과 이적 발표를 다시 조사해야 합니다.

`data/roster-patch.json`은 기존 커리어 보정에 필요한 이전 기준입니다. `src/data-migration.js`가 인적 사항과 평가를 보정하면서 경기 사건·승점·거래·현금을 보존합니다.
