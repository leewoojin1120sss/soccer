# 데이터 기준과 출처

수집·확인일: **2026-11-02**. 게임 시작 표시는 2026/27 시즌 준비(7월)이지만 실제 EPL 초기 소속은 확인일의 활동 선수 명단입니다. 7월 개막 전 상태를 재현한다는 의미가 아닙니다.

## 실존 데이터 규모

- 선수: 22,353명, EPL 초기 활동 선수 564명
- 구단 자료: 1,855개. 모든 구단이 매 시즌 경기를 시뮬레이션하는 것은 아닙니다.
- 국내 리그 메타데이터: 31개. EPL, 라리가, 분데스리가, 세리에 A, 리그 1, 포르투갈, 네덜란드, 벨기에, 브라질, 아르헨티나, MLS, 사우디, K리그, J리그 등을 포함합니다.
- 공식 9월 EPL 566명 목록과 11월 FPL 활동 564명 목록은 시점과 등록 범위가 다릅니다. `can_select=true`를 기준으로 사용했습니다. 모든 670명에서 `removed=false`이므로 이를 활동 판정으로 사용하지 않았습니다.

## 1차 확인 자료

| 자료                               | 기준/용도                                                                      | URL                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Premier League 공식 회원 구단 변경 | 2026-06-05. 승격 Coventry, Ipswich, Hull / 강등 Wolves, Burnley, West Ham 확인 | https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts |
| Premier League 등록 선수           | 2026-09-03                                                                     | https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists      |
| Premier League 선수 번호 명단      | 2026-09-22, 20개 구단 566명 대조                                               | https://www.premierleague.com/en/news/4725682                                                    |
| FPL bootstrap                      | 2026-11-02, 소속·이름·생일 및 이적 사실 대조                                   | https://fantasy.premierleague.com/api/bootstrap-static/                                          |
| Premier League 현재 감독           | 2026-11-02 열람. 게시일이 2025년으로 보이나 현재 명단이 유지되는 페이지        | https://www.premierleague.com/en/news/4325264/list-of-202627-premier-league-club-managers        |
| dcaribou/transfermarkt-datasets    | 2026-07-06 스냅샷. 원 배포 CC0-1.0, 이후 갱신 중단                             | https://github.com/dcaribou/transfermarkt-datasets                                               |

## 수록 원칙

기본 CSV의 `last_season >= 2025`, 합리적인 활동 연령(15~43)을 사용했습니다. EPL 현재 활동 명단에서 확인된 선수는 옛 기록만 있더라도 고유 ID를 복원했습니다. 이름과 생일이 모두 다른 유사 이름(예: Jan Ángulo와 Juan Angulo)은 별도 인물로 유지했습니다. George Hemmings와 El Hadji Malick Diouf는 소스 간 생일 표기 차이가 있어 최신 FPL 표기를 사용했습니다. 이름은 대소문자/악센트를 정규화하되 모호한 이름은 억지로 연결하지 않았습니다. 별도 37개 대응은 이름과 생일을 대조했습니다. 22명의 추가 EPL 인물은 원 CSV에 없으므로 FPL 사실만으로 별도 ID를 부여했고, 국적·세부 포지션 등 미확인 사실을 보충해 지어내지 않았습니다.

`docs/identity-overrides.json`, `identity-override-evidence.json`은 고유 인물 대응 근거입니다. `departure-overrides.json`에는 99명의 확인된 이적/임대 관련 대조 근거가 있습니다. 목적 구단 ID가 확인되는 경우에만 초기 소속을 보정했습니다. 전 EPL 소속이지만 이후 소속이 확인되지 않는 선수는 소속 미확인으로 분리하고 협상을 막았습니다. `import-audit.json`에는 파싱 인원과 EPL 구단별 인원이 있습니다.

원 자료는 이름, 생일, 국적, 포지션, 고유 ID, 소속 등 사실 항목을 중심으로 가공했습니다. 선수 사진, 이미지 URL, 구단 공식 엠블럼, FPL 포인트/경기 기록/선정률/스카우트 기사 등은 배포하지 않습니다. FPL 자료 전체가 CC0라는 의미가 아니며, CC0 표기는 dcaribou 해외 기본 자료에만 적용됩니다.

## 게임 추정치

- 시장 가치: 해외 기본 공개 유로 가치의 게임용 파운드 환산 계수 0.85를 시드로 사용합니다. 실시간 환율이 아니며 실제 거래 가격도 아닙니다.
- 능력: `52 + 6.1 * log2(1 + 게임 가치(£m))`, 38~94 한도, 21세 미만 보정. 데이터 보충 선수는 별도 일관된 가상 평가를 사용합니다.
- 잠재력: 현재 능력·나이·ID에서 얻은 고정 시드에 따라 생성, 최대 97.
- 주급·계약: 게임 가치와 고정 시드에서 생성. 확인된 실제 계약 금액/기간이라는 주장을 하지 않습니다.
- 구단 재정·목표, 감독 능력·전술·선호 포메이션·급여·계약은 게임 모델입니다. 실제 감독의 이름과 최초 소속은 공식 목록을 따릅니다. 미확인 생일·국적은 미확인 표시입니다.
- 새 게임 이후 모든 소속 변경/기록/승강/은퇴는 시뮬레이션입니다. 생성 유망주와 감독은 `real:false`, `source:generated`로 구분됩니다.

## 재구축

`scripts/import-data.py`는 원본 `players.csv.gz`, `clubs.csv.gz`, `competitions.csv.gz`, `fpl.json`, `epl-squads.json`, `managers.json`, `identity-overrides.json`, `departure-overrides.json`이 있는 폴더를 입력받습니다. 출처 URL은 `data/meta.json`에 있으며 직접 배포본 CSV 주소는 다음과 같습니다.

- https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz
- https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/clubs.csv.gz
- https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/competitions.csv.gz

```sh
python scripts/import-data.py /absolute/path/to/source-snapshots
```

이 프로젝트가 배포하는 정규화 JSON이 고정된 시작 세계이며 실행 중 원격 자료를 불러오지 않습니다. 나중에 재수집하면 기준일과 대응 근거를 다시 검토해야 합니다.
