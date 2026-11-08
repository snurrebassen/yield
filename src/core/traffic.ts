import type {State,Actor,Traffic,Route,Point,JunctionRule,Decision} from './types.ts';
import {angleDifference,projectPath} from './physics.ts';
import {routePoints,lanePose,path,intersections,pathConflicts,cross,sub,type Conflict} from './geometry.ts';
import {heading,APPROACH_STOP,CLEARANCE} from './config.ts';
export function mustYield(a:Pick<Actor,'direction'|'route'>,b:Pick<Actor,'direction'|'route'>,rule:JunctionRule):boolean {
  if(a.direction===b.direction)return false;
  const av=a.direction==='north'||a.direction==='south',bv=b.direction==='north'||b.direction==='south';
  if(rule==='signed'&&av!==bv)return av;
  const diff=(heading[b.direction]-heading[a.direction]+360)%360;
  return diff===270 || (diff===180&&a.route==='left'&&b.route!=='left');
}
export function carActor(car:Traffic):Actor {
  if(car.distance===undefined)car.distance=car.direction==='west'?770-car.x:car.direction==='east'?car.x-190:car.direction==='south'?car.y-70:650-car.y;
  car.route??='straight';car.cruiseSpeed??=car.speed;
  return{id:car.id,direction:car.direction,route:car.route,distance:car.distance,speed:car.speed,cruiseSpeed:car.cruiseSpeed};
}
export function playerActor(s:State):Actor{return{id:-1,direction:'north',route:s.route,distance:projectPath(routePoints(s.route),s.player).distance,speed:s.speed,cruiseSpeed:88,pose:s.player};}
function perceivedPlayerRoutes(s:State):Route[] {
  // Drivers infer intentions from motion and signals.
  const angle=angleDifference(s.player.angle,0);
  if(Math.abs(angle)>18)return[s.route];
  if(s.indicator&&s.time-s.indicatorSince>=.6&&s.speed<=55)return[s.indicator];
  return s.player.y<285?['straight']:['straight','left','right'];
}
export function playerTrajectory(state:State):Point[] {
  const p={...state.player},points:Point[]=[{x:p.x,y:p.y}];
  const speed=Math.max(state.speed,25),yaw=speed/45*Math.tan(p.wheel)*180/Math.PI;
  // Predict from the actual free-moving car, including its current steering curvature.
  for(let i=1;i<=24;i++){const dt=.15,angle=(p.angle+yaw*dt/2)*Math.PI/180;p.x+=Math.sin(angle)*speed*dt;p.y-=Math.cos(angle)*speed*dt;p.angle+=yaw*dt;points.push({x:p.x,y:p.y});}
  return points;
}
export type Prediction={path:Point[];conflicts:Map<number,Conflict[]>;routes:Route[];observed:boolean};
export function predict(state:State):Prediction{return{path:playerTrajectory(state),conflicts:new Map(),routes:perceivedPlayerRoutes(state),observed:Math.abs(angleDifference(state.player.angle,0))>18||projectPath(routePoints(state.route),state.player).offset>25};}
export function trajectoryConflicts(state:State,car:Actor,prediction?:Prediction):Conflict[]{
  const cached=prediction?.conflicts.get(car.id);if(cached)return cached;
  const result=intersections(prediction?.path??playerTrajectory(state),path(car.direction,car.route));prediction?.conflicts.set(car.id,result);return result;
}
export function gapRisk(a:Actor,b:Actor,c:Conflict,margin=1.3):boolean {
  const da=c.a-a.distance,db=c.b-b.distance;
  if(da < -CLEARANCE||db < -CLEARANCE||da>360||db>360)return false;
  const ta=Math.max(0,da)/Math.max(25,a.speed),tb=Math.max(0,db)/Math.max(25,b.speed);
  const clearanceA=CLEARANCE/Math.max(25,a.speed),clearanceB=CLEARANCE/Math.max(25,b.speed);
  return ta<=tb+clearanceB+margin && tb<=ta+clearanceA+margin;
}
export function targetFor(car:Actor,actors:Actor[],state:State,prediction?:Prediction):Decision {
  let target=car.cruiseSpeed,stop=Infinity,reason:Traffic['waitingFor']=null,blockedBy:number|null=null;
  for(const other of actors){
    if(other.id===car.id)continue;
    const mine=lanePose(car.direction,car.route,car.distance),theirs=other.pose??lanePose(other.direction,other.route,other.distance);
    const angle=mine.angle*Math.PI/180,forward={x:Math.sin(angle),y:-Math.cos(angle)},delta=sub(theirs,mine),along=delta.x*forward.x+delta.y*forward.y,lateral=Math.abs(cross(delta,forward));
    const aligned=Math.cos((mine.angle-theirs.angle)*Math.PI/180)>.8;
    if(along>0&&along<95&&lateral<25&&aligned){
      const room=Math.max(0,along-56);const safe=Math.min(other.speed+room*.7,Math.sqrt(2*90*room));
      if(safe<target){target=safe;reason='queue';blockedBy=other.id;stop=Math.min(stop,car.distance+room);}
    }
    const routes=other.id===-1?(prediction?.routes??perceivedPlayerRoutes(state)):[other.route];
    for(const route of routes){
      const observed=other.id===-1&&(prediction?.observed??(Math.abs(angleDifference(state.player.angle,0))>18||projectPath(routePoints(state.route),state.player).offset>25));
      const perceived={...other,route,distance:observed?0:other.distance};
      if(!mustYield(car,perceived,state.rule))continue;
      const conflicts=observed?trajectoryConflicts(state,car,prediction).map(c=>({point:c.point,a:c.b,b:c.a})):pathConflicts(car.direction,car.route,other.direction,route);
      for(const c of conflicts){
        // Once already through the crossing, do not brake for traffic behind it.
        if(c.a-car.distance < -22 || !gapRisk(car,perceived,c,1.6))continue;
        const line=Math.min(APPROACH_STOP,c.a-60);
        if(car.distance>line+8)continue; // committed vehicles clear the junction
        const room=Math.max(0,line-car.distance);
        const safe=room<1?0:Math.sqrt(2*75*room);
        if(safe<target||room<80){target=Math.min(target,safe);stop=Math.min(stop,line);reason='priority';blockedBy=other.id;}
      }
    }
    // Emergency braking reacts to actual proximity, independently of signals or priority.
    if(!aligned && Math.hypot(delta.x,delta.y)<90 && along>0 && lateral<42){target=0;stop=Math.min(stop,car.distance+Math.max(0,along-50));reason='safety';blockedBy=other.id;}
  }
  return{speed:target,stop,reason,blockedBy};
}
