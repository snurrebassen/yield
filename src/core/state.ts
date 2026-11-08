import type {State,Route,Indicator,JunctionRule} from './types.ts';
import {angleDifference} from './physics.ts';
import {random,makeTraffic} from './scenario.ts';
export function createState(seed:number=42):State {
  const rule:JunctionRule=random(seed^0xa511e9b3)()<.38?'signed':'unsigned';
  return{phase:'ready',rule,seed,time:0,distance:0,speed:0,route:'straight',player:{x:521,y:650,angle:0,wheel:0},assistance:.6,lane:'ok',offRoadTime:0,indicator:null,indicatorSince:0,indicatorUsed:null,traffic:makeTraffic(rule,seed),reason:null,slowed:false,crossings:0,notice:null,noticeUntil:0,events:[],eventSequence:0,warning:null,warningUntil:0,warningCooldown:{},failure:null,frameNumber:0,recovery:null,recoveryCheckAt:0,horns:[],hornSequence:0,playerHornAt:-10};
}
// Choose assistance from observed motion and the indicator, never a destination.
export function guideRoute(state:State):Route {
  const angle=angleDifference(state.player.angle,0);
  if(state.player.y<510&&Math.abs(angle)>18)return angle<0?'left':'right';
  if(state.indicator&&state.player.y<550)return state.indicator;
  return 'straight';
}
export function nextJunction(state:State,exit:Route|'back'){
  const p=state.player,targetHeading=exit==='left'?-90:exit==='right'?90:exit==='back'?180:0;
  const offset=exit==='left'?319-p.y:exit==='right'?p.y-401:exit==='back'?439-p.x:p.x-521;
  const next=createState((Math.imul(state.seed,1664525)+1013904223)>>>0);
  next.phase='driving';next.crossings=state.crossings+1;next.speed=state.speed;next.assistance=state.assistance;
  next.player={x:521+offset,y:650,angle:angleDifference(p.angle,targetHeading),wheel:p.wheel};
  next.notice=state.route!=='straight'&&state.indicatorUsed!==state.route?'signal-missing':'junction-cleared';next.noticeUntil=3;
  next.events=state.events;next.eventSequence=state.eventSequence;next.frameNumber=state.frameNumber;next.hornSequence=state.hornSequence;
  Object.assign(state,next);
}
export function toggleIndicator(state:State,side:Exclude<Indicator,null>){if(state.phase==='failed')return;state.indicator=state.indicator===side?null:side;state.indicatorSince=state.time;}
