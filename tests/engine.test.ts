import {test} from 'node:test';
import assert from 'node:assert/strict';
import {carFeedback,feedbackPosition} from '../src/ui/feedback.ts';
import {angleDifference,cameraPoint,laneStatus,pointAlong,projectPath,steeringInput,stepDriving} from '../src/driving.ts';
import {createClock,advanceSimulation,stepSimulation,captureFrame,setPaused,vehiclesOverlap,soundHorn,createState,guideRoute,tick,poseAt,routeLength,makeTraffic,routePoints,toggleIndicator,lanePose,mustYield,pathConflicts,type State,type Indicator,type Traffic,type Route,type JunctionRule} from '../src/engine.ts';

function fixture(rule:JunctionRule='unsigned'):State{const s=createState(42);s.rule=rule;s.traffic=[];return s;}
function place(s:State,distance:number,route:Route='straight'){s.player={...poseAt(route,distance),wheel:0};s.route=route;s.distance=distance;}
function driveInput(s:State,route:Route){const points=routePoints(route),p=projectPath(points,s.player),aim=pointAlong(points,p.distance+35);const angle=Math.atan2(aim.x-s.player.x,-(aim.y-s.player.y))*180/Math.PI;return Math.max(-1,Math.min(1,angleDifference(angle,s.player.angle)/32));}
function advance(s:State,seconds:number,gas=false,route:Route|null=null){const crossings=s.crossings;for(let i=0;i<seconds*60&&s.phase==='driving'&&s.crossings===crossings;i++)stepSimulation(s,{gas,brake:!gas,steer:route?driveInput(s,route):0});}
function npc(direction:Traffic['direction'],route:Route,distance:number,id=1):Traffic{return{id,direction,route,distance,speed:55,cruiseSpeed:60,...lanePose(direction,route,distance),color:'#789',style:0};}

test('same-junction retries reproduce rules and all traffic exactly',()=>{assert.deepEqual(createState(42),createState(42));assert.deepEqual(makeTraffic('unsigned',42),makeTraffic('unsigned',42));});
test('random seeds vary rules, approaches, turns, car count, spacing, speed and appearance',()=>{
  const rules=new Set(),directions=new Set(),routes=new Set(),counts=new Set(),positions=new Set(),speeds=new Set(),colors=new Set();
  for(let seed=1;seed<=80;seed++){const s=createState(seed*99991);rules.add(s.rule);counts.add(s.traffic.length);for(const c of s.traffic){directions.add(c.direction);routes.add(c.route);positions.add(Math.round(c.distance!));speeds.add(Math.round(c.speed));colors.add(c.color);}}
  assert.equal(rules.size,2);assert.ok(directions.size>=3);assert.equal(routes.size,3);assert.ok(counts.size>2);assert.ok(positions.size>30);assert.ok(speeds.size>10);assert.ok(colors.size>4);
});
test('spawned traffic has room between vehicles and starts before the junction',()=>{
  for(let seed=0;seed<50;seed++){const s=createState(seed*123457);for(const car of s.traffic){assert.ok(car.distance!<0);for(const other of s.traffic)if(other.id!==car.id&&other.direction===car.direction)assert.ok(Math.abs(other.distance!-car.distance!)>=210);}}
});
test('state contains no destination or lesson progression',()=>{const s=createState(42);assert.equal('goal' in s,false);assert.equal('lesson' in s,false);assert.equal('completed' in s,false);assert.equal(s.crossings,0);});
test('all ideal lane paths start in the correct lane and reach their exits',()=>{for(const route of ['left','straight','right'] as const){assert.deepEqual(poseAt(route,0),{x:521,y:650,angle:0});const end=poseAt(route,routeLength(route));assert.ok(route==='left'?end.x<50:route==='right'?end.x>900:end.y<70);}});

test('a stopped driver can wait safely before the junction',()=>{const s=fixture();s.phase='driving';place(s,170);s.traffic=[npc('west','straight',50)];advance(s,10);assert.equal(s.phase,'driving');assert.equal(s.distance,170);assert.equal(s.speed,0);});
test('unsafe entry in front of traffic from the right fails',()=>{const s=fixture();s.phase='driving';s.traffic=[npc('west','straight',-30)];advance(s,15,true);assert.equal(s.phase,'failed');});
test('waiting for traffic to clear then proceeding reaches another junction',()=>{const s=fixture();s.phase='driving';s.traffic=[npc('west','straight',-30)];advance(s,11);advance(s,15,true);assert.equal(s.crossings,1);assert.equal(s.phase,'driving');});
test('signed yield checks traffic from the left as well as the right',()=>{const s=fixture('signed');s.phase='driving';place(s,205);s.speed=70;s.traffic=[npc('east','straight',250)];tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'failed');});
test('braking halts the car and pausing freezes all traffic',()=>{const s=fixture();s.phase='driving';s.speed=40;advance(s,1);assert.equal(s.speed,0);s.phase='paused';const before=structuredClone(s);tick(s,.05,{gas:true,brake:false,steer:1});assert.deepEqual(s,before);});
test('right-hand priority applies to all approaches and signs override it',()=>{
  for(const [a,b] of [['north','west'],['east','north'],['south','east'],['west','south']] as const){assert.equal(mustYield({direction:a,route:'straight'},{direction:b,route:'straight'},'unsigned'),true);assert.equal(mustYield({direction:b,route:'straight'},{direction:a,route:'straight'},'unsigned'),false);}
  assert.equal(mustYield({direction:'east',route:'straight'},{direction:'north',route:'straight'},'signed'),false);assert.equal(mustYield({direction:'north',route:'straight'},{direction:'east',route:'straight'},'signed'),true);
});
test('traffic from the left stops for the player and resumes after the player passes',()=>{const s=fixture();s.phase='driving';place(s,160);s.traffic=[npc('east','straight',65)];advance(s,4);assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[0].x<398);assert.equal(s.traffic[0].waitingFor,'priority');advance(s,3,true);assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed>10);});
test('an oncoming left-turner yields to the player going straight',()=>{const s=fixture();s.phase='driving';place(s,160);s.traffic=[npc('south','left',75)];advance(s,4);assert.ok(s.traffic[0].speed<1);assert.equal(s.traffic[0].waitingFor,'priority');assert.ok(s.traffic[0].y<278);});
test('NPCs yield to other NPCs',()=>{const s=fixture();s.phase='driving';s.traffic=[npc('west','straight',70,1),npc('south','straight',70,2)];let waited=false,minSpeed=55;for(let i=0;i<120;i++){stepSimulation(s,{gas:false,brake:true});waited||=s.traffic[0].waitingFor==='priority';minSpeed=Math.min(minSpeed,s.traffic[0].speed);}assert.ok(waited);assert.ok(minSpeed<10);assert.ok(s.traffic[1].distance!>180);});
test('queues maintain a car-length gap behind stopped vehicles',()=>{const s=fixture();s.phase='driving';place(s,160);s.traffic=[npc('east','straight',120,1),npc('east','straight',35,2)];advance(s,6);assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[1].speed<1);assert.ok(s.traffic[0].x-s.traffic[1].x>=55);assert.equal(s.traffic[1].waitingFor,'queue');});

function intentionFixture(signal:Indicator){const s=fixture();Object.assign(s,{phase:'driving',time:1,speed:20});place(s,120,'left');s.traffic=[npc('south','left',175)];s.traffic[0].speed=30;if(signal){toggleIndicator(s,signal);s.indicatorSince=0;}for(let i=0;i<5;i++)tick(s,.05,{gas:false,brake:false});return s;}
test('a sustained left signal lets an opposing left-turner use a separate path',()=>{const unknown=intentionFixture(null),clear=intentionFixture('left'),misleading=intentionFixture('right');assert.ok(unknown.traffic[0].speed<1);assert.ok(clear.traffic[0].speed>30);assert.ok(misleading.traffic[0].speed<1);assert.deepEqual(pathConflicts('north','left','south','left'),[]);});
test('a momentary signal does not release a waiting car',()=>{const s=intentionFixture(null);toggleIndicator(s,'left');tick(s,.05,{gas:false,brake:true});assert.equal(s.traffic[0].waitingFor,'priority');});
test('signals do not override signed yield',()=>{const s=fixture('signed');s.phase='driving';s.traffic=[npc('east','straight',-30)];toggleIndicator(s,'left');advance(s,15,true);assert.equal(s.phase,'failed');});
test('NPC indicators and brake lights reflect actual driving',()=>{const s=fixture();s.phase='driving';place(s,160);s.traffic=[npc('south','left',75)];advance(s,.2);assert.equal(s.traffic[0].indicator,'left');advance(s,4);assert.equal(s.traffic[0].braking,true);});
test('player indicators toggle independently of steering',()=>{const s=fixture();toggleIndicator(s,'left');assert.equal(s.indicator,'left');assert.equal(s.route,'straight');toggleIndicator(s,'right');assert.equal(s.indicator,'right');toggleIndicator(s,'right');assert.equal(s.indicator,null);});

test('all three exits are accepted without any prescribed destination',()=>{for(const route of ['straight','left','right'] as const){const s=fixture();s.phase='driving';if(route!=='straight')toggleIndicator(s,route);advance(s,20,true,route);assert.equal(s.crossings,1,route+': '+s.reason);assert.equal(s.phase,'driving');assert.notEqual(s.seed,42);assert.ok(s.traffic.length>=2);}});
test('a legal return along the entry road is accepted',()=>{const s=fixture();s.phase='driving';s.player={x:439,y:795,angle:180,wheel:0};tick(s,.05,{gas:false,brake:false});assert.equal(s.crossings,1);assert.equal(s.phase,'driving');});
test('exiting in the wrong lane still gives safety feedback',()=>{const s=fixture();s.phase='driving';s.player={x:450,y:75,angle:0,wheel:0};tick(s,.05,{gas:false,brake:false});assert.equal(s.phase,'failed');assert.equal(s.crossings,0);assert.equal(s.reason,'wrong-lane');});
test('a new junction preserves speed, steering, lane offset and relative heading',()=>{const s=fixture();s.phase='driving';s.player={x:885,y:406,angle:92,wheel:.1};s.speed=45;stepSimulation(s,{gas:true,brake:false,steer:.15});assert.equal(s.crossings,1);assert.ok(s.speed>45);assert.ok(s.player.wheel>0);assert.ok(s.player.x>525);assert.ok(s.player.x<530);assert.ok(s.player.angle>1&&s.player.angle<5);assert.equal(s.player.y,650);});
test('continuous practice can pass multiple independently randomized junctions',()=>{const s=fixture();s.phase='driving';for(const route of ['left','right','straight'] as const){s.traffic=[];advance(s,20,true,route);assert.equal(s.phase,'driving',s.reason);}assert.equal(s.crossings,3);});
test('the seed of an encountered junction exactly recreates its rules and traffic',()=>{const s=fixture();s.phase='driving';advance(s,20,true,'right');const replay=createState(s.seed);assert.equal(replay.rule,s.rule);assert.deepEqual(replay.traffic,s.traffic);});

test('W and Up request no steering; A/D are continuous car-relative controls',()=>{assert.equal(steeringInput(new Set(['w'])),0);assert.equal(steeringInput(new Set(['ArrowUp'])),0);assert.equal(steeringInput(new Set(['w','a'])),-1);assert.equal(steeringInput(new Set(['w','d'])),1);assert.equal(steeringInput(new Set(['a','d'])),0);});
test('steering guidance follows signals and observed motion, without a hidden route',()=>{const s=fixture();assert.equal(guideRoute(s),'straight');s.player.y=520;toggleIndicator(s,'right');assert.equal(guideRoute(s),'right');s.player.y=450;s.player.angle=-40;assert.equal(guideRoute(s),'left');});
test('accelerating never resets the car heading or wheel angle',()=>{const s=fixture();s.phase='driving';s.assistance=0;s.player.angle=-35;s.player.wheel=-.2;const angle=s.player.angle;tick(s,.05,{gas:true,brake:false});assert.ok(s.player.angle<angle);assert.ok(s.player.x<521);});
test('steering works before, inside and after the junction',()=>{for(const distance of [0,180,400]){const s=fixture();s.phase='driving';s.assistance=0;place(s,distance);s.speed=50;tick(s,.05,{gas:true,brake:false,steer:-1});assert.ok(s.player.angle<0);assert.ok(s.player.x<521);}});
test('steering is always relative to the car',()=>{for(const heading of [0,90,180,-90])for(const steer of [-1,1]){const body={x:521,y:650,angle:heading,wheel:0};stepDriving(body,50,steer,routePoints('straight'),.05,0);assert.equal(Math.sign(body.angle-heading),steer);}});
test('soft guidance preserves lateral slack rather than snapping to the lane',()=>{const body={x:528,y:630,angle:0,wheel:0};for(let i=0;i<40;i++)stepDriving(body,40,0,routePoints('straight'),.05,1);assert.equal(body.x,528);assert.equal(body.angle,0);});
test('releasing steering gradually centres the wheel and reduces drift',()=>{const body={x:546,y:630,angle:0,wheel:0};stepDriving(body,40,0,routePoints('straight'),.05,.6);assert.ok(body.x>545&&body.x<546);for(let i=0;i<60;i++)stepDriving(body,40,0,routePoints('straight'),.05,.6);assert.ok(body.x<540&&body.x>510);body.wheel=.65;stepDriving(body,40,0,routePoints('straight'),.05,0);assert.ok(body.wheel>0&&body.wheel<.65);});
test('manual steering can enter the opposing lane despite maximum assistance',()=>{const s=fixture();s.phase='driving';s.assistance=1;s.speed=60;let wrong=false;for(let i=0;i<60&&s.phase==='driving';i++){tick(s,.05,{gas:true,brake:false,steer:-.45});wrong||=s.lane==='wrong-lane';}assert.ok(s.player.x<480);assert.ok(wrong);});
test('changing projected distance cannot move the real car or advance practice',()=>{const s=fixture();s.phase='driving';s.distance=9999;tick(s,.05,{gas:false,brake:false});assert.equal(s.crossings,0);assert.equal(s.player.x,521);assert.equal(s.player.y,650);assert.equal(s.distance,0);});
test('collision checks use the actual player position',()=>{const s=fixture();s.phase='driving';s.player.x=439;s.traffic=[npc('south','straight',578)];tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'failed');const clear=fixture();clear.phase='driving';clear.player.x=439;clear.traffic=[npc('north','straight',0)];tick(clear,.05,{gas:false,brake:true});assert.equal(clear.phase,'driving');});
test('NPC emergency braking sees a car outside its expected lane',()=>{const s=fixture();s.phase='driving';s.player.x=439;s.traffic=[npc('south','straight',505)];advance(s,.3);assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<55);assert.equal(s.traffic[0].waitingFor,'safety');});
test('car-relative camera keeps the player fixed and forward pointing up',()=>{for(const angle of [0,90,180,-90,410]){const body={x:400,y:500,angle,wheel:0};assert.deepEqual(cameraPoint(body,body),{x:480,y:535});const rad=angle*Math.PI/180,p=cameraPoint({x:body.x+Math.sin(rad)*50,y:body.y-Math.cos(rad)*50},body);assert.ok(Math.abs(p.x-480)<1e-8);assert.ok(Math.abs(p.y-485)<1e-8);}});
test('overview keeps world coordinates fixed',()=>{const body={x:521,y:650,angle:90,wheel:0};assert.deepEqual(cameraPoint({x:80,y:319},body,false),{x:80,y:319});});
test('wrong lane and grass produce separate warnings',()=>{assert.equal(laneStatus({x:450,y:600,angle:0}),'wrong-lane');assert.equal(laneStatus({x:450,y:600,angle:180}),'ok');assert.equal(laneStatus({x:350,y:600,angle:0}),'off-road');});

function situation(x:number,y:number,angle:number,speed:number,direction:Traffic['direction'],distance:number):State {
  const s=fixture();s.phase='driving';s.player={x,y,angle,wheel:0};s.speed=speed;s.traffic=[npc(direction,'straight',distance)];return s;
}
test('a developing short gap produces an amber warning without ending the drive',()=>{
  const s=situation(521,490,0,50,'west',120);stepSimulation(s,{gas:false,brake:false});
  assert.equal(s.phase,'driving');assert.equal(s.failure,null);assert.equal(s.warning?.severity,'warning');assert.equal(s.warning?.code,'yield-caution');assert.deepEqual(s.warning?.actorIds,[-1,1]);
});
test('a cautious reaction before entry produces pressure feedback rather than a failure',()=>{
  const s=situation(465,470,-40,5,'south',330);stepSimulation(s,{gas:false,brake:false});
  assert.equal(s.phase,'driving');assert.equal(s.failure,null);assert.equal(s.warning?.code,'priority-pressure');assert.ok(s.traffic[0].speed<55);
});
test('slowing safely clears an early warning and allows the drive to continue',()=>{
  const s=situation(521,490,0,50,'west',120);stepSimulation(s,{gas:false,brake:false});assert.ok(s.warning);advance(s,4);
  assert.equal(s.phase,'driving');assert.equal(s.speed,0);assert.equal(s.warning,null);assert.equal(s.failure,null);
});
test('forced hard braking by priority traffic inside the junction records a violation',()=>{
  const s=situation(465,450,-40,40,'south',320);stepSimulation(s,{gas:false,brake:false});
  assert.equal(s.phase,'failed');assert.equal(s.failure?.event.code,'yield-violation');assert.ok(s.failure!.event.facts.otherDeceleration>65);assert.deepEqual(s.failure?.event.actorIds,[-1,1]);assert.ok(s.failure?.event.point);
});
test('a collision records actual contact instead of a predicted gap warning',()=>{
  const s=situation(521,415,0,20,'east',331);stepSimulation(s,{gas:false,brake:false});
  assert.equal(s.phase,'failed');assert.equal(s.failure?.event.code,'collision');assert.equal(s.failure?.event.severity,'failure');assert.equal(s.warning,null);
});
test('failure snapshots contain all vehicles at exactly the frozen simulation frame',()=>{
  const s=situation(521,415,0,20,'east',331);stepSimulation(s,{gas:false,brake:false});
  assert.deepEqual(s.failure?.scene,captureFrame(s));assert.equal(s.failure?.event.frame,s.frameNumber);assert.equal(s.failure?.event.time,s.time);
  const frozen=structuredClone(s);for(let i=0;i<100;i++){tick(s,.05,{gas:true,brake:false,steer:1});setPaused(s,false);toggleIndicator(s,'left');}
  assert.deepEqual(s,frozen);assert.deepEqual(s.failure?.scene,frozen.failure?.scene);
});
test('failure capture is a copy, independent of renderer-side object mutation',()=>{
  const s=situation(521,415,0,20,'east',331);stepSimulation(s,{gas:false,brake:false});const original=structuredClone(s.failure!.scene);
  s.player.x+=100;s.traffic[0].x+=100;assert.deepEqual(s.failure!.scene,original);
});
test('oriented collision bounds allow close cars in separate lanes',()=>{
  assert.equal(vehiclesOverlap({x:0,y:0,angle:0},{x:27,y:0,angle:0}),false);
  assert.equal(vehiclesOverlap({x:0,y:0,angle:0},{x:0,y:42,angle:0}),true);
  assert.equal(vehiclesOverlap({x:0,y:0,angle:0},{x:0,y:44,angle:0}),false);
  assert.equal(vehiclesOverlap({x:0,y:0,angle:45},{x:10,y:10,angle:-45}),true);
});
test('simulation results are identical at 30, 60 and 144 rendered frames per second',()=>{
  const runs=[30,60,144].map(fps=>{const s=fixture(),clock=createClock();s.phase='driving';for(let i=0;i<fps*6;i++)advanceSimulation(s,clock,1/fps,{gas:true,brake:false,steer:0});return s;});
  assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);assert.equal(runs[0].frameNumber,360);
});
test('pause freezes evidence and discards elapsed wall time before resuming',()=>{
  const s=fixture(),clock=createClock();s.phase='driving';advanceSimulation(s,clock,.1,{gas:true,brake:false});setPaused(s,true);const paused=structuredClone(s);
  assert.equal(advanceSimulation(s,clock,120,{gas:true,brake:false,steer:1}),0);assert.deepEqual(s,paused);assert.equal(clock.accumulator,0);
  setPaused(s,false);advanceSimulation(s,clock,1/60,{gas:false,brake:true});assert.equal(s.frameNumber,paused.frameNumber+1);
});
test('plain JSON state can be transferred and resumed deterministically in another host',()=>{
  const a=fixture();a.phase='driving';advance(a,1,true);const b:State=JSON.parse(JSON.stringify(a));
  for(let i=0;i<120;i++){const input={gas:false,brake:i<20,steer:i>60?.1:0};stepSimulation(a,input);stepSimulation(b,input);}
  assert.deepEqual(a,b);
});
test('a long host frame uses a bounded catch-up budget',()=>{
  const s=fixture(),clock=createClock();s.phase='driving';const steps=advanceSimulation(s,clock,20,{gas:true,brake:false});assert.equal(steps,15);assert.equal(s.frameNumber,15);
});

test('core modules depend only on other core modules and contain no host APIs',async()=>{
  const {readdir,readFile}=await import('node:fs/promises');
  const files=await readdir(new URL('../src/core/',import.meta.url));
  for(const name of files.filter(name=>name.endsWith('.ts'))){const source=await readFile(new URL('../src/core/'+name,import.meta.url),'utf8');
    for(const match of source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('./')&&!match[1].includes('../'),name+': '+match[1]);
    assert.doesNotMatch(source,/\b(?:window|document|localStorage|requestAnimationFrame|performance)\s*[.(]|Math\.random\s*\(|Date\.now\s*\(/,name);
  }
});
test('warning history is deduplicated and bounded during long practice',async()=>{
  const {warn}=await import('../src/core/events.ts');const s=fixture();
  for(let i=0;i<100;i++){s.time=i*4;warn(s,'yield-caution',1);}
  assert.equal(s.events.length,64);const id=s.warning!.id;for(let i=0;i<100;i++)warn(s,'yield-caution',1);assert.equal(s.warning!.id,id);assert.equal(s.events.length,64);
});

function lockedJunction():State {
  const s=fixture('signed');s.phase='driving';s.player.y=480;
  s.traffic=[npc('east','left',318,0),npc('west','straight',238,1),npc('east','left',258,2)];s.traffic.forEach(car=>car.speed=0);return s;
}
test('the screenshot-style traffic lock resolves with coordinated backing and legal priority',()=>{
  const s=lockedJunction(),backed=new Set<number>();let chosen:number|null=null,movingDuringWait=false;
  for(let i=0;i<1800;i++){
    const previous=s.traffic.map(car=>car.distance!);stepSimulation(s,{gas:false,brake:true});
    if(s.time<2)assert.equal(s.recovery,null);
    if(s.recovery)chosen??=s.recovery.winnerId;
    for(let a=0;a<s.traffic.length;a++){const car=s.traffic[a];if(car.reversing)backed.add(car.id);assert.ok(Math.abs(car.distance!-previous[a])<1.1,'no teleporting');for(let b=a+1;b<s.traffic.length;b++)assert.equal(vehiclesOverlap(car,s.traffic[b]),false);assert.equal(vehiclesOverlap(car,s.player),false);}
    if(s.time>20&&s.traffic.every(car=>car.speed>20))movingDuringWait=true;
  }
  assert.equal(s.phase,'driving');assert.equal(chosen,1);assert.deepEqual([...backed].sort(),[0,2]);assert.ok(movingDuringWait);assert.ok(s.traffic.every(car=>car.distance!>600));
});
test('normal yielding to the player remains a queue instead of being forcibly overridden',()=>{
  const s=fixture();s.phase='driving';place(s,160);s.traffic=[npc('east','straight',120,1),npc('east','straight',35,2)];advance(s,15);
  assert.equal(s.recovery,null);assert.ok(s.traffic.every(car=>!car.reversing));assert.ok(s.traffic[0].speed<1);assert.equal(s.phase,'driving');
});
test('recovery freezes on pause and resumes deterministically after state transfer',()=>{
  const a=lockedJunction();advance(a,4);assert.ok(a.recovery);setPaused(a,true);const frozen=structuredClone(a);tick(a,.25,{gas:false,brake:true});assert.deepEqual(a,frozen);
  setPaused(a,false);const b:State=JSON.parse(JSON.stringify(a));for(let i=0;i<900;i++){stepSimulation(a,{gas:false,brake:true});stepSimulation(b,{gas:false,brake:true});}assert.deepEqual(a,b);assert.equal(a.recovery,null);
});
test('live recovery stops a reversing car if the player moves into the available space',()=>{
  const s=lockedJunction();advance(s,3);assert.equal(s.recovery?.phase,'backing');
  const car=s.traffic.filter(car=>car.reversing).sort((a,b)=>a.distance!-b.distance!)[0];assert.ok(car);
  const blockedPose=lanePose(car.direction,car.route!,car.distance!-60);s.player={...blockedPose,wheel:0};const before=car.distance!;assert.equal(vehiclesOverlap(car,s.player),false);
  for(let i=0;i<120&&s.phase==='driving';i++)stepSimulation(s,{gas:false,brake:true});
  assert.ok(before-car.distance!<8);assert.equal(car.speed,0);assert.equal(s.phase,'driving');assert.equal(vehiclesOverlap(car,s.player),false);
});
test('the player horn is rate-limited and never changes priority rules',()=>{
  const s=fixture('signed');s.phase='driving';assert.equal(soundHorn(s),true);assert.equal(soundHorn(s),false);assert.equal(s.horns[0].actorId,-1);assert.equal(s.hornSequence,1);
  assert.equal(mustYield({direction:'north',route:'straight'},{direction:'east',route:'straight'},s.rule),true);
  advance(s,1.3);assert.equal(soundHorn(s),true);setPaused(s,true);assert.equal(soundHorn(s),false);
});
test('waiting drivers can honk and pulses expire without unbounded growth',()=>{
  const s=lockedJunction();advance(s,5);assert.ok(s.hornSequence>0);assert.ok(s.horns.every(pulse=>s.time-pulse.startedAt<1.15));
  assert.ok(s.traffic.some(car=>car.lastHornAt!==undefined));advance(s,25);assert.ok(s.horns.length<=16);assert.equal(s.phase,'driving');
});
test('short warning text is anchored above the car in both camera modes',()=>{
  const s=situation(521,490,0,50,'west',120);stepSimulation(s,{gas:false,brake:false});assert.equal(carFeedback(s)?.tone,'warning');assert.ok(carFeedback(s)!.text.length<30);
  const follow=feedbackPosition(s,true);assert.equal(follow.x,480);assert.ok(follow.y<535);
  const overview=feedbackPosition(s,false);assert.equal(overview.x,s.player.x);assert.ok(overview.y<s.player.y);
});
test('serious incident text takes precedence over coordination or minor feedback',()=>{
  const s=situation(521,415,0,20,'east',331);stepSimulation(s,{gas:false,brake:false});assert.equal(carFeedback(s)?.tone,'failure');assert.equal(carFeedback(s)?.text,'Kollisjon!');
});
