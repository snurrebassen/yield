import type {Actor,Decision,State} from './types.ts';
import {gapRisk,mustYield,trajectoryConflicts,type Prediction} from './traffic.ts';
import {fail,warn} from './events.ts';
import {vehiclesOverlap} from './collision.ts';
export function evaluateTraffic(state:State,player:Actor,before:Actor[],after:Actor[],decisions:Decision[],prediction:Prediction,dt:number) {
  // Every actor is already at the same simulation instant before evidence is evaluated.
  for(const car of state.traffic){
    if(vehiclesOverlap(state.player,car)){
      fail(state,'collision',car.id,{x:(state.player.x+car.x)/2,y:(state.player.y+car.y)/2},{playerSpeed:state.speed,otherSpeed:car.speed});return;
    }
  }
  const entering=state.player.y<465&&state.player.y>255&&state.player.x>370&&state.player.x<590;
  for(let i=0;i<after.length;i++){
    const other=after[i];if(!mustYield(player,other,state.rule))continue;
    const decision=decisions[i],deceleration=(before[i].speed-other.speed)/dt;
    const reactsToPlayer=decision.blockedBy===-1&&decision.reason==='safety'&&before[i].speed>12;
    const conflicts=trajectoryConflicts(state,other,prediction);
    for(const conflict of conflicts){
      const distance=conflict.a,theirDistance=conflict.b-other.distance;
      if(distance<0||distance>220||theirDistance < -46||theirDistance>250)continue;
      const ourTime=distance/Math.max(1,state.speed),theirTime=theirDistance/Math.max(1,other.speed);
      const imminent=state.speed>10&&ourTime<.8&&theirTime<1.2&&gapRisk({...player,distance:0},other,conflict,.1);
      if(entering&&(imminent||(reactsToPlayer&&deceleration>65&&gapRisk({...player,distance:0},other,conflict,.6)))){
        fail(state,'yield-violation',other.id,conflict.point,{timeToConflict:ourTime,otherTimeToConflict:theirTime,otherDeceleration:Math.max(0,deceleration),otherSpeedBefore:before[i].speed,otherSpeedAfter:other.speed});return;
      }
      if(state.speed>12&&state.player.y<565&&ourTime<4&&gapRisk({...player,distance:0},other,conflict,1.4)){
        warn(state,reactsToPlayer?'priority-pressure':'yield-caution',other.id,conflict.point,{timeToConflict:ourTime,otherDeceleration:Math.max(0,deceleration)});
      }
    }
    // A cautious reaction outside the junction is feedback, not an automatic violation.
    if(reactsToPlayer&&!entering&&state.speed>2)warn(state,'priority-pressure',other.id,null,{otherDeceleration:Math.max(0,deceleration)});
  }
}
