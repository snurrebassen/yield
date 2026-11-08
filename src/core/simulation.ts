import type {State,Input,Route} from './types.ts';
import {angleDifference,laneStatus,projectPath,stepDriving} from './physics.ts';
import {routePoints,lanePose,routeLength} from './geometry.ts';
import {guideRoute,nextJunction} from './state.ts';
import {carActor,playerActor,targetFor,predict} from './traffic.ts';
import {evaluateTraffic} from './evaluation.ts';
import {fail} from './events.ts';
import {FIXED_STEP} from './config.ts';
import {coordinateRecovery,guardRecoveryMotion} from './recovery.ts';
import {updateHorns} from './horn.ts';
function integrate(state:State,dt:number,input:Input) {
  if(state.phase!=='driving')return;
  state.time+=dt;state.frameNumber++;
  if(state.warning&&state.time>state.warningUntil)state.warning=null;
  const offRoad=laneStatus(state.player)==='off-road';
  state.speed=Math.max(0,Math.min(offRoad?42:88,state.speed+(input.brake?-125:input.gas?37:-19)*dt));
  stepDriving(state.player,state.speed,input.steer??0,routePoints(guideRoute(state)),dt,state.assistance);
  state.lane=laneStatus(state.player);
  state.offRoadTime=state.lane==='off-road'?state.offRoadTime+dt:0;
  const angle=angleDifference(state.player.angle,0);
  if(state.player.y<510){if(angle < -18)state.route='left';else if(angle>18)state.route='right';else if(state.player.y<278)state.route='straight';}
  state.distance=projectPath(routePoints(state.route),state.player).distance;
  if(state.player.y<555&&state.player.y>450&&state.speed<35)state.slowed=true;
  if(state.indicator===state.route&&Math.abs(angle)>20)state.indicatorUsed=state.indicator;
  const player=playerActor(state),before=state.traffic.map(carActor),actors=[player,...before],prediction=predict(state);
  const decisions=before.map(car=>targetFor(car,actors,state,prediction));
  coordinateRecovery(state,before,decisions);
  const previous=state.recovery?state.traffic.map(car=>({...car})):[];
  state.traffic.forEach((car,i)=>{
    const decision=decisions[i],old=car.speed;
    if(decision.recovery==='backing'){
      car.speed=Math.max(decision.speed,Math.min(0,old)-25*dt);
      car.distance=Math.max(decision.stop,car.distance!+car.speed*dt);
      if(car.distance<=decision.stop+.001)car.speed=0;
    }else{
      car.speed=decision.speed<old?Math.max(decision.speed,old-95*dt):Math.min(decision.speed,Math.max(0,old)+30*dt);
      const desired=car.distance!+car.speed*dt;car.distance=Math.min(desired,decision.stop);
      if(car.distance<desired)car.speed=0;
    }
    car.reversing=car.speed<-.1;
    car.braking=car.speed<old-.1||(car.speed<1&&!!decision.reason);car.waitingFor=decision.reason;
    Object.assign(car,lanePose(car.direction,car.route!,car.distance));
    car.indicator=car.route==='straight'||car.distance<40||car.distance>routeLength(car.route!)-230?null:car.route;
  });
  guardRecoveryMotion(state,previous,decisions);
  state.traffic.forEach((car,i)=>{car.blockedBy=decisions[i].blockedBy;car.stoppedFor=Math.abs(car.speed)<1&&decisions[i].blockedBy!==null?(car.stoppedFor??0)+dt:0;});
  updateHorns(state,decisions);
  evaluateTraffic(state,player,before,state.traffic.map(carActor),decisions,prediction,dt);
  if(state.failure)return;
  if(state.offRoadTime>4){fail(state,'off-road');return;}
  const p=state.player;
  if(state.indicator&&Math.abs(angleDifference(p.angle,state.indicator==='left'?-90:90))<14&&((p.x<370)||(p.x>620)))state.indicator=null;
  const exit:Route|'back'|null=p.y<80&&p.x>398&&p.x<562?'straight':p.x<80&&p.y>278&&p.y<442?'left':p.x>880&&p.y>278&&p.y<442?'right':p.y>790&&p.x>398&&p.x<562?'back':null;
  if(exit){
    const targetHeading=exit==='left'?-90:exit==='right'?90:exit==='back'?180:0;
    if(state.lane!=='ok'||Math.abs(angleDifference(p.angle,targetHeading))>40)fail(state,'wrong-lane');
    else nextJunction(state,exit);
  }
}
export function stepSimulation(state:State,input:Input){integrate(state,FIXED_STEP,input);}
// Compatibility for callers advancing explicit short durations. Renderers should use the clock.
export function tick(state:State,dt:number,input:Input){
  if(!Number.isFinite(dt)||dt<=0||state.phase!=='driving')return;
  let remaining=Math.min(dt,.25);
  while(remaining>1e-9&&state.phase==='driving'){const step=Math.min(FIXED_STEP,remaining);integrate(state,step,input);remaining-=step;}
}
