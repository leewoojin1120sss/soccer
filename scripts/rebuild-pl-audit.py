"""Deterministic EPL audit overlay. Uses a frozen, sourced input snapshot, never live APIs.
Rebuild: python scripts/rebuild-pl-audit.py
Ability and potential numbers are game estimates, not official player ratings.
"""
import csv,json,math,pathlib,datetime,collections
R=pathlib.Path(__file__).resolve().parents[1];D=R/'data';A=R/'docs/pl-audit';A.mkdir(exist_ok=True)
x=json.load(open(D/'pl-audit-input.json'));players=json.load(open(D/'players.json'));index={p['id']:p for p in players};clubs=json.load(open(D/'clubs.json'));clubmap={c['id']:c for c in clubs};meta=json.load(open(D/'meta.json'));baseline={};changes=[];notes=[]
DATE=datetime.date.fromisoformat(x['ageAsOf']);GROUP={'GK':'GK','DF':'DF','CB':'DF','LB':'DF','RB':'DF','MF':'MF','DM':'MF','CM':'MF','AM':'MF','LM':'MF','RM':'MF','FW':'FW','LW':'FW','RW':'FW','ST':'FW'}
def age(d):
 if not d:return None
 b=datetime.date.fromisoformat(d);return DATE.year-b.year-((DATE.month,DATE.day)<(b.month,b.day))
def clamp(v,a,b):return max(a,min(b,v))
def rating(q,p):
 a=p['age'];sim=a if a is not None else 18;g=GROUP[p['pos']];v=max(.05,q.get('seed',{}).get('value',.4) if q.get('seed') else .4);perf=q.get('performance',{});cur=perf.get('2026',{});past=[perf.get('2025',{}),perf.get('2024',{})];minutes=cur.get('minutes',0);history=max(past[0].get('minutes',0),past[1].get('minutes',0)*.85);projected=min(3200,minutes/9*38);rep=clubmap[q['clubId']]['rep']
 # Transfer prices contain age/resale premiums; they are a weak signal, never the sole rating.
 market=52+6.1*math.log2(1+v)
 market-=5 if sim<=21 else 2 if sim<=24 else 0
 floor=(70 if g=='GK' else 68) if sim>=25 else 64 if sim>=22 else 58 if sim>=20 else 52
 if q['rosterStatus']=='academy':floor=min(floor,58)
 established=history>=1200
 history_floor=(73+(rep-68)*.12)*min(1,history/2200) if history>0 else 0
 current_floor=(72+(rep-68)*.1)*min(1,projected/2100) if minutes>=180 else 0
 ca=round(max(floor,market,history_floor,current_floor))
 if sim<21 and v<1 and history<200 and minutes<90:ca=min(ca,64)
 elif sim<22 and v<1 and history<400 and minutes<450:ca=min(ca,76)
 if history>2200 and minutes>540:ca+=1
 ca=clamp(ca,45,94)
 review=q.get('review',{});ca=review.get('ca',ca)
 # No ID/name random bonuses. A young reserve is not automatically an elite prospect.
 if sim>=27:room=0
 elif sim>=24:room=2 if g!='GK' else 4
 elif sim>=22:room=4+(2 if established else 0)
 elif sim>=20:room=8+(2 if history>900 or minutes>400 else 0)
 else:room=12+(3 if minutes>300 else 0)
 if g=='GK' and sim<25:room+=2
 if sim<24 and v>=5:room+=2
 pa=round(max(ca,min(90,ca+room)))
 if sim<21:pa=max(pa,75 if q['rosterStatus']=='firstTeam' else 72)
 pa=max(ca,review.get('pa',pa))
 if sim>=30 and g!='GK':pa=ca
 if sim>=33 and g=='GK':pa=ca
 uncertain=not q.get('dob') or (minutes<180 and history<900)
 width=7 if not q.get('dob') else 4 if uncertain and sim<23 else 3 if sim<24 else 1
 band=[max(ca,pa-width),min(96,pa+width)] if sim<27 or(g=='GK' and sim<30) else [ca,ca]
 basis=review.get('basis','공식 소속·포지션, 2024/25·2025/26 출전과 현 시즌 기용에 따른 역할별 게임 추정')
 if not q.get('dob'):basis+=' · 생일 미확인: 육성 평가 불확실'
 # Price and salary are separate game quantities; older capable players can have low resale value.
 base=max(.1,2**((ca-52)/6.1)-1)
 resale=(.74**max(0,sim-30)) if g!='GK' else .78**max(0,sim-32)
 upside=1+max(0,pa-ca)*(.1 if sim<24 else .025)
 value=round(clamp(base*resale*upside,.1,220),2)
 wage=round(max(q.get('seed',{}).get('wage',.001) if q.get('seed') else .001,.012*2**((ca-70)/6)),3)
 return {'ca':ca,'pa':pa,'potentialBand':band,'ratingConfidence':'자료 부족' if uncertain else '보통','ratingBasis':basis,'ratingEvidence':{'minutes2026':minutes,'minutes2025':past[0].get('minutes',0),'minutes2024':past[1].get('minutes',0),'editorialReview':bool(review)},'value':value,'wage':wage}

def remember(id,old):
 if old:baseline[id]={k:old.get(k) for k in ['name','clubId','nat','dob','pos','secondary','ca','pa','value','wage','contract','initialLoanParent','unverifiedAffiliation']}

def record(old,p,action):
 fields={k:{'before':old.get(k),'after':p.get(k)} for k in ['name','clubId','nat','dob','pos','secondary','ca','pa','value','wage'] if not old or old.get(k)!=p.get(k)}
 changes.append({'id':p['id'],'name':p['name'],'clubId':p.get('clubId'),'action':action,'fields':fields})

for q in x['players']:
 old=q.get('seed') or {};remember(q['id'],old);p=dict(old) if old else {'id':q['id'],'contract':2029,'real':True,'value':.4,'wage':.002,'secondary':[]}
 p.update(id=q['id'],name=q['name'],nat=q['nationality'],dob=q.get('dob'),age=age(q.get('dob')),clubId=q['clubId'],source='official-pl-audit-2026-11-02',optaCode=q.get('optaCode'),rosterStatus=q['rosterStatus'],factsSource=q['source'],factsCheckedAt=x['checkedAt'],ratingRevision=2)
 if p['age'] is None:p['developmentAge']=18
 if q.get('optaCode'):p['fplCode']=q['optaCode']
 group=q['group'];p['pos']=q.get('positionOverride') or p.get('pos') or {'Goalkeepers':'GK','Defenders':'DF','Midfielders':'MF','Forwards':'FW'}[group]
 if q.get('positionOverride'):p['secondary']=q.get('secondaryOverride',[])
 if group=='Goalkeepers':p['pos']='GK';p['secondary']=[]
 if not old:p['positionDetailKnown']=bool(q.get('positionOverride') or group=='Goalkeepers')
 # Existing detailed winger/wingback roles are retained: official MF/FW headings are broad display categories.
 p['officialPositionGroup']=group;p['ratingSources']=[q['source']]+[x['sources'][k] for k in q.get('review',{}).get('sources',[]) if k in x['sources'] and k!='rosters'];p['bioSource']=q.get('bioSource') or (x['sources']['currentPerformance'] if q.get('dob') else None)
 p.pop('unverifiedAffiliation',None);p.pop('initialLoanParent',None)
 p.update(rating(q,p));index[p['id']]=p;record(old,p,'added' if q.get('wasPresent') is False else 'reviewed')

for q in x['departures']:
 old=q['seed'];remember(q['id'],old);p=dict(index[q['id']]);p['clubId']=q['destinationId'];p['source']='official-transfer-audit-2026-11-02';p['factsSource']=q['source'];p['factsCheckedAt']=x['checkedAt'];p['rosterStatus']='loan' if q['loanParent'] else 'firstTeam';p.pop('unverifiedAffiliation',None);p.pop('initialLoanParent',None)
 if q['loanParent']:p['initialLoanParent']=q['loanParent']
 for k in ['nat','pos','secondary']:
  if k in q:p[k]=q[k]
 index[p['id']]=p;record(old,p,'departure')
for q in x['uncertain']:
 p=dict(index[q['id']]);old=q.get('seed',dict(p));remember(p['id'],old);p['clubId']=None;p['unverifiedAffiliation']=True;p['lastVerifiedClubId']=q['lastVerifiedClubId'];p['affiliationNote']=q['reason'];p['factsSource']=q['source'];index[p['id']]=p;record(old,p,'uncertain');notes.append(q)
# Known current incoming loans, confirmed in Leeds' official transfer round-up.
for name,parent in [('Melvin Bard','c417'),('Jean-Mattéo Bahoya','c24')]:
 for p in index.values():
  if p['name']==name and p['clubId']=='c399':p['initialLoanParent']=parent;p['loanSource']='https://www.leedsunited.com/en/news/summer-2026-leeds-united-transfers-ins-and-outs'
players=list(index.values());epl=[p for p in players if p['clubId'] in meta['eplIds']];assert len({p['id'] for p in players})==len(players)
assert all(p.get('nat') and p['nat']!='미확인' and p['ca']<=p['pa']<=97 for p in epl)
meta.update(version=2,dataRevision=2,ratingRevision=2,checkedAt=x['checkedAt'],ageAsOf=x['ageAsOf'],realPlayers=len(players),eplPlayers=len(epl),officialSquadPlayers=x['officialCount'],additionalAcademyPlayers=len(epl)-x['officialCount'],ratingMethod='역할·최근 두 시즌 출전·현 시즌 기용·포지션·경력 및 근거를 기록한 개별 검토. ID 임의 포텐 가산 없음.')
meta['sources']=[s for s in meta['sources'] if 'FPL · current' not in s['name']]+[{'name':'Premier League · 20 current official squad pages','url':'https://www.premierleague.com/en/clubs','date':x['checkedAt']},{'name':'FPL Historical Dataset · Vaastav Anand (2024/25, 2025/26 minutes)','url':x['sources']['previousPerformance'],'date':x['checkedAt']},{'name':'Golden Boy official shortlist · potential context','url':x['sources']['goldenBoy'],'date':'2026-10-05'}]
meta['sources']=list({(s['name'],s['url']):s for s in meta['sources']}.values())
meta['limitations']=['PL 20개 구단의 공식 명단과 확인된 이적·임대, 추가 아카데미 근거를 대조했습니다. 소속 미확정 항목은 영입 대상에서 분리합니다.','CA·PA·가치·급여·계약은 게임 추정치이며 공식 선수 평가나 확정된 미래가 아닙니다. 유망주는 추정 범위와 근거를 제공합니다.','일부 아카데미 선수의 생일은 확인하지 못했습니다. 실제 나이는 미확인으로 두고 경기 진행용 연령을 따로 관리합니다.','해외 선수의 기본 소속과 기존 평가에는 2026-07-06 자료의 한계가 남습니다. 이번 전수 감사 범위는 PL 20개 팀입니다.','공식 엠블럼과 선수 사진은 사용하지 않습니다.']
for n,v in [('players.json',players),('meta.json',meta)]: (D/n).write_text(json.dumps(v,ensure_ascii=False,separators=(',',':')))
patch={'revision':2,'checkedAt':x['checkedAt'],'baseline':baseline,'reviewedIds':[q['id'] for q in x['players']],'membershipIds':[q['id'] for q in x['players']+x['departures']+x['uncertain']]}
(D/'roster-patch.json').write_text(json.dumps(patch,ensure_ascii=False,separators=(',',':')))
summary={'revision':2,'checkedAt':x['checkedAt'],'officialPlayersReviewed':x['officialCount'],'totalPlPlayers':len(epl),'additionalAcademy':len(epl)-x['officialCount'],'realPlayers':len(players),'nationalitiesMissing':sum(p['nat']=='미확인' for p in epl),'dobMissing':sum(not p.get('dob') for p in epl),'newPlayers':sum(c['action']=='added' for c in changes),'editorialReviews':sum(bool(q.get('review')) for q in x['players']),'confirmedDepartures':len(x['departures']),'uncertain':notes,'filledNationality':sum(c['fields'].get('nat',{}).get('before')=='미확인' for c in changes),'abilityChanged':sum('ca' in c['fields'] for c in changes),'potentialChanged':sum('pa' in c['fields'] for c in changes),'clubs':[]}
for c in x['clubs']:
 id=c['clubId'];rows=[p for p in epl if p['clubId']==id];cs=[z for z in changes if z['clubId']==id];summary['clubs'].append({**c,'players':len(rows),'officialPlayers':sum(q['clubId']==id and q['rosterStatus']=='firstTeam' for q in x['players']),'natMissing':sum(p['nat']=='미확인' for p in rows),'caChanges':sum('ca' in z['fields'] for z in cs),'paChanges':sum('pa' in z['fields'] for z in cs),'newPlayers':sum(z['action']=='added' for z in cs)})
(A/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));(A/'changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2))
with (A/'all-players.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['구단','선수','ID','분류','국적(이전)','국적(수정)','나이','포지션(이전)','포지션(수정)','능력(이전)','능력(수정)','잠재력(이전)','잠재력(수정)','잠재력 추정범위','검토 근거','공식 출처'])
 for p in epl:
  o=baseline.get(p['id'],{});w.writerow([clubmap[p['clubId']]['ko'],p['name'],p['id'],p['rosterStatus'],o.get('nat','신규'),p['nat'],p.get('age') if p.get('age') is not None else '미확인',o.get('pos',''),p['pos'],o.get('ca','신규'),p['ca'],o.get('pa','신규'),p['pa'],'–'.join(map(str,p['potentialBand'])),p['ratingBasis'],p['factsSource']])
print(json.dumps({k:v for k,v in summary.items() if k!='clubs'},ensure_ascii=False));print('BRIGHTON',[(p['name'],p['ca'],p['pa'],p['nat']) for p in epl if p['clubId']=='c1237'])
