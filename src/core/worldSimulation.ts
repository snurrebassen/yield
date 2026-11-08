import {kmhToSpeed,MAX_DRIVING_SPEED} from './speed.ts';
import type {State,Input,Point} from './types.ts';
import {createState} from './state.ts';
import {angleDifference,pathMetrics,projectPath,stepDriving} from './physics.ts';
import {fail,warn} from './events.ts';
import {vehiclesOverlap} from './collision.ts';
import {soundHorn} from './horn.ts';
import {random} from './scenario.ts';
import {createWorld,streamWorld,nearestRoad,nodeAt,atPort,portAngle,vector,junctionPath,poseOn,turnFor,ruleFor,approachDirection,WORLD_BUDGET,TRAFFIC_DENSITY,worldSpeedLimit,type WorldSettings,type WorldNode,type WorldCar,type Port} from './world.ts';
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const colors=['#cf6956','#d1b66a','#7a90ac','#d5dbd6','#526d65','#a98bb2'];
export function createWorldState(seed=42,settings:Partial<WorldSettings>={}):State {
  const state=createState(seed);state.world=createWorld(seed,settings);state.player={x:41,y:290,angle:0,wheel:0};state.traffic=[];
  state.speedLimit=worldSpeedLimit(state.world,state.player);state.rule=ruleFor(nodeAt(state.world,1),2);seedTraffic(state);return state;
}
function chooseExit(state:State,node:WorldNode,entry:Port,salt:number):Port {
  const exits=node.arms.filter(p=>p!==entry&&node.connections[p]!==undefined);
  return exits[Math.floor(random(node.seed^salt)()*exits.length)]??entry;
}
function seedTraffic(state:State){
  const world=state.world!;
  for(const node of world.nodes){if(node.spawned||Object.keys(node.connections).length<2||world.cars.length>=WORLD_BUDGET.cars)continue;
    // Spawn once per junction, including traffic beyond the visible area.
    node.spawned=true;const density=TRAFFIC_DENSITY[world.settings.trafficDensity];
    for(const entry of node.arms)for(let slot=0;slot<Math.ceil(.55*density);slot++){const rng=random(node.seed^Math.imul(entry+1,123)^Math.imul(slot+1,967));if(rng()>=Math.min(1,.55*density-slot)||world.cars.length>=WORLD_BUDGET.cars)continue;
      const road=world.roads.find(r=>r.id===node.connections[entry]);if(!road)continue;
      const forward=road.b===node.id,path=forward?road.forward:road.backward,length=pathMetrics(path).length,progress=Math.max(0,length-220-rng()*220-slot*240),pose=poseOn(path,progress);
      if(distance(pose,state.player)<160||world.cars.some(c=>distance(c,pose)<85))continue;
      const exit=chooseExit(state,node,entry,world.nextCarId);
      world.cars.push({id:world.nextCarId++,color:colors[Math.floor(rng()*colors.length)],style:Math.floor(rng()*3),direction:approachDirection(entry),route:turnFor(entry,exit),cruiseSpeed:kmhToSpeed(road.speedLimit)*(.78+rng()*.16),speed:45,path,mode:'road',nodeId:node.id,entry,exit,roadId:road.id,forward,progress,...pose});
    }
  }
}
export function worldLane(state:State){
  const world=state.world!,p=state.player;
  for(const node of world.nodes){if(distance(p,node)>250)continue;
    const rad=distance(p,node);
    if(node.kind==='roundabout'&&rad<72)return'off-road';
    if(node.kind==='roundabout'&&rad<=156){const polar=Math.atan2(p.x-node.x,-(p.y-node.y))*180/Math.PI;return Math.abs(angleDifference(p.angle,polar-90))>100?'wrong-lane':'ok';}
    if(node.kind!=='roundabout'&&rad<95)return'ok';
    for(const arm of node.arms){const v=vector(portAngle(node,arm)),dx=p.x-node.x,dy=p.y-node.y,along=dx*v.x+dy*v.y,side=dx*(-v.y)+dy*v.x;
      if(along>=0&&along<=240&&Math.abs(side)<=82){const outgoing=Math.abs(angleDifference(p.angle,portAngle(node,arm)))<90;return (outgoing?side<0:side>0)?'wrong-lane':'ok';}}
  }
  const nearest=nearestRoad(world,p);if(!nearest||nearest.projection.offset>82)return'off-road';
  const forward=Math.abs(angleDifference(p.angle,nearest.projection.angle))<90,lane=projectPath(forward?nearest.road.forward:nearest.road.backward,p);
  return lane.offset>45?'wrong-lane':'ok';
}
function updateContext(state:State){
  const world=state.world!,p=state.player,nearest=nearestRoad(world,p);
  const close=world.nodes.find(n=>distance(n,p)<245);
  if(close){
    if(world.enteredNodeId!==close.id){world.enteredNodeId=close.id;const a=Math.atan2(p.x-close.x,-(p.y-close.y))*180/Math.PI;world.entry=((Math.round(angleDifference(a,close.angle)/90)+4)%4) as Port;}
    world.activeNodeId=close.id;world.playerRoadId=null;
  }else if(nearest&&nearest.projection.offset<130){
    const road=nearest.road,forward=Math.abs(angleDifference(p.angle,nearest.projection.angle))<90;
    world.activeNodeId=forward?road.b:road.a;world.entry=forward?road.bp:road.ap;world.playerRoadId=road.id;
    if(world.enteredNodeId!==null){state.crossings++;state.notice='junction-cleared';state.noticeUntil=state.time+3;world.enteredNodeId=null;state.indicator=null;}
  }
  state.rule=ruleFor(nodeAt(world,world.activeNodeId),world.entry);
}
export function worldGuide(state:State):Point[]{
  const world=state.world!,node=nodeAt(world,world.activeNodeId),entry=world.entry;
  if(world.playerRoadId!==null){const road=world.roads.find(r=>r.id===world.playerRoadId)!;return road.b===node.id?road.forward:road.backward;}
  const relative=angleDifference(state.player.angle,portAngle(node,entry)+180);
  const turn=state.indicator??(node.kind==='roundabout'?'straight':relative< -25?'left':relative>25?'right':'straight');
  state.route=turn;
  const desired=((entry+(turn==='left'?1:turn==='right'?3:2))%4) as Port;
  let exit=node.arms.includes(desired)?desired:node.arms.find(p=>p!==entry)!;
  if(node.kind==='roundabout'&&state.indicator==='right'&&distance(state.player,node)<158){
    const polar=Math.atan2(state.player.x-node.x,-(state.player.y-node.y))*180/Math.PI;
    exit=[...node.arms].sort((a,b)=>((polar-portAngle(node,a)-20+720)%360)-((polar-portAngle(node,b)-20+720)%360))[0];
  }
  return junctionPath(node,entry,exit);
}
function yields(node:WorldNode,a:{entry:Port;exit:Port},b:{entry:Port;exit:Port}){
  if(a.entry===b.entry)return false;
  if(node.priority.includes(a.entry)!==node.priority.includes(b.entry))return !node.priority.includes(a.entry);
  if(node.kind==='roundabout')return false; // circulating ownership is handled before admission
  if((a.entry+3)%4===b.entry)return true;
  return (a.entry+2)%4===b.entry&&turnFor(a.entry,a.exit)==='left'&&turnFor(b.entry,b.exit)!=='left';
}
function playerIntent(state:State){const world=state.world!,node=nodeAt(world,world.activeNodeId),entry=world.entry;const turn=state.indicator??state.route;const desired=((entry+(turn==='left'?1:turn==='right'?3:2))%4) as Port;return{entry,exit:node.arms.includes(desired)?desired:node.arms.find(p=>p!==entry)!};}
function transition(state:State,car:WorldCar){
  const world=state.world!,node=nodeAt(world,car.nodeId),length=pathMetrics(car.path).length;
  if(car.progress<length)return;
  if(car.mode==='road'){
    if(car.exit===car.entry){car.exit=chooseExit(state,node,car.entry,car.id+state.frameNumber);if(car.exit===car.entry){car.progress=length-.01;car.speed=0;return;}car.route=turnFor(car.entry,car.exit);}
    car.mode='junction';car.roadId=null;car.path=junctionPath(node,car.entry,car.exit);car.progress-=length;world.owners[node.id]=car.id;
  }else{
    delete world.owners[node.id];const road=world.roads.find(r=>r.id===node.connections[car.exit]);
    if(!road){car.progress=length;car.speed=0;return;}
    const forward=road.a===node.id;car.mode='road';car.roadId=road.id;car.forward=forward;car.path=forward?road.forward:road.backward;car.progress-=length;car.nodeId=forward?road.b:road.a;car.entry=forward?road.bp:road.ap;
    const next=nodeAt(world,car.nodeId);car.exit=chooseExit(state,next,car.entry,car.id+state.frameNumber);car.direction=approachDirection(car.entry);car.route=turnFor(car.entry,car.exit);car.cruiseSpeed=kmhToSpeed(road.speedLimit)*(.8+(car.id%7)*.02);
  }
}
function moveTraffic(state:State,dt:number,far:boolean){
  const world=state.world!,cars=world.cars,intent=playerIntent(state);
  const approaches=new Map<number,Map<Port,WorldCar>>();
  for(const car of cars){if(car.mode!=='road'||pathMetrics(car.path).length-car.progress>=180)continue;let fronts=approaches.get(car.nodeId);if(!fronts){fronts=new Map();approaches.set(car.nodeId,fronts);}const ahead=fronts.get(car.entry);if(!ahead||pathMetrics(car.path).length-car.progress<pathMetrics(ahead.path).length-ahead.progress)fronts.set(car.entry,car);}
  for(const car of cars){if((distance(car,state.player)>=WORLD_BUDGET.near)!==far)continue;
    const node=nodeAt(world,car.nodeId);if(!node)continue;
    const length=pathMetrics(car.path).length,remaining=length-car.progress,old=car.speed;const road=world.roads.find(r=>r.id===car.roadId),roadSpeed=kmhToSpeed(road?.speedLimit??node.speedLimit);
    let target=car.mode==='junction'?38:Math.min(roadSpeed,car.cruiseSpeed!),block:number|null=null,reason:WorldCar['waitingFor']=null;
    if(car.mode==='road'){const junctionSpeed=car.route==='straight'&&node.kind!=='roundabout'?Math.min(70,kmhToSpeed(node.speedLimit)):38;target=Math.min(target,Math.sqrt(junctionSpeed*junctionSpeed+2*80*Math.max(0,remaining-90)));}
    if(car.mode==='road'&&road&&car.progress<90){const from=nodeAt(world,road.a===node.id?road.b:road.a);target=Math.min(target,kmhToSpeed(from.speedLimit));}
    let stop=Infinity;
    if(car.mode==='road'&&remaining<180){
      let owner=world.owners[node.id];const playerHere=world.activeNodeId===node.id&&distance(state.player,node)<(node.kind==='roundabout'?180:155);
      const fronts=[...(approaches.get(node.id)?.values()??[])].filter(other=>other.mode==='road');
      const contenders=fronts.filter(other=>other.entry!==car.entry);
      const superior=contenders.find(other=>yields(node,car,other));
      const playerApproaching=world.activeNodeId===node.id&&distance(state.player,node)<400&&yields(node,car,intent);
      // Circular right-hand waits use an explicit courtesy release after a pause.
      const cycle=fronts.some(front=>front.id===car.id)&&contenders.length>0&&fronts.every(other=>(other.stoppedFor??0)>2.5);
      const winner=cycle?fronts.sort((a,b)=>Number(node.priority.includes(b.entry))-Number(node.priority.includes(a.entry))||a.id-b.id)[0].id:null;
      if(owner===undefined&&winner!==null){owner=winner;world.owners[node.id]=winner;}
      if((owner!==undefined&&owner!==car.id)||playerHere||playerApproaching||(superior&&owner!==car.id)){
        block=playerHere||playerApproaching?-1:owner??superior?.id??winner;reason=playerHere?'safety':'priority';stop=Math.max(car.progress,length-9);
      }
    }
    const actors=cars;
    // Queues remain on their lane. A crossing hazard stops before contact.
    for(const other of actors){if(other.id===car.id||distance(car,other)>150)continue;
      if(other.mode===car.mode&&other.roadId===car.roadId&&other.nodeId===car.nodeId&&other.entry===car.entry&&(car.mode==='road'||other.exit===car.exit)&&other.progress>car.progress){const gap=other.progress-car.progress-61;if(gap<150){stop=Math.min(stop,car.progress+Math.max(0,gap));block=other.id;reason='queue';}}
      else {const next=poseOn(car.path,car.progress+Math.max(7,car.speed*.65));if(vehiclesOverlap(next,other,31,56)){stop=Math.min(stop,car.progress);block=other.id;reason='safety';}}
    }
    if(!far&&distance(car,state.player)<150){const next=poseOn(car.path,car.progress+Math.max(7,car.speed*.65));if(vehiclesOverlap(next,state.player,31,56)){stop=Math.min(stop,car.progress);block=-1;reason='safety';if(state.speed<8)warn(state,'priority-pressure',car.id,null,{wait:car.stoppedFor??0});}}
    if(Number.isFinite(stop))target=Math.min(target,Math.sqrt(Math.max(0,2*80*(stop-car.progress))));
    car.speed=target<old?Math.max(target,old-110*dt):Math.min(target,old+27*dt);
    const proposed=Math.min(car.progress+car.speed*dt,stop),pose=poseOn(car.path,proposed);
    // Live rectangle guard protects two cars updated in the same frame.
    if(actors.some(other=>other.id!==car.id&&distance(pose,other)<65&&vehiclesOverlap(pose,other,25,47)))car.speed=0;
    else{car.progress=proposed;Object.assign(car,pose);}
    car.blockedBy=block;car.waitingFor=reason;car.braking=car.speed<old-.1;car.stoppedFor=car.speed<1&&block!==null?(car.stoppedFor??0)+dt:0;
    car.indicator=car.route==='straight'?null:car.route;
    if(node.kind==='roundabout'&&car.mode==='junction')car.indicator=remaining<130?'right':null;
    if(!far&&(car.stoppedFor??0)>3&&state.time-(car.lastHornAt??-10)>7&&block!==null){const other=cars.find(c=>c.id===block);if(block===-1?!yields(node,car,intent):other&&!yields(node,car,other))soundHorn(state,car.id);}
    transition(state,car);
  }
}
export function stepWorld(state:State,dt:number,input:Input){
  if(state.phase!=='driving')return;
  const world=state.world!;state.time+=dt;state.frameNumber++;if(state.warning&&state.time>state.warningUntil)state.warning=null;
  updateContext(state);
  if(state.time>=world.streamAt){streamWorld(world,state.player);seedTraffic(state);world.streamAt=state.time+.5;for(const key of Object.keys(state.warningCooldown))if(state.warningCooldown[key]<state.time-4)delete state.warningCooldown[key];}
  const guide=worldGuide(state);
  const desired=input.brake?0:input.reverse?-kmhToSpeed(12):input.gas?(state.lane==='off-road'?42:MAX_DRIVING_SPEED):0;
  const braking=input.brake||(state.speed*desired<0);
  const change=(braking?125:desired===0?19:37)*dt;
  // Cross zero before changing gear; braking works in either direction.
  const target=braking?0:desired;
  state.speed+=Math.sign(target-state.speed)*Math.min(Math.abs(target-state.speed),change);
  const active=nodeAt(world,world.activeNodeId),assistance=active.kind==='roundabout'&&world.playerRoadId===null?state.assistance*2.4:state.assistance;
  const before={...state.player};stepDriving(state.player,state.speed,input.steer??0,guide,dt,state.speed<0?0:assistance);state.distance+=distance(before,state.player);
  state.speedLimit=worldSpeedLimit(world,state.player);state.lane=worldLane(state);state.offRoadTime=state.lane==='ok'?0:state.offRoadTime+dt;
  state.traffic=world.cars.filter(c=>distance(c,state.player)<WORLD_BUDGET.near);
  moveTraffic(state,dt,false);world.elapsedFar+=dt;if(world.elapsedFar>=WORLD_BUDGET.farStep){moveTraffic(state,world.elapsedFar,true);world.elapsedFar=0;}
  state.horns=state.horns.filter(h=>state.time-h.startedAt<1.15);
  const node=nodeAt(world,world.activeNodeId),intent=playerIntent(state),inside=distance(state.player,node)<(node.kind==='roundabout'?166:150);
  for(const car of world.cars.filter(c=>distance(c,state.player)<WORLD_BUDGET.near)){
    if(vehiclesOverlap(state.player,car)){fail(state,'collision',car.id,{x:(car.x+state.player.x)/2,y:(car.y+state.player.y)/2});return;}
    if(car.nodeId!==node.id)continue;
    const priority=car.mode==='junction'||yields(node,intent,car),gap=distance(car,state.player);
    const heading=vector(state.player.angle);
    const threat=[.4,.8,1.2,1.6].some(t=>distance({x:state.player.x+heading.x*state.speed*t,y:state.player.y+heading.y*state.speed*t},poseOn(car.path,car.progress+car.speed*t))<52);
    if(priority&&gap<160&&state.speed>8&&threat){warn(state,'yield-caution',car.id,null,{gap});if(inside&&gap<90&&car.speed>10&&state.speed>15){fail(state,'yield-violation',car.id,null,{gap});return;}}
  }
  if(state.offRoadTime>4)fail(state,state.lane==='wrong-lane'?'wrong-lane':'off-road');
}
