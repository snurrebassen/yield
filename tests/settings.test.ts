import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState,stepSimulation,worldSpeedLimit,atPort,poseOn,speedToKmh,kmhToSpeed,WORLD_BUDGET} from '../src/core/index.ts';
import type {TrafficDensity} from '../src/core/world.ts';
test('density is copied on world creation and empty traffic remains empty while streaming',()=>{
 const settings:{trafficDensity:TrafficDensity}={trafficDensity:'none'},s=createWorldState(42,settings);settings.trafficDensity='high';s.phase='driving';assert.equal(s.world!.settings.trafficDensity,'none');
 for(let i=0;i<300;i++)stepSimulation(s,{gas:false,brake:true});assert.equal(s.world!.cars.length,0);
 const restart=createWorldState(42,settings);assert.equal(restart.world!.settings.trafficDensity,'high');assert.ok(restart.world!.cars.length>0);
});
test('traffic density produces increasing counts without changing roads or signs',()=>{
 const totals={low:0,normal:0,high:0};
 for(let seed=0;seed<25;seed++){
 const worlds=(['low','normal','high'] as const).map(trafficDensity=>createWorldState(seed,{trafficDensity}).world!);
 for(let i=0;i<3;i++){const w=worlds[i];totals[(['low','normal','high'] as const)[i]]+=w.cars.length;assert.ok(w.cars.length<=WORLD_BUDGET.cars);assert.deepEqual(w.roads,worlds[0].roads);assert.deepEqual(w.nodes,worlds[0].nodes);}
 }
 assert.ok(totals.normal>totals.low*1.8);assert.ok(totals.high>totals.normal*1.5);
});
test('speed conversion keeps the existing scale and a car can exceed the old 30 km/h cap',()=>{
 assert.equal(speedToKmh(88),30);assert.equal(kmhToSpeed(60),176);
 const s=createWorldState(42,{trafficDensity:'none'}),road=s.world!.roads.find(r=>r.speedLimit===60)!;assert.ok(road);s.player={...poseOn(road.forward,200),wheel:0};s.phase='driving';
 for(let i=0;i<240;i++)stepSimulation(s,{gas:true,brake:false});assert.equal(s.phase,'driving');assert.ok(speedToKmh(s.speed)>45);
});
test('seeded limits vary between 30 and 60 and change at the signed node boundary in both directions',()=>{
 const s=createWorldState(2),w=s.world!,n=w.nodes[0],road=w.roads.find(r=>r.id===n.connections[2])!;n.speedLimit=30;road.speedLimit=60;
 assert.equal(worldSpeedLimit(w,atPort(n,2,321,'in')),60);assert.equal(worldSpeedLimit(w,atPort(n,2,319,'in')),30);
 assert.equal(worldSpeedLimit(w,atPort(n,2,319,'out')),30);assert.equal(worldSpeedLimit(w,atPort(n,2,321,'out')),60);
 const limits=new Set(Array.from({length:15},(_,seed)=>createWorldState(seed).world!.roads.map(r=>r.speedLimit)).flat());assert.deepEqual([...limits].sort(),[30,40,50,60]);
});
test('NPC cruising speeds respect the limit of their road and JSON transfer preserves settings and limits',()=>{
 const s=createWorldState(42,{trafficDensity:'high'});for(const car of s.world!.cars){const road=s.world!.roads.find(r=>r.id===car.roadId)!;assert.ok(car.cruiseSpeed!<=kmhToSpeed(road.speedLimit));}
 s.phase='driving';for(let i=0;i<300;i++)stepSimulation(s,{gas:false,brake:true});const copy=JSON.parse(JSON.stringify(s));for(let i=0;i<120;i++){stepSimulation(s,{gas:false,brake:true});stepSimulation(copy,{gas:false,brake:true});}assert.deepEqual(s,copy);
});
test('courtesy reservations select the front vehicle rather than a follower in its queue',()=>{
 const s=createWorldState(9);s.phase='driving';
 for(let i=0;i<3600;i++){
  stepSimulation(s,{gas:false,brake:true});
  for(const owner of Object.values(s.world!.owners)){const car=s.world!.cars.find(c=>c.id===owner);if(car?.mode==='road')assert.ok(!s.world!.cars.some(other=>other.mode==='road'&&other.roadId===car.roadId&&other.nodeId===car.nodeId&&other.progress>car.progress+.01),'a queued follower must not block the lead car');}
 }
});
