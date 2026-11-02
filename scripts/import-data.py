"""Rebuild licensed snapshot + independently verified EPL roster overlay.
Usage: python scripts/import-data.py /path/to/downloaded/research
See docs/DATA.md for sources, licensing and known limits.
"""
import csv,gzip,json,sys,pathlib,datetime,math,hashlib,unicodedata,difflib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]; R=pathlib.Path(sys.argv[1]); D=ROOT/'data'
D.mkdir(exist_ok=True)
def read(n):
 with gzip.open(R/(n+'.csv.gz'),'rt') as f:return list(csv.DictReader(f))
def norm(s):return ''.join(c for c in unicodedata.normalize('NFKD',s).lower() if c.isalnum() and not unicodedata.combining(c))
def seed(s):return int(hashlib.sha256(str(s).encode()).hexdigest()[:8],16)
def dump(n,x): (D/n).write_text(json.dumps(x,ensure_ascii=False,separators=(',',':')))
overrides=json.load(open(R/'identity-overrides.json')); departure=json.load(open(R/'departure-overrides.json')); verifiedIds={str(v) for v in overrides.values()}|{str(v['tmId']) for v in departure};
raw=read('players'); rc=read('clubs'); competitions=read('competitions'); fpl=json.load(open(R/'fpl.json')); official=json.load(open(R/'epl-squads.json'))
# Club IDs from the CC0 dataset; exact names establish the current membership, not historic league codes.
epl=[('Arsenal','아스널','ARS','#d32336',281,90,150,4),('Aston Villa','애스턴 빌라','AVL','#743d56',405,80,65,7),('AFC Bournemouth','본머스','BOU','#ce2938',989,76,42,12),('Brentford','브렌트퍼드','BRE','#df253b',1148,75,38,13),('Brighton & Hove Albion','브라이턴','BHA','#2274bf',1237,78,65,10),('Chelsea','첼시','CHE','#2655ba',631,86,130,4),('Coventry City','코번트리 시티','COV','#58a8cf',990,69,28,17),('Crystal Palace','크리스털 팰리스','CRY','#3152a2',873,77,45,11),('Everton','에버턴','EVE','#2b4a9b',29,76,38,12),('Fulham','풀럼','FUL','#53585e',931,76,42,12),('Hull City','헐 시티','HUL','#c78b20',3008,68,22,17),('Ipswich Town','입스위치 타운','IPS','#4165be',677,70,32,17),('Leeds United','리즈 유나이티드','LEE','#c7a42c',399,74,40,15),('Liverpool','리버풀','LIV','#cb3345',31,89,125,4),('Manchester City','맨체스터 시티','MCI','#6cadd3',2812,90,155,1),('Manchester United','맨체스터 유나이티드','MUN','#c32c37',985,83,100,6),('Newcastle United','뉴캐슬 유나이티드','NEW','#333e46',762,82,90,6),('Nottingham Forest','노팅엄 포리스트','NFO','#d82b3d',703,77,50,10),('Tottenham Hotspur','토트넘 홋스퍼','TOT','#33405f',148,82,90,6),('Sunderland','선덜랜드','SUN','#c23c4a',289,73,35,16)]
byid={x['club_id']:x for x in rc}; clubs={}
for c in rc:
 id='c'+c['club_id'];clubs[id]={'id':id,'name':c['name'],'ko':c['name'],'short':''.join(w[0] for w in c['name'].split())[:3].upper(),'color':'#626e78','league':c['domestic_competition_id'] or 'OTHER','rep':65,'capacity':int(c['stadium_seats'] or 18000),'source':'cc0-july-2026'}
# alias alternate imported names and official PL conventions
aliases={'Bournemouth':'AFC Bournemouth','Brighton':'Brighton & Hove Albion','Coventry':'Coventry City','Hull':'Hull City','Ipswich':'Ipswich Town','Leeds':'Leeds United','Man City':'Manchester City','Man Utd':'Manchester United','Newcastle':'Newcastle United',"Nott'm Forest":'Nottingham Forest','Spurs':'Tottenham Hotspur','Sunderland':'Sunderland'}
eplids={};eplnames={}
for name,ko,short,color,tm,rep,budget,target in epl:
 id='c'+str(tm);c=clubs.setdefault(id,{'id':id,'capacity':28000});c.update(name=name,ko=ko,short=short,color=color,league='GB1',rep=rep,budget=budget,target=target,balance=round(budget*1.8+25),wageLimit=round((rep-52)*.09,2),source='pl-2026-27');eplids[name]=id;eplnames[norm(name)]=id
for a,b in aliases.items():eplnames[norm(a)]=eplids[b]
posmap={'Goalkeeper':'GK','Centre-Back':'CB','Left-Back':'LB','Right-Back':'RB','Defensive Midfield':'DM','Central Midfield':'CM','Attacking Midfield':'AM','Left Midfield':'LM','Right Midfield':'RM','Left Winger':'LW','Right Winger':'RW','Centre-Forward':'ST','Second Striker':'ST'}
def age(d):
 try:return int((datetime.date(2026,7,1)-datetime.date.fromisoformat(d[:10])).days/365.25)
 except:return None
# Latest recorded season removes retired players. Missing biodata are retained explicitly as unknown.
players=[];rawindex={};nameindex=collections.defaultdict(list)
for p in raw:
 if int(p['last_season'] or 0)<2025 and p['player_id'] not in verifiedIds:continue
 a=age(p['date_of_birth'])
 if a is not None and (a<15 or a>43):continue
 id='tm'+p['player_id']; cid='c'+p['current_club_id'] if p['current_club_id'] and p['current_club_id']!='515' else None
 if cid and cid not in clubs:clubs[cid]={'id':cid,'name':p['current_club_name'] or '소속 미확인','ko':p['current_club_name'] or '소속 미확인','short':'CLB','color':'#626e78','league':p['current_club_domestic_competition_id'] or 'OTHER','rep':62,'capacity':18000,'source':'cc0-july-2026'}
 val=float(p['market_value_in_eur'] or 0)/1e6*.85 # GBP million, only seed, not a claim of actual valuation
 ca=round(max(38,min(94,52+6.1*math.log2(1+val))))
 if a is not None and a<21: ca=max(38,ca-2)
 pa=min(97,ca+max(0,(25-(a or 26)))*1.3+(seed(id)%7))
 pos=posmap.get(p['sub_position'],{'Defender':'CB','Midfield':'CM','Attack':'ST','Goalkeeper':'GK'}.get(p['position'],'CM'))
 q={'id':id,'name':p['name'],'nat':p['country_of_citizenship'] or '미확인','dob':p['date_of_birth'][:10] or None,'age':a,'clubId':cid,'pos':pos,'secondary':{'CB':['DM'],'LB':['LM'],'RB':['RM'],'DM':['CM'],'CM':['AM','DM'],'AM':['CM'],'LW':['LM','ST'],'RW':['RM','ST'],'ST':['AM']}.get(pos,[]),'ca':ca,'pa':round(pa),'value':round(max(.08,val),2),'wage':round(max(.001,val*.0014),3),'contract':2028+seed(id)%3,'real':True,'source':'cc0-july-2026'}
 players.append(q);rawindex[id]=q;nameindex[norm(q['name'])].append(q)
# FPL current affiliation/birthdate facts, not FPL points, injury news, photos, ratings or branding.
ft={t['id']:eplnames.get(norm(t['name'])) for t in fpl['teams']}; unmatched=[];used=set()
# Match PL fact rows to CC0 identities conservatively (surname + first-name corroboration).
def match(names,cid=None):
 for n in names:
  exact=[x for x in nameindex[norm(n)] if x['id'] not in used]
  if len(exact)==1:return exact[0],1
 candidates=[]
 for q in players:
  if q['id'] in used:continue
  best=max(difflib.SequenceMatcher(None,norm(n),norm(q['name'])).ratio() for n in names)
  if best>.84:candidates.append((best+.02*(q['clubId']==cid),q))
 candidates.sort(key=lambda v:v[0],reverse=True)
 if candidates and candidates[0][0]>=.9 and (len(candidates)==1 or candidates[0][0]-candidates[1][0]>.035):return candidates[0][1],candidates[0][0]
 return None,0
for f in fpl['elements']:
 if f.get('removed') or not f.get('can_select',True):continue
 cid=ft.get(f['team'])
 if not cid:continue
 full=f['first_name']+' '+f['second_name'];n=f.get('known_name') or full
 q=rawindex.get('tm'+str(overrides.get(str(f['code']),'')));score=1
 if not q:q,score=match([n,full,f['first_name']+' '+f['web_name']],cid)
 if q and q['dob'] and f.get('birth_date') and q['dob']!=f['birth_date'] and norm(q['name']) not in [norm(n),norm(full)]:q=None
 if not q:
  # Birthdate + last-name tokens resolve diacritics/short public names with no guessing.
  same=[p for p in players if p['id'] not in used and p['dob'] and p['dob']==f.get('birth_date') and (norm(f['web_name']) in norm(p['name']) or norm(p['name']).endswith(norm(f['second_name']))) ]
  if len(same)==1:q=same[0]
 if not q:
  q={'id':'fpl'+str(f['code']),'name':n,'nat':'미확인','dob':f.get('birth_date'),'age':age(f.get('birth_date') or ''),'clubId':cid,'pos':{1:'GK',2:'CB',3:'CM',4:'ST'}[f['element_type']],'secondary':[],'ca':round(55+min(26,(f['now_cost']/10-4)*4)),'pa':82,'value':round(max(.3,(f['now_cost']/10-3)*8),2),'wage':.015,'contract':2029,'real':True,'source':'fpl-2026-11-02'};players.append(q);nameindex[norm(q['name'])].append(q);unmatched.append({'name':n,'fplCode':f['code']})
 if q['id'].startswith('fpl'):
  q['ca']=max(42,min(79,clubs[cid]['rep']-18+seed(q['id'])%6-(10 if q['age'] is not None and q['age']<21 else 0)));q['pa']=min(95,q['ca']+max(3,(25-(q['age'] or 26))*1.4)+3);q['pa']=round(q['pa']);q['value']=round(max(.1,2**((q['ca']-52)/6.1)-1),2);q['wage']=round(max(.001,q['value']*.0014),3)
 q['clubId']=cid;q['source']='fpl-2026-11-02';q['fplCode']=f['code'];q['dob']=f.get('birth_date') or q['dob'];q['age']=age(q['dob'] or '');used.add(q['id'])
# Former July PL affiliations not corroborated by active FPL are marked unknown, never falsely retained.
orphans=0
for p in players:
 if p['clubId'] in eplids.values() and p['source']=='cc0-july-2026':p['clubId']=None;p['unverifiedAffiliation']=True;orphans+=1
# Current departure facts repair verified summer transfers in the old overseas snapshot.
for row in departure:
 p=rawindex.get('tm'+str(row['tmId']))
 if not p or p['source']=='fpl-2026-11-02':continue
 dest='c'+str(row['destinationTmClubId']) if row['destinationTmClubId'] else None
 if row['kind'] in ['transfer','loan'] and dest in clubs:
  p['clubId']=dest;p.pop('unverifiedAffiliation',None);p['source']='fpl-departure-2026-11-02'
  # Current real-world loan ownership is preserved until the first simulated June.
  if row['kind']=='loan':
   f=next((f for f in fpl['elements'] if f['code']==row['fplCode']),None)
   if f:p['initialLoanParent']=ft.get(f['team'])
 elif row['kind']=='free':p['clubId']=None;p.pop('unverifiedAffiliation',None);p['source']='fpl-departure-2026-11-02'
 elif row['kind']=='unregistered':p['unverifiedAffiliation']=True;p['clubId']=None
# Championship candidates from known actual clubs. Their league is a GAME lower division after year zero.
candidates=['c379','c543','c1132','c350','c1010','c512','c289','c990','c677','c3008','c984','c1123','c407','c2288','c1032','c1038','c368','c334','c1003']
candidates=[x for x in candidates if x in clubs and x not in eplids.values()]
# manager factual identity, inferred abilities explicitly game-only.
managerNames=json.load(open(R/'managers.json'))['managers']; managers=[]
styles=['점유율','균형','압박','직선적','점유율','점유율','균형','압박','실리','점유율','직선적','역습','점유율','압박','점유율','균형','압박','역습','점유율','실리']
for i,m in enumerate(managerNames):
 cid=eplnames[norm(m['club'])];rep=clubs[cid]['rep'];managers.append({'id':'m'+str(i),'name':m['name'],'clubId':cid,'age':None,'nat':'미확인','formation':['4-3-3','4-2-3-1','3-4-3','4-4-2'][i%4],'style':styles[i],'attack':min(95,rep+i%7-3),'defense':min(95,rep+(i*3)%9-4),'youth':65+i*7%30,'management':70+i*5%24,'rep':rep,'wage':round(max(.025,(rep-60)*.004),3),'contract':2029,'real':True,'source':'pl-managers-2026-11-02'})
for i,(name,nat) in enumerate([('Elliot Hart','England'),('Luis Pereira','Portugal'),('Felix Brandt','Germany'),('Marco Rinaldi','Italy'),('Hugo Moreau','France'),('Daniel Clarke','England'),('서준호','South Korea'),('Rafael Costa','Brazil')]):
 managers.append({'id':'virtual-m'+str(i),'name':name,'clubId':None,'age':38+i*3,'nat':nat,'formation':['4-3-3','4-2-3-1','3-4-3','4-4-2'][i%4],'style':styles[i],'attack':64+i*3,'defense':72+i*2,'youth':88-i*3,'management':75+i*2,'rep':60+i*3,'wage':.025+i*.009,'contract':2028,'real':False,'source':'generated'})
for m in managers:
 known={"Gary O'Neil":('1983-05-18','England'),"Alvaro Arbeloa":('1983-01-17','Spain'),"Matthias Jaissle":('1988-04-05','Germany'),"Enzo Maresca":('1980-02-10','Italy')}
 if m['name'] in known:
  dob,nat=known[m['name']];m['age']=age(dob);m['nat']=nat
leagues={x['competition_id']:{'name':x['name'].replace('-',' ').title(),'country':x['country_name']} for x in competitions if x['type']=='domestic_league'}
meta={'version':1,'checkedAt':'2026-11-02','startDate':'2026-07-01','season':'2026/27','realPlayers':len(players),'eplPlayers':sum(p['clubId'] in eplids.values() for p in players),'clubs':len(clubs),'leagues':leagues,'eplIds':list(eplids.values()),'promotionPool':candidates,'sources':[{'name':'Premier League · 2026/27 membership','url':'https://www.premierleague.com/en/news/4673099/the-202627-premier-league-season-officially-starts','date':'2026-06-05'},{'name':'Premier League · first-team squad lists','url':'https://www.premierleague.com/en/news/4725682','date':'2026-09-22'},{'name':'FPL · current player affiliation and birth date facts','url':'https://fantasy.premierleague.com/api/bootstrap-static/','date':'2026-11-02'},{'name':'Premier League · current managers','url':'https://www.premierleague.com/en/news/4325264/list-of-202627-premier-league-club-managers','date':'2026-11-02'},{'name':'dcaribou/transfermarkt-datasets · CC0-1.0','url':'https://github.com/dcaribou/transfermarkt-datasets','date':'2026-07-06'}],'limitations':['해외 소속은 2026-07-06 공개 자료 기준이며 여름 이적을 모두 반영하지 못합니다.','EPL 소속은 2026-11-02 FPL 활동 선수 명단을 대조했습니다. 시즌 중 영입도 시즌 준비부터 등장합니다.','능력·잠재력·가치·급여·계약·예산·감독 특성은 모두 게임 내 추정치입니다.','국적·생일이 없는 보충 선수와 감독은 미확인으로 표기합니다.','공식 엠블럼과 선수 사진은 사용하지 않습니다. 구단 문자는 자체 제작 식별자입니다.']}
dump('players.json',players);dump('clubs.json',list(clubs.values()));dump('managers.json',managers);dump('meta.json',meta)
(ROOT/'docs'/'import-audit.json').write_text(json.dumps({'rawRecords':len(raw),'retainedPlayers':len(players),'unmatchedFpl':unmatched,'unverifiedFormerEpl':orphans,'eplCounts':{clubs[id]['name']:sum(p['clubId']==id for p in players) for id in eplids.values()}},ensure_ascii=False,indent=2))
print(json.dumps({'players':len(players),'clubs':len(clubs),'epl':meta['eplPlayers'],'unmatchedFpl':len(unmatched),'orphans':orphans,'eplCounts':{clubs[id]['short']:sum(p['clubId']==id for p in players) for id in eplids.values()}},ensure_ascii=False))
