import {createWorldState,createWorld,streamWorld,nodeAt,stepSimulation,WORLD_BUDGET,vehiclesOverlap} from '../src/core/index.ts';
let missingLinks=0,maxNodes=0,maxRoads=0;
for(let seed=0;seed<100;seed++){
 const w=createWorld(seed);let node=nodeAt(w,1),previous=-1;
 for(let hop=0;hop<80;hop++){
  w.activeNodeId=node.id;streamWorld(w,{...node,wheel:0},true);
  const roads=w.roads.filter(r=>(r.a===node.id&&r.b!==previous)||(r.b===node.id&&r.a!==previous));
  if(!roads.length){missingLinks++;break;}
  maxNodes=Math.max(maxNodes,w.nodes.length);maxRoads=Math.max(maxRoads,w.roads.length);
  const road=roads[(seed+hop)%roads.length];previous=node.id;node=nodeAt(w,road.a===node.id?road.b:road.a);
 }
}
const samples:number[]=[];let collisions=0,cycles=0,maxCars=0;
for(let seed=1;seed<=80;seed++){
 const s=createWorldState(seed);s.phase='driving';
 for(let step=0;step<3600;step++){
  const start=performance.now();stepSimulation(s,{gas:false,brake:true});samples.push(performance.now()-start);
  if(step%60===0){const cars=s.world!.cars;maxCars=Math.max(maxCars,cars.length);for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)if(vehiclesOverlap(cars[i],cars[j]))collisions++;}
 }
 for(const car of s.world!.cars){const visited=new Set<number>();let current:typeof car|undefined=car;while(current?.blockedBy!==undefined&&current?.blockedBy!==null&&current.blockedBy!==-1){if(visited.has(current.id)){cycles++;break;}visited.add(current.id);const blocker=current.blockedBy;current=s.world!.cars.find(c=>c.id===blocker);}}
}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({traversalHops:8000,missingLinks,maxNodes,maxRoads,maxCars,simulatedSteps:samples.length,npcContacts:collisions,remainingWaitCycles:cycles,stepMilliseconds:{mean:samples.reduce((a,b)=>a+b,0)/samples.length,p95:samples[Math.floor(samples.length*.95)],p99:samples[Math.floor(samples.length*.99)],max:samples.at(-1)},budgets:WORLD_BUDGET},null,2));
if(missingLinks||collisions||cycles||maxNodes>WORLD_BUDGET.nodes||maxRoads>WORLD_BUDGET.roads||maxCars>WORLD_BUDGET.cars)process.exitCode=1;
