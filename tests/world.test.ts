import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState,stepSimulation,createWorld,streamWorld,nodeAt,junctionPath,atPort,poseOn,WORLD_BUDGET,worldLane,worldGuide,vehiclesOverlap} from '../src/core/index.ts';
import type {WorldCar} from '../src/core/world.ts';
import {pathMetrics,angleDifference} from '../src/core/physics.ts';
test('the streamed world is deterministic and has connected roads two steps ahead',()=>{
 const a=createWorld(420),b=createWorld(420);assert.deepEqual(a,b);assert.ok(a.nodes.length>8);
 for(const node of a.nodes)for(const [port,id] of Object.entries(node.connections)){const road=a.roads.find(r=>r.id===id)!;assert.ok(road);assert.ok(road.a===node.id||road.b===node.id);assert.ok(node.arms.includes(Number(port) as never));}
});
test('world seeds provide T-junctions, side yields, priority roads and roundabouts',()=>{
 const kinds=new Set(Array.from({length:25},(_,i)=>createWorld(i).nodes.map(n=>n.kind)).flat());assert.equal(kinds.size,6);
 const roads=createWorld(8).roads;assert.ok(roads.some(r=>Math.abs(angleDifference(poseOn(r.points,0).angle,poseOn(r.points,pathMetrics(r.points).length-2).angle))>4));
});
test('all roundabout paths stay outside the island and circulate counterclockwise',()=>{
 const w=createWorld(420),node=w.nodes.find(n=>n.kind==='roundabout')!;assert.ok(node);
 for(const entry of node.arms)for(const exit of node.arms.filter(p=>p!==entry)){
 const points=junctionPath(node,entry,exit);assert.deepEqual(points[0],atPort(node,entry,230,'in'));assert.ok(Math.hypot(points.at(-1)!.x-atPort(node,exit,230,'out').x,points.at(-1)!.y-atPort(node,exit,230,'out').y)<.001);
 for(const p of points)assert.ok(Math.hypot(p.x-node.x,p.y-node.y)>100);
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(Math.abs(Math.hypot(a.x-node.x,a.y-node.y)-112)<1&&Math.abs(Math.hypot(b.x-node.x,b.y-node.y)-112)<1)assert.ok((a.x-node.x)*(b.y-node.y)-(a.y-node.y)*(b.x-node.x)<0);}
 }
});
test('streaming along 80 roads keeps bounded data and prefetches the onward route',()=>{
 const w=createWorld(41);let active=nodeAt(w,1),previous=-1;
 for(let i=0;i<80;i++){
  w.activeNodeId=active.id;streamWorld(w,{x:active.x,y:active.y,angle:active.angle,wheel:0},true);
  const onward=w.roads.find(r=>(r.a===active.id&&r.b!==previous)||(r.b===active.id&&r.a!==previous));assert.ok(onward,`no onward road at ${i}`);
  assert.ok(w.nodes.length<=WORLD_BUDGET.nodes);assert.ok(w.roads.length<=WORLD_BUDGET.roads);
  previous=active.id;active=nodeAt(w,onward.a===active.id?onward.b:onward.a);
 }
 assert.ok(w.retired>10);
});
test('accelerating follows world coordinates continuously without scene resets',()=>{
 const s=createWorldState(41);s.world!.cars=[];s.world!.nodes.forEach(n=>n.spawned=true);s.phase='driving';let previous={...s.player};
 for(let i=0;i<1800&&s.phase==='driving';i++){stepSimulation(s,{gas:s.speed<88,brake:false});assert.ok(Math.hypot(s.player.x-previous.x,s.player.y-previous.y)<1.6);previous={...s.player};}
 assert.equal(s.phase,'driving');assert.ok(s.distance>1500);assert.ok(s.crossings>=1);assert.ok(Math.hypot(s.player.x,s.player.y)>600);
});
test('world lanes and guidance follow curved links and distinguish opposing traffic',()=>{
 const s=createWorldState(41),w=s.world!,road=w.roads[0],pose=poseOn(road.forward,200);s.player={...pose,wheel:0};w.activeNodeId=road.b;w.playerRoadId=road.id;assert.equal(worldLane(s),'ok');assert.equal(worldGuide(s),road.forward);s.player.angle+=180;assert.equal(worldLane(s),'wrong-lane');
});
test('world traffic retains IDs across roads and remains collision-free while the player waits',()=>{
 let transitions=0;
 for(let seed=1;seed<=15;seed++){
 const s=createWorldState(seed);s.phase='driving';const paths=new Map(s.world!.cars.map(c=>[c.id,c.path]));
 for(let i=0;i<2400;i++){stepSimulation(s,{gas:false,brake:true});assert.equal(s.phase,'driving');if(i%60===0)for(const c of s.world!.cars)for(const d of s.world!.cars)if(c.id<d.id)assert.ok(!vehiclesOverlap(c,d),`NPC collision seed ${seed}`);}
 for(const c of s.world!.cars)if(paths.has(c.id)&&paths.get(c.id)!==c.path)transitions++;
 assert.ok(s.world!.cars.length<=WORLD_BUDGET.cars);
 }
 assert.ok(transitions>10);
});
test('world state can be transferred and resumed with bounded far traffic updates',()=>{
 const a=createWorldState(91);a.phase='driving';for(let i=0;i<100;i++)stepSimulation(a,{gas:false,brake:true});const b=JSON.parse(JSON.stringify(a));
 for(let i=0;i<200;i++){stepSimulation(a,{gas:false,brake:true});stepSimulation(b,{gas:false,brake:true});}assert.deepEqual(a,b);
});
test('the roundabout island is off-road and the soft guide can negotiate its ring',()=>{
 const s=createWorldState(2),node=s.world!.nodes[0];assert.equal(node.kind,'roundabout');s.player.x=node.x;s.player.y=node.y;assert.equal(worldLane(s),'off-road');
 const drive=createWorldState(2);drive.world!.cars=[];drive.world!.nodes.forEach(n=>n.spawned=true);drive.phase='driving';for(let i=0;i<1800;i++)stepSimulation(drive,{gas:drive.speed<88,brake:false});assert.equal(drive.phase,'driving');assert.ok(drive.crossings>=1);
});
test('courtesy release persists until the selected vehicle has cleared a circular wait',()=>{
 const s=createWorldState(7);s.phase='driving';for(let i=0;i<3600;i++)stepSimulation(s,{gas:false,brake:true});
 for(const car of s.world!.cars){const seen=new Set<number>();let current:typeof car|undefined=car;while(current&&current.blockedBy!==null&&current.blockedBy!==undefined&&current.blockedBy!==-1){assert.ok(!seen.has(current.id),'circular wait should have cleared');seen.add(current.id);const blocker=current.blockedBy;current=s.world!.cars.find(c=>c.id===blocker);}}
});
test('wrong-way circulation warns, then freezes the scene if left uncorrected',()=>{
 const s=createWorldState(2),n=s.world!.nodes[0];s.world!.cars=[];s.world!.nodes.forEach(n=>n.spawned=true);s.player={x:n.x+112,y:n.y,angle:180,wheel:0};s.phase='driving';assert.equal(worldLane(s),'wrong-lane');for(let i=0;i<250;i++)stepSimulation(s,{gas:false,brake:true});assert.equal(s.phase,'failed');assert.equal(s.reason,'wrong-lane');const snapshot=structuredClone(s);stepSimulation(s,{gas:true,brake:false});assert.deepEqual(s,snapshot);
});
function approaching(state:ReturnType<typeof createWorldState>,entry:0|1|2|3,exit:0|1|2|3,id=100):WorldCar{
 const w=state.world!,node=w.nodes[0],road=w.roads.find(r=>r.id===node.connections[entry])!,path=road.b===node.id?road.forward:road.backward,progress=pathMetrics(path).length-100;
 return {id,nodeId:node.id,entry,exit,mode:'road' as const,roadId:road.id,forward:road.b===node.id,path,progress,...poseOn(path,progress),speed:45,cruiseSpeed:55,color:'#cf6956',style:0,direction:'west' as const,route:'straight' as const};
}
test('world side-road traffic yields to the player on the priority road, then resumes',()=>{
 const s=Array.from({length:20},(_,seed)=>createWorldState(seed)).find(s=>s.world!.nodes[0].connections[1]!==undefined)!;
 const w=s.world!,n=w.nodes[0];n.kind='priority';n.priority=[0,2];w.nodes.forEach(n=>n.spawned=true);w.cars=[approaching(s,1,0)];s.phase='driving';
 for(let i=0;i<600;i++)stepSimulation(s,{gas:false,brake:true});const c=w.cars[0];assert.equal(c.mode,'road');assert.ok(c.speed<1);assert.equal(c.blockedBy,-1);
 s.player={...atPort(n,0,450,'out'),angle:n.angle,wheel:0};for(let i=0;i<600;i++)stepSimulation(s,{gas:false,brake:true});assert.notEqual(c.path,w.roads.find(r=>r.id===n.connections[1])!.backward);assert.ok(c.speed>0);
});
test('circulating traffic holds the roundabout reservation until it has left',()=>{
 const s=createWorldState(2),w=s.world!,n=w.nodes[0];w.nodes.forEach(n=>n.spawned=true);const inside=approaching(s,0,2),waiting=approaching(s,1,0,101);
 inside.mode='junction';inside.path=junctionPath(n,0,2);inside.roadId=null;inside.progress=80;Object.assign(inside,poseOn(inside.path,80));w.cars=[inside,waiting];w.owners[n.id]=inside.id;s.phase='driving';
 for(let i=0;i<240;i++)stepSimulation(s,{gas:false,brake:true});assert.equal(waiting.mode,'road');assert.ok(waiting.speed<1);assert.equal(waiting.blockedBy,inside.id);
 for(let i=0;i<1000;i++)stepSimulation(s,{gas:false,brake:true});assert.ok(waiting.path!==w.roads.find(r=>r.id===n.connections[1])!.backward);
});
