import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,tick,poseAt,routeLength,makeTraffic,chooseRoute,conflictOnRoute,selectDirection,toggleIndicator,lanePose,mustYield,pathConflicts,type State,type Indicator,type Traffic} from '../src/engine.ts';
test('retries reproduce the traffic exactly, while new seeds vary appearances',()=>{assert.deepEqual(makeTraffic('right',42),makeTraffic('right',42));assert.notDeepEqual(makeTraffic('right',42),makeTraffic('right',59));});
test('every route begins in the correct lane and reaches its own exit',()=>{for(const route of ['left','straight','right'] as const){assert.deepEqual(poseAt(route,0),{x:521,y:650,angle:0});const end=poseAt(route,routeLength(route));assert.ok(route==='left'?end.x<50:route==='right'?end.x>900:end.y<70);}});
test('turn selection locks before the intersection',()=>{const s=createState();chooseRoute(s,'left');assert.equal(s.route,'left');s.distance=180;chooseRoute(s,'right');assert.equal(s.route,'left');});
test('stopped driver can wait safely for all priority traffic',()=>{const s=createState();s.phase='driving';s.distance=170;for(let i=0;i<1000;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'driving');assert.equal(s.distance,170);assert.equal(s.speed,0);});
test('straight-through acceleration into conflicting traffic fails',()=>{const s=createState();s.phase='driving';for(let i=0;i<400&&s.phase==='driving';i++)tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'failed');});
test('waiting for a clear gap then proceeding succeeds',()=>{const s=createState();s.phase='driving';for(let i=0;i<220;i++)tick(s,.05,{gas:false,brake:true});for(let i=0;i<400&&s.phase==='driving';i++)tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'success');});
test('braking halts the player and pausing freezes all traffic',()=>{const s=createState();s.phase='driving';s.speed=40;for(let i=0;i<20;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.speed,0);s.phase='paused';const snapshot=structuredClone(s);tick(s,.05,{gas:true,brake:false});assert.deepEqual(s,snapshot);});
test('right turn does not cross the westbound priority lane',()=>{assert.equal(conflictOnRoute('right','west'),null);assert.ok(conflictOnRoute('left','south'));assert.ok(conflictOnRoute('straight','west'));});
test('left-turn mission requires the intended exit',()=>{const s=createState('left');s.phase='driving';s.route='straight';s.traffic=[];s.distance=routeLength('straight')-15;tick(s,.05,{gas:false,brake:false});assert.equal(s.phase,'failed');assert.match(s.reason,/venstre/);});
test('all lessons can be completed after yielding until the road is clear',()=>{for(const lesson of ['right','left','signed','priority'] as const){const s=createState(lesson);s.phase='driving';for(let i=0;i<250;i++)tick(s,.05,{gas:false,brake:true});for(let i=0;i<500&&s.phase==='driving';i++)tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'success',lesson);}});
test('signed yield catches eastbound traffic as well as westbound traffic',()=>{const s=createState('signed');s.phase='driving';s.distance=205;s.speed=70;s.traffic=[{id:1,direction:'east',x:420,y:401,angle:90,speed:60,color:'#abc',style:0}];tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'failed');});
test('a driver can still brake safely before entering the intersection',()=>{const s=createState();s.phase='driving';s.distance=150;s.speed=65;for(let i=0;i<30;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'driving');assert.equal(s.speed,0);assert.ok(s.distance<190);});

function advance(s:State,seconds:number,gas=false){for(let i=0;i<seconds/.05&&s.phase==='driving';i++)tick(s,.05,{gas,brake:!gas});}
function npc(direction:Traffic['direction'],route:Traffic['route'],distance:number,id=1):Traffic{return{id,direction,route,distance,speed:55,cruiseSpeed:60,...lanePose(direction,route!,distance),color:'#789',style:0};}

test('W and Up explicitly select straight, while A and D are direct selections',()=>{
  const s=createState();selectDirection(s,'a');assert.equal(s.route,'left');selectDirection(s,'w');assert.equal(s.route,'straight');
  selectDirection(s,'d');assert.equal(s.route,'right');selectDirection(s,'ArrowUp');assert.equal(s.route,'straight');
  selectDirection(s,'a');selectDirection(s,'a');assert.equal(s.route,'left');s.distance=180;selectDirection(s,'w');assert.equal(s.route,'left');
});
test('indicators toggle independently, switch sides, and do not change the chosen route',()=>{
  const s=createState();toggleIndicator(s,'left');assert.equal(s.indicator,'left');assert.equal(s.route,'straight');
  toggleIndicator(s,'right');assert.equal(s.indicator,'right');toggleIndicator(s,'right');assert.equal(s.indicator,null);
});
test('right-hand priority applies to every approach, and signs override it',()=>{
  for(const [a,b] of [['north','west'],['east','north'],['south','east'],['west','south']] as const){assert.equal(mustYield({direction:a,route:'straight'},{direction:b,route:'straight'},'right'),true);assert.equal(mustYield({direction:b,route:'straight'},{direction:a,route:'straight'},'right'),false);}
  assert.equal(mustYield({direction:'east',route:'straight'},{direction:'north',route:'straight'},'signed'),false);
  assert.equal(mustYield({direction:'north',route:'straight'},{direction:'east',route:'straight'},'signed'),true);
});
test('traffic from the left stops for a player approaching from its right, then resumes',()=>{
  const s=createState('priority');s.phase='driving';s.distance=160;s.traffic=[npc('east','straight',65)];
  advance(s,4);assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[0].x<398);assert.equal(s.traffic[0].waitingFor,'priority');assert.equal(s.traffic[0].braking,true);
  advance(s,10,true);assert.equal(s.phase,'success');assert.ok(s.traffic[0].speed>20);assert.ok(s.traffic[0].x>562);
});
test('an oncoming left-turning NPC stops for the player going straight',()=>{
  const s=createState('priority');s.phase='driving';s.distance=160;s.traffic=[npc('south','left',75)];advance(s,4);
  assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[0].y<278);assert.equal(s.traffic[0].waitingFor,'priority');
});
test('NPCs yield to other NPCs, not only to the player',()=>{
  const s=createState();s.phase='driving';s.traffic=[npc('west','straight',70,1),npc('south','straight',70,2)];advance(s,2);
  assert.ok(s.traffic[0].distance!<=176);assert.ok(s.traffic[0].speed<20);assert.equal(s.traffic[0].waitingFor,'priority');assert.ok(s.traffic[1].distance!>180);
});
test('a queue keeps a car-length gap behind the vehicle yielding to the player',()=>{
  const s=createState('priority');s.phase='driving';s.distance=160;s.traffic=[npc('east','straight',120,1),npc('east','straight',35,2)];advance(s,6);
  assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[1].speed<1);assert.ok(s.traffic[0].x-s.traffic[1].x>=55);assert.equal(s.traffic[1].waitingFor,'queue');
});
function intentionFixture(signal:Indicator){const s=createState('priority');Object.assign(s,{phase:'driving',route:'left',distance:120,time:1,speed:20});s.traffic=[npc('south','left',175)];s.traffic[0].speed=30;if(signal){toggleIndicator(s,signal);s.indicatorSince=0;}for(let i=0;i<5;i++)tick(s,.05,{gas:false,brake:false});return s;}
test('a sustained correct left signal lets the oncoming left-turner use its separate path',()=>{
  const unknown=intentionFixture(null),clear=intentionFixture('left'),misleading=intentionFixture('right');
  assert.ok(unknown.traffic[0].speed<1);assert.ok(clear.traffic[0].speed>30);assert.ok(misleading.traffic[0].speed<1);
  assert.equal(clear.traffic[0].waitingFor,null);assert.deepEqual(pathConflicts('north','left','south','left'),[]);
});
test('flashing a signal for one frame does not release a waiting car',()=>{
  const s=intentionFixture(null);toggleIndicator(s,'left');tick(s,.05,{gas:false,brake:true});assert.equal(s.traffic[0].waitingFor,'priority');
});
test('a turn signal never overrides signed yield or oncoming priority',()=>{
  for(const lesson of ['signed','left'] as const){const s=createState(lesson);s.phase='driving';toggleIndicator(s,lesson==='left'?'left':'right');advance(s,15,true);assert.equal(s.phase,'failed',lesson);}
});
test('NPC turning indicators and brake lights are part of the simulation state',()=>{
  const s=createState('priority');s.phase='driving';s.distance=160;s.traffic=[npc('south','left',75)];advance(s,.2);assert.equal(s.traffic[0].indicator,'left');advance(s,4);assert.equal(s.traffic[0].braking,true);
});
test('turn indicators cancel after the turn but the feedback remembers their use',()=>{
  const s=createState('left');s.phase='driving';s.traffic=[];toggleIndicator(s,'left');advance(s,15,true);assert.equal(s.phase,'success');assert.equal(s.indicator,null);assert.equal(s.indicatorUsed,'left');
});
test('the reciprocal-priority exercise completes across traffic variants without forcing an entry',()=>{
  for(const seed of [1,42,59,152,999]){const s=createState('priority',seed);s.phase='driving';const yielded=new Set<number>();for(let i=0;i<400&&s.phase==='driving';i++){tick(s,.05,{gas:true,brake:false});for(const c of s.traffic)if(c.waitingFor==='priority')yielded.add(c.id);for(let a=0;a<s.traffic.length;a++)for(let b=a+1;b<s.traffic.length;b++)assert.ok(Math.hypot(s.traffic[a].x-s.traffic[b].x,s.traffic[a].y-s.traffic[b].y)>35,`NPC collision, seed ${seed}`);}assert.equal(s.phase,'success',String(seed));assert.ok(yielded.size>=2);}
});
