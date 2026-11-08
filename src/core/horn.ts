import type {State,Decision} from './types.ts';
import {carActor,playerActor,mustYield} from './traffic.ts';
export function soundHorn(state:State,actorId=-1):boolean {
  if(state.phase!=='driving')return false;
  const car=actorId===-1?null:state.traffic.find(car=>car.id===actorId);
  if(actorId!==-1&&!car)return false;
  const previous=car?.lastHornAt??(actorId===-1?state.playerHornAt:-10);
  if(state.time-previous<1)return false;
  if(car)car.lastHornAt=state.time;else{state.playerHornAt=state.time;state.recoveryCheckAt=state.time;}
  state.horns.push({id:++state.hornSequence,actorId,startedAt:state.time});
  if(state.horns.length>16)state.horns.splice(0,state.horns.length-16);
  return true;
}
export function updateHorns(state:State,decisions:Decision[]) {
  state.horns=state.horns.filter(pulse=>state.time-pulse.startedAt<1.15);
  state.traffic.forEach((car,i)=>{
    if((car.stoppedFor??0)<3||state.time-(car.lastHornAt??-10)<6+(car.id%3)||car.reversing)return;
    const blockerId=decisions[i].blockedBy,other=blockerId===-1?playerActor(state):state.traffic.find(other=>other.id===blockerId);
    if(!other)return;
    const actor=carActor(car),blocking=blockerId===-1?other as ReturnType<typeof playerActor>:carActor(other as typeof car);
    const expectsPriority=(actor.direction!==blocking.direction&&!mustYield(actor,blocking,state.rule))||state.recovery?.winnerId===car.id;
    if(expectsPriority)soundHorn(state,car.id);
  });
}
