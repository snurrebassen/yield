import {test} from 'node:test';
import assert from 'node:assert/strict';
import {angleDifference,cameraPoint,goalPointer,laneStatus,pointAlong,projectPath,steeringInput,stepDriving} from '../src/driving.ts';
import {createState,tick,poseAt,routeLength,makeTraffic,conflictOnRoute,goalPoint,routePoints,toggleIndicator,lanePose,mustYield,pathConflicts,type State,type Indicator,type Traffic} from '../src/engine.ts';
test('retries reproduce the traffic exactly, while new seeds vary appearances',()=>{assert.deepEqual(makeTraffic('right',42),makeTraffic('right',42));assert.notDeepEqual(makeTraffic('right',42),makeTraffic('right',59));});
test('every route begins in the correct lane and reaches its own exit',()=>{for(const route of ['left','straight','right'] as const){assert.deepEqual(poseAt(route,0),{x:521,y:650,angle:0});const end=poseAt(route,routeLength(route));assert.ok(route==='left'?end.x<50:route==='right'?end.x>900:end.y<70);}});
test('stopped driver can wait safely for all priority traffic',()=>{const s=createState();s.phase='driving';place(s,170);for(let i=0;i<1000;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'driving');assert.equal(s.distance,170);assert.equal(s.speed,0);});
test('straight-through acceleration into conflicting traffic fails',()=>{const s=createState();s.phase='driving';for(let i=0;i<400&&s.phase==='driving';i++)tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'failed');});
test('waiting for a clear gap then proceeding succeeds',()=>{const s=createState();s.phase='driving';for(let i=0;i<220;i++)tick(s,.05,{gas:false,brake:true});for(let i=0;i<400&&s.phase==='driving';i++)tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'success');});
test('braking halts the player and pausing freezes all traffic',()=>{const s=createState();s.phase='driving';s.speed=40;for(let i=0;i<20;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.speed,0);s.phase='paused';const snapshot=structuredClone(s);tick(s,.05,{gas:true,brake:false});assert.deepEqual(s,snapshot);});
test('right turn does not cross the westbound priority lane',()=>{assert.equal(conflictOnRoute('right','west'),null);assert.ok(conflictOnRoute('left','south'));assert.ok(conflictOnRoute('straight','west'));});
test('mission completion requires reaching the actual marked exit',()=>{const s=createState('left');s.phase='driving';s.traffic=[];place(s,routeLength('straight')-10);tick(s,.05,{gas:false,brake:false});assert.equal(s.phase,'failed');assert.match(s.reason,/annen vei/);});
test('all lessons can be completed after yielding until the road is clear',()=>{for(const lesson of ['right','left','signed','priority'] as const){const s=createState(lesson);s.phase='driving';for(let i=0;i<250;i++)tick(s,.05,{gas:false,brake:true});advance(s,25,true,true);assert.equal(s.phase,'success',lesson+': '+s.reason);}});
test('signed yield catches eastbound traffic as well as westbound traffic',()=>{const s=createState('signed');s.phase='driving';place(s,205);s.speed=70;s.traffic=[{id:1,direction:'east',x:420,y:401,angle:90,speed:60,color:'#abc',style:0}];tick(s,.05,{gas:true,brake:false});assert.equal(s.phase,'failed');});
test('a driver can still brake safely before entering the intersection',()=>{const s=createState();s.phase='driving';place(s,150);s.speed=65;for(let i=0;i<30;i++)tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'driving');assert.equal(s.speed,0);assert.ok(s.distance<190);});

function place(s:State,distance:number,route:State['route']='straight'){s.player={...poseAt(route,distance),wheel:0};s.route=route;s.distance=distance;}
function driveInput(s:State){const points=routePoints(s.goal),projection=projectPath(points,s.player),aim=pointAlong(points,projection.distance+35);const desired=Math.atan2(aim.x-s.player.x,-(aim.y-s.player.y))*180/Math.PI;return Math.max(-1,Math.min(1,angleDifference(desired,s.player.angle)/32));}
function advance(s:State,seconds:number,gas=false,steering=false){for(let i=0;i<seconds/.05&&s.phase==='driving';i++)tick(s,.05,{gas,brake:!gas,steer:steering?driveInput(s):0});}
function npc(direction:Traffic['direction'],route:Traffic['route'],distance:number,id=1):Traffic{return{id,direction,route,distance,speed:55,cruiseSpeed:60,...lanePose(direction,route!,distance),color:'#789',style:0};}

test('W and Up never request steering; A/D are continuous, car-relative controls',()=>{
  assert.equal(steeringInput(new Set(['w'])),0);assert.equal(steeringInput(new Set(['ArrowUp'])),0);
  assert.equal(steeringInput(new Set(['w','a'])),-1);assert.equal(steeringInput(new Set(['w','d'])),1);
  assert.equal(steeringInput(new Set(['a','d'])),0);
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
  const s=createState('priority');s.phase='driving';place(s,160);s.traffic=[npc('east','straight',65)];
  advance(s,4);assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[0].x<398);assert.equal(s.traffic[0].waitingFor,'priority');assert.equal(s.traffic[0].braking,true);
  advance(s,10,true);assert.equal(s.phase,'success');assert.ok(s.traffic[0].speed>20);assert.ok(s.traffic[0].x>562);
});
test('an oncoming left-turning NPC stops for the player going straight',()=>{
  const s=createState('priority');s.phase='driving';place(s,160);s.traffic=[npc('south','left',75)];advance(s,4);
  assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[0].y<278);assert.equal(s.traffic[0].waitingFor,'priority');
});
test('NPCs yield to other NPCs, not only to the player',()=>{
  const s=createState();s.phase='driving';s.traffic=[npc('west','straight',70,1),npc('south','straight',70,2)];advance(s,2);
  assert.ok(s.traffic[0].distance!<=176);assert.ok(s.traffic[0].speed<20);assert.equal(s.traffic[0].waitingFor,'priority');assert.ok(s.traffic[1].distance!>180);
});
test('a queue keeps a car-length gap behind the vehicle yielding to the player',()=>{
  const s=createState('priority');s.phase='driving';place(s,160);s.traffic=[npc('east','straight',120,1),npc('east','straight',35,2)];advance(s,6);
  assert.ok(s.traffic[0].speed<1);assert.ok(s.traffic[1].speed<1);assert.ok(s.traffic[0].x-s.traffic[1].x>=55);assert.equal(s.traffic[1].waitingFor,'queue');
});
function intentionFixture(signal:Indicator){const s=createState('priority');Object.assign(s,{phase:'driving',time:1,speed:20});place(s,120,'left');s.traffic=[npc('south','left',175)];s.traffic[0].speed=30;if(signal){toggleIndicator(s,signal);s.indicatorSince=0;}for(let i=0;i<5;i++)tick(s,.05,{gas:false,brake:false});return s;}
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
  const s=createState('priority');s.phase='driving';place(s,160);s.traffic=[npc('south','left',75)];advance(s,.2);assert.equal(s.traffic[0].indicator,'left');advance(s,4);assert.equal(s.traffic[0].braking,true);
});
test('turn indicators cancel after the turn but the feedback remembers their use',()=>{
  const s=createState('left');s.phase='driving';s.traffic=[];toggleIndicator(s,'left');advance(s,15,true,true);assert.equal(s.phase,'success',s.reason);assert.equal(s.indicator,null);assert.equal(s.indicatorUsed,'left');
});
test('the reciprocal-priority exercise completes across traffic variants without forcing an entry',()=>{
  for(const seed of [1,42,59,152,999]){const s=createState('priority',seed);s.phase='driving';const yielded=new Set<number>();for(let i=0;i<400&&s.phase==='driving';i++){tick(s,.05,{gas:true,brake:false});for(const c of s.traffic)if(c.waitingFor==='priority')yielded.add(c.id);for(let a=0;a<s.traffic.length;a++)for(let b=a+1;b<s.traffic.length;b++)assert.ok(Math.hypot(s.traffic[a].x-s.traffic[b].x,s.traffic[a].y-s.traffic[b].y)>35,`NPC collision, seed ${seed}`);}assert.equal(s.phase,'success',String(seed));assert.ok(yielded.size>=2);}
});

test('accelerating and releasing W never selects a route or resets a turn',()=>{
  const s=createState('left');s.phase='driving';s.traffic=[];s.assistance=0;s.player.angle=-35;s.player.wheel=-.2;
  const before=s.player.angle;tick(s,.05,{gas:true,brake:false});assert.equal(s.goal,'left');assert.ok(s.player.angle<before);assert.ok(s.player.x<521);
  tick(s,.05,{gas:false,brake:false});const released=s.player.angle;tick(s,.05,{gas:true,brake:false});assert.ok(s.player.angle<=released);assert.equal(s.goal,'left');
});
test('steering works both before the junction and after the old route-lock point',()=>{
  for(const distance of [0,180,400]){const s=createState();s.phase='driving';s.traffic=[];s.assistance=0;place(s,distance);s.speed=50;
    tick(s,.05,{gas:true,brake:false,steer:-1});assert.ok(s.player.angle<0);assert.ok(s.player.x<521);
  }
});
test('left and right always turn relative to the car, including after a 90-degree turn',()=>{
  for(const heading of [0,90,180,-90])for(const steer of [-1,1]){const body={x:521,y:650,angle:heading,wheel:0};stepDriving(body,50,steer,routePoints('straight'),.05,0);assert.equal(Math.sign(body.angle-heading),steer);}
});
test('the guide preserves a small lateral offset instead of snapping to the centre',()=>{
  const body={x:528,y:630,angle:0,wheel:0};for(let i=0;i<40;i++)stepDriving(body,40,0,routePoints('straight'),.05,1);
  assert.equal(body.x,528);assert.equal(body.angle,0);assert.ok(body.y<630);
});
test('releasing steering gradually centres the wheel and gently reduces drift',()=>{
  const body={x:546,y:630,angle:0,wheel:0};stepDriving(body,40,0,routePoints('straight'),.05,.6);assert.ok(body.x>545);assert.ok(body.x<546);
  for(let i=0;i<60;i++)stepDriving(body,40,0,routePoints('straight'),.05,.6);assert.ok(body.x<540);assert.ok(body.x>510);
  body.wheel=.65;const wheel=body.wheel;stepDriving(body,40,0,routePoints('straight'),.05,0);assert.ok(body.wheel>0);assert.ok(body.wheel<wheel);
});
test('manual steering can cross into the opposing lane even with maximum assistance',()=>{
  const s=createState();s.phase='driving';s.traffic=[];s.assistance=1;s.speed=60;let wrong=false;
  for(let i=0;i<60&&s.phase==='driving';i++){tick(s,.05,{gas:true,brake:false,steer:-.45});wrong||=s.lane==='wrong-lane';}
  assert.ok(s.player.x<480);assert.ok(wrong);assert.equal(s.goal,'straight');
});
test('understeering a left-turn mission does not move the car onto its guide track',()=>{
  const s=createState('left');s.phase='driving';s.traffic=[];advance(s,6,true);
  assert.ok(projectPath(routePoints('left'),s.player).offset>60);assert.notEqual(s.phase,'success');
});
test('continuous driving can reach all three marked exits',()=>{
  for(const goal of ['straight','left','right'] as const){const s=createState();s.goal=goal;s.phase='driving';s.traffic=[];advance(s,20,true,true);assert.equal(s.phase,'success',goal+': '+s.reason);assert.ok(Math.hypot(s.player.x-goalPoint(goal).x,s.player.y-goalPoint(goal).y)<35);}
});
test('changing route progress cannot award completion or teleport the player',()=>{
  const s=createState();s.phase='driving';s.traffic=[];s.distance=9999;tick(s,.05,{gas:false,brake:false});assert.equal(s.phase,'driving');assert.equal(s.player.x,521);assert.equal(s.player.y,650);assert.equal(s.distance,0);
});
test('collision checks use the real car position, including in the opposing lane',()=>{
  const s=createState();s.phase='driving';s.player.x=439;s.traffic=[npc('south','straight',578)];tick(s,.05,{gas:false,brake:true});assert.equal(s.phase,'failed');assert.match(s.reason,/nær/);
  const clear=createState();clear.phase='driving';clear.player.x=439;clear.traffic=[npc('north','straight',0)];tick(clear,.05,{gas:false,brake:true});assert.equal(clear.phase,'driving');
});
test('NPC emergency braking observes the free-moving car outside its planned lane',()=>{
  const s=createState();s.phase='driving';s.player.x=439;s.traffic=[npc('south','straight',505)];advance(s,.3);assert.equal(s.phase,'driving');assert.ok(s.traffic[0].speed<55);assert.equal(s.traffic[0].waitingFor,'safety');
});
test('car-relative camera keeps the player fixed and points its heading up',()=>{
  for(const angle of [0,90,180,-90,410]){const body={x:400,y:500,angle,wheel:0};const p=cameraPoint(body,body);assert.deepEqual(p,{x:480,y:535});const rad=angle*Math.PI/180,ahead=cameraPoint({x:body.x+Math.sin(rad)*50,y:body.y-Math.cos(rad)*50},body);assert.ok(Math.abs(ahead.x-480)<1e-8);assert.ok(Math.abs(ahead.y-485)<1e-8);}
});
test('overview leaves the world fixed and off-screen goals remain visible on their bearing',()=>{
  const body={x:521,y:650,angle:0,wheel:0};assert.deepEqual(cameraPoint({x:80,y:319},body,false),{x:80,y:319});
  for(const goal of [{x:521,y:-2000},{x:-2000,y:319},{x:3000,y:401}]){const pointer=goalPointer(goal,body);assert.equal(pointer.offscreen,true);assert.ok(pointer.x>=79.99&&pointer.x<=880.01);assert.ok(pointer.y>=89.99&&pointer.y<=640.01);}
});
test('grass and opposing lanes report separate, recoverable warnings',()=>{
  assert.equal(laneStatus({x:450,y:600,angle:0}),'wrong-lane');assert.equal(laneStatus({x:450,y:600,angle:180}),'ok');assert.equal(laneStatus({x:350,y:600,angle:0}),'off-road');
});
