import type {State,EventCode} from '../core/types.ts';
import {cameraPoint} from './camera.ts';
export const shortMessages:Record<EventCode,string>={
  'yield-caution':'Liten luke – senk farten',
  'priority-pressure':'Gi den andre mer plass',
  'yield-violation':'Vikepliktsbrudd',
  collision:'Kollisjon!',
  'off-road':'Utenfor veien',
  'wrong-lane':'Feil kjørefelt',
};
export function carFeedback(state:State):{text:string;tone:'warning'|'failure'|'info'}|null {
  if(state.failure)return{text:shortMessages[state.failure.event.code],tone:'failure'};
  if(state.warning)return{text:shortMessages[state.warning.code],tone:'warning'};
  if(state.lane==='wrong-lane')return{text:'Hold til høyre',tone:'warning'};
  if(state.lane==='off-road')return{text:'Tilbake på veien',tone:'warning'};
  if(state.recovery)return{text:'Bilene gir hverandre plass',tone:'info'};
  return null;
}
export function feedbackPosition(state:State,follow:boolean){
  const car=state.world&&!follow?{x:480,y:360}:cameraPoint(state.player,state.player,follow);
  return{x:Math.max(120,Math.min(840,car.x)),y:car.y>85?Math.max(35,Math.min(650,car.y-62)):Math.min(650,car.y+65)};
}
