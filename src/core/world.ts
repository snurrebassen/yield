import type {SpeedLimit} from './speed.ts';
import type {Point,Route,Traffic,JunctionRule} from './types.ts';
import type {Body} from './physics.ts';
import {angleDifference,pointAlong,projectPath} from './physics.ts';
import {random} from './scenario.ts';
export type TrafficDensity='none'|'low'|'normal'|'high';
export const TRAFFIC_DENSITY={none:0,low:.4,normal:1,high:2.5} as const;
export type WorldSettings={trafficDensity:TrafficDensity};
export type Port=0|1|2|3;
export type PlaceKind='cross'|'t-left'|'t-right'|'side-yield'|'priority'|'roundabout';
export type WorldNode={id:number;seed:number;cx:number;cy:number;x:number;y:number;angle:number;kind:PlaceKind;speedLimit:SpeedLimit;arms:Port[];priority:Port[];connections:Partial<Record<Port,number>>;spawned:boolean};
export type WorldRoad={id:number;a:number;b:number;ap:Port;bp:Port;points:Point[];forward:Point[];backward:Point[];width:number;speedLimit:SpeedLimit};
export type WorldCar=Traffic & {path:Point[];mode:'road'|'junction';nodeId:number;entry:Port;exit:Port;roadId:number|null;forward:boolean;progress:number};
export type WorldState={seed:number;settings:WorldSettings;nodes:WorldNode[];roads:WorldRoad[];cars:WorldCar[];activeNodeId:number;entry:Port;nextCarId:number;nextRoadId:number;elapsedFar:number;streamAt:number;enteredNodeId:number|null;owners:Record<number,number>;generated:number;retired:number;playerRoadId:number|null};
export const WORLD_BUDGET={nodes:28,roads:36,cars:72,prefetchDepth:2,near:1250,draw:1050,retire:3500,farStep:.2};
export const vector=(angle:number)=>({x:Math.sin(angle*Math.PI/180),y:-Math.cos(angle*Math.PI/180)});
export function portAngle(node:WorldNode,port:Port){return node.angle+port*90;}
export function atPort(node:WorldNode,port:Port,distance=230,lane:'in'|'out'|'center'='center'):Point {
  const angle=portAngle(node,port),v=vector(angle),right={x:Math.cos(angle*Math.PI/180),y:Math.sin(angle*Math.PI/180)},offset=lane==='in'?-41:lane==='out'?41:0;
  return{x:node.x+v.x*distance+right.x*offset,y:node.y+v.y*distance+right.y*offset};
}
function hash(seed:number,a:number,b:number){let h=(seed^Math.imul(a,0x45d9f3b)^Math.imul(b+17,0x27d4eb2d))>>>0;h=Math.imul(h^(h>>>16),0x45d9f3b)>>>0;return(h^(h>>>16))>>>0;}
export function makeNode(seed:number,id:number,x:number,y:number,angle:number):WorldNode {
  const rng=random(hash(seed,id,9)),roll=rng();
  const kind:PlaceKind=roll<.16?'roundabout':roll<.32?'priority':roll<.49?'side-yield':roll<.65?'t-left':roll<.81?'t-right':'cross';
  const arms:Port[]=kind==='t-left'?[0,2,3]:kind==='t-right'?[0,1,2]:kind==='side-yield'?(rng()<.5?[0,1,2]:[0,2,3]):[0,1,2,3];
  const priority:Port[]=kind==='priority'?(rng()<.65?[0,2]:[1,3]):kind==='side-yield'?[0,2]:[];
  return{id,seed:hash(seed,id,3),cx:0,cy:0,x,y,angle,kind,speedLimit:kind==='roundabout'?30:kind==='priority'?50:kind==='side-yield'?40:30,arms,priority,connections:{},spawned:false};
}
export function cubic(a:Point,b:Point,c:Point,d:Point,steps=28):Point[]{const points:Point[]=[];for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;points.push({x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y});}return points;}
function offsetPath(points:Point[],offset:number):Point[]{return points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);return{x:p.x-dy/len*offset,y:p.y+dx/len*offset};});}
function cellNode(seed:number,cx:number,cy:number):WorldNode {
  const id=cx===0&&cy===0?1:hash(seed,cx,cy),rng=random(id^seed);
  // A jittered cell topology guarantees onward links without accumulating heading drift.
  // Positions, junction angles and cubic tangents vary; roads are not straight grid lines.
  const x=cx*1450+(rng()-.5)*430+Math.sin(cy*.75)*160;
  const y=cy*1450+(rng()-.5)*430+Math.sin(cx*.65)*160;
  return {...makeNode(seed,id,cx===0&&cy===0?0:x,cx===0&&cy===0?0:y,(rng()-.5)*26),cx,cy};
}
function roadBetween(world:WorldState,parent:WorldNode,port:Port):WorldNode|null {
  const existing=world.roads.find(road=>road.id===parent.connections[port]);if(existing)return world.nodes.find(n=>n.id===(existing.a===parent.id?existing.b:existing.a))??null;
  if(world.nodes.length>=WORLD_BUDGET.nodes||world.roads.length>=WORLD_BUDGET.roads)return null;
  const cx=parent.cx+([0,1,0,-1][port]),cy=parent.cy+([-1,0,1,0][port]),opposite=((port+2)%4) as Port;
  const found=world.nodes.find(n=>n.cx===cx&&n.cy===cy),child=found??cellNode(world.seed,cx,cy);
  if(!child.arms.includes(opposite)){
    if(found){parent.arms=parent.arms.filter(p=>p!==port);return null;}
    child.arms.push(opposite);
    if(child.arms.length===4&&child.kind.startsWith('t-'))child.kind='cross';
  }
  const start=atPort(parent,port),end=atPort(child,opposite),v=vector(portAngle(parent,port)),w=vector(portAngle(child,opposite)),length=Math.hypot(end.x-start.x,end.y-start.y);
  const points=cubic(start,{x:start.x+v.x*length*.34,y:start.y+v.y*length*.34},{x:end.x+w.x*length*.34,y:end.y+w.y*length*.34},end);
  const road:WorldRoad={id:world.nextRoadId++,a:parent.id,b:child.id,ap:port,bp:opposite,points,forward:offsetPath(points,41),backward:offsetPath([...points].reverse(),41),width:164,speedLimit:([30,40,50,60] as const)[hash(world.seed,parent.id,port)%4]};
  if(!found)world.nodes.push(child);world.roads.push(road);parent.connections[port]=road.id;child.connections[opposite]=road.id;world.generated+=found?0:1;return child;
}
export function createWorld(seed:number,settings:Partial<WorldSettings>={}):WorldState {
  const root=cellNode(seed,0,0);root.angle=0;
  const world:WorldState={seed,settings:{trafficDensity:settings.trafficDensity&&settings.trafficDensity in TRAFFIC_DENSITY?settings.trafficDensity:'normal'},nodes:[root],roads:[],cars:[],activeNodeId:1,entry:2,nextCarId:1,nextRoadId:1,elapsedFar:0,streamAt:0,enteredNodeId:null,owners:{},generated:1,retired:0,playerRoadId:null};
  streamWorld(world,{x:41,y:290,angle:0,wheel:0},true);return world;
}
export function streamWorld(world:WorldState,player:Body,_force=false){
  const active=world.nodes.find(n=>n.id===world.activeNodeId);if(!active)return;
  const keep=new Set<number>([active.id]);let frontier=[active];
  // Keep two graph steps in every available direction; no chosen destination is required.
  for(let depth=0;depth<WORLD_BUDGET.prefetchDepth;depth++){
    const next:WorldNode[]=[];
    for(const node of frontier)for(const port of node.arms){const child=roadBetween(world,node,port);if(child&&!keep.has(child.id)){keep.add(child.id);next.push(child);}}
    frontier=next;
  }
  const removable=world.nodes.filter(n=>!keep.has(n.id)&&Math.hypot(n.x-player.x,n.y-player.y)>WORLD_BUDGET.retire);
  const ids=new Set(removable.map(n=>n.id));world.retired+=ids.size;world.nodes=world.nodes.filter(n=>!ids.has(n.id));
  const roadIds=new Set(world.roads.filter(r=>ids.has(r.a)||ids.has(r.b)).map(r=>r.id));world.roads=world.roads.filter(r=>!roadIds.has(r.id));
  for(const node of world.nodes)for(const p of node.arms)if(roadIds.has(node.connections[p]!))delete node.connections[p];
  world.cars=world.cars.filter(car=>!ids.has(car.nodeId)&&!roadIds.has(car.roadId!)&&Math.hypot(car.x-player.x,car.y-player.y)<WORLD_BUDGET.retire);
  for(const key of Object.keys(world.owners))if(ids.has(Number(key))||!world.cars.some(c=>c.id===world.owners[Number(key)]&&c.nodeId===Number(key)))delete world.owners[Number(key)];
}
const routeCache=new WeakMap<WorldNode,Map<string,Point[]>>();
export function junctionPath(node:WorldNode,entry:Port,exit:Port):Point[]{
  let cache=routeCache.get(node);if(!cache){cache=new Map();routeCache.set(node,cache);}const key=entry+':'+exit,old=cache.get(key);if(old)return old;
  const start=atPort(node,entry,230,'in'),end=atPort(node,exit,230,'out');let points:Point[];
  if(node.kind!=='roundabout')points=cubic(start,atPort(node,entry,85,'in'),atPort(node,exit,85,'out'),end,32);
  else{
    const startAngle=portAngle(node,entry)-20;let endAngle=portAngle(node,exit)+20;while(endAngle>=startAngle-5)endAngle-=360;
    const circle=(a:number)=>{const v=vector(a);return{x:node.x+v.x*112,y:node.y+v.y*112};};
    const tangent=(a:number)=>({x:-Math.cos(a*Math.PI/180),y:-Math.sin(a*Math.PI/180)}),a=circle(startAngle),b=circle(endAngle),ta=tangent(startAngle),tb=tangent(endAngle);
    points=cubic(start,atPort(node,entry,170,'in'),{x:a.x-ta.x*35,y:a.y-ta.y*35},a,12);
    const steps=Math.ceil((startAngle-endAngle)/5);for(let i=1;i<=steps;i++)points.push(circle(startAngle+(endAngle-startAngle)*i/steps));
    points.push(...cubic(b,{x:b.x+tb.x*35,y:b.y+tb.y*35},atPort(node,exit,170,'out'),end,12).slice(1));
  }
  cache.set(key,points);return points;
}
export function poseOn(points:Point[],distance:number){const p=pointAlong(points,distance),ahead=pointAlong(points,distance+2);return{...p,angle:Math.atan2(ahead.x-p.x,-(ahead.y-p.y))*180/Math.PI};}
export function approachDirection(port:Port){return (['south','west','north','east'] as const)[port];}
export function turnFor(entry:Port,exit:Port):Route{const diff=(exit-entry+4)%4;return diff===1?'left':diff===3?'right':'straight';}
export function ruleFor(node:WorldNode,entry:Port):JunctionRule {return node.kind==='roundabout'?'roundabout':node.priority.length?(node.priority.includes(entry)?'priority':'signed'):'unsigned';}
export function nodeAt(world:WorldState,id:number){return world.nodes.find(node=>node.id===id)!;}
export function nearestRoad(world:WorldState,p:Point){let best:{road:WorldRoad;projection:ReturnType<typeof projectPath>}|null=null;for(const road of world.roads){const projection=projectPath(road.points,p);if(!best||projection.offset<best.projection.offset)best={road,projection};}return best;}
export function playerEntry(node:WorldNode,player:Body):Port {
  const incoming=angleDifference(player.angle,node.angle+180);return ((Math.round(incoming/90)+4)%4) as Port;
}
export function visibleWorld(world:WorldState,player:Point){return{nodes:world.nodes.filter(n=>Math.hypot(n.x-player.x,n.y-player.y)<1400),roads:world.roads.filter(r=>r.points.some(p=>Math.hypot(p.x-player.x,p.y-player.y)<1400))};}

export function worldSpeedLimit(world:WorldState,p:Point):SpeedLimit {
  for(const node of world.nodes){
    const radius=Math.hypot(p.x-node.x,p.y-node.y);if(radius>335)continue;
    if(radius<170)return node.speedLimit;
    for(const port of node.arms){const v=vector(portAngle(node,port)),dx=p.x-node.x,dy=p.y-node.y,along=dx*v.x+dy*v.y,side=dx*(-v.y)+dy*v.x;if(along>=0&&along<=320&&Math.abs(side)<82)return node.speedLimit;}
  }
  return nearestRoad(world,p)?.road.speedLimit??nodeAt(world,world.activeNodeId).speedLimit;
}
