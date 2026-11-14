import type {State,EventCode,TrafficEvent,Point,SceneFrame} from './types.ts';
import {EVENT_LIMIT} from './config.ts';
export function captureFrame(state:State):SceneFrame {
  return{frame:state.frameNumber,time:state.time,seed:state.seed,rule:state.rule,player:{...state.player},speed:state.speed,speedLimit:state.speedLimit,traffic:state.traffic.map(car=>({...car}))};
}
function record(state:State,code:EventCode,severity:TrafficEvent['severity'],actorIds:number[],point:Point|null,facts:Record<string,number>):TrafficEvent {
  const event:TrafficEvent={id:++state.eventSequence,frame:state.frameNumber,time:state.time,seed:state.seed,severity,code,actorIds:[...actorIds],point:point?{...point}:null,facts:{...facts}};
  state.events.push(event);if(state.events.length>EVENT_LIMIT)state.events.splice(0,state.events.length-EVENT_LIMIT);
  return event;
}
export function warn(state:State,code:EventCode,otherId:number|null,point:Point|null=null,facts:Record<string,number>={}) {
  if(state.phase==='failed')return;
  if(state.warning&&state.time>state.warningUntil)state.warning=null;
  const key=code+':'+(otherId??'none'),ids=otherId===null?[-1]:[-1,otherId];
  if(state.warning?.code===code&&state.warning.actorIds[1]===otherId){state.warningUntil=state.time+1.5;return;}
  if((state.warningCooldown[key]??-Infinity)>state.time)return;
  state.warning=record(state,code,'warning',ids,point,facts);state.warningUntil=state.time+1.5;state.warningCooldown[key]=state.time+3;
}
export function fail(state:State,code:EventCode,otherId:number|null=null,point:Point|null=null,facts:Record<string,number>={}) {
  if(state.phase==='failed')return;
  const event=record(state,code,'failure',otherId===null?[-1]:[-1,otherId],point,facts);
  state.reason=code;state.phase='failed';state.warning=null;state.failure={event,scene:captureFrame(state)};
}
export function setPaused(state:State,paused:boolean) {
  if(paused&&state.phase==='driving')state.phase='paused';
  else if(!paused&&state.phase==='paused')state.phase='driving';
}
