import type {State,Actor,Decision,Recovery,Traffic} from './types.ts';
import {lanePose} from './geometry.ts';
import {vehiclesOverlap} from './collision.ts';
import {mustYield} from './traffic.ts';
import {APPROACH_STOP} from './config.ts';
const REVERSE_SPEED=10,CLEAR_SPEED=26,WAIT_SECONDS=2.5;

function cycles(state:State,decisions:Decision[]):number[][] {
  const eligible=new Map<number,number>();
  state.traffic.forEach((car,i)=>{if(car.speed<1&&(car.stoppedFor??0)>=WAIT_SECONDS&&decisions[i].blockedBy!==null&&decisions[i].blockedBy!==-1)eligible.set(car.id,decisions[i].blockedBy!);});
  const found:number[][]=[],visited=new Set<number>();
  for(const start of [...eligible.keys()].sort((a,b)=>a-b)){
    const chain:number[]=[];let id=start;
    while(eligible.has(id)&&!visited.has(id)){
      const at=chain.indexOf(id);if(at>=0){found.push(chain.slice(at));break;}
      chain.push(id);id=eligible.get(id)!;
    }
    chain.forEach(id=>visited.add(id));
  }
  return found;
}
function safePositions(state:State,positions:Map<number,ReturnType<typeof lanePose>>,clearanceId:number|null=null):boolean {
  for(let i=0;i<state.traffic.length;i++){
    const a=state.traffic[i],ap=positions.get(a.id)??a;
    if(positions.has(a.id)&&vehiclesOverlap(ap,state.player,a.id===clearanceId?25:23,a.id===clearanceId?47:43))return false;
    for(let j=i+1;j<state.traffic.length;j++){
      const b=state.traffic[j];if(!positions.has(a.id)&&!positions.has(b.id))continue;
      if(vehiclesOverlap(ap,positions.get(b.id)??b,a.id===clearanceId||b.id===clearanceId?25:23,a.id===clearanceId||b.id===clearanceId?47:43))return false;
    }
  }
  return true;
}
function clearanceDistance(car:Actor):number {
  for(let d=car.distance+70;d<=car.distance+260;d+=4){const p=lanePose(car.direction,car.route,d);if(p.x<365||p.x>595||p.y<245||p.y>475)return d;}
  return car.distance+260;
}
function planFor(state:State,cycle:number[],actors:Actor[]):Recovery|null {
  const members=actors.filter(car=>cycle.includes(car.id));
  // Prefer the vehicle with the fewest legal yielding obligations. Physical safety
  // can still require another already-committed car to clear first by agreement.
  const obligations=(car:Actor)=>members.filter(other=>other.id!==car.id&&mustYield(car,other,state.rule)).length;
  members.sort((a,b)=>obligations(a)-obligations(b)||b.distance-a.distance||a.id-b.id);
  for(const winner of members){
    const backing=new Set(cycle.filter(id=>id!==winner.id));
    // Followers make room too; backing the first car into its own queue is forbidden.
    let changed=true;
    while(changed){changed=false;for(const leaderId of [...backing]){
      const leader=state.traffic.find(car=>car.id===leaderId)!;
      for(const car of state.traffic){if(car.id===winner.id||backing.has(car.id)||car.speed>=2)continue;
        if(car.direction===leader.direction&&car.distance!<leader.distance!&&leader.distance!-car.distance!<155){backing.add(car.id);changed=true;}
      }
    }}
    const clearDistance=clearanceDistance(winner);
    for(let back=0;back<=80;back+=8){
      let safe=true;
      for(let moved=0;moved<=back;moved+=2){
        const poses=new Map<number,ReturnType<typeof lanePose>>();
        for(const id of backing){const car=state.traffic.find(car=>car.id===id)!;poses.set(id,lanePose(car.direction,car.route!,car.distance!-moved));}
        if(!safePositions(state,poses)){safe=false;break;}
      }
      if(!safe)break; // more backing cannot fix a blocked rear swept path
      const parked=new Map<number,ReturnType<typeof lanePose>>();
      for(const id of backing){const car=state.traffic.find(car=>car.id===id)!;parked.set(id,lanePose(car.direction,car.route!,car.distance!-back));}
      for(let d=winner.distance;d<=clearDistance;d+=2){
        parked.set(winner.id,lanePose(winner.direction,winner.route,d));if(!safePositions(state,parked,winner.id)){safe=false;break;}
      }
      if(!safe)continue;
      const targets:Record<number,number>={};for(const id of backing)targets[id]=state.traffic.find(car=>car.id===id)!.distance!-back;
      return{winnerId:winner.id,holdIds:cycle,backingIds:[...backing],targets,clearDistance,phase:back?'backing':'clearing',startedAt:state.time,lastProgressAt:state.time,lastProgress:back?-[...backing].reduce((sum,id)=>sum+state.traffic.find(car=>car.id===id)!.distance!,0):winner.distance};
    }
  }
  return null;
}
export function coordinateRecovery(state:State,actors:Actor[],decisions:Decision[]) {
  if(!state.recovery&&state.time>=state.recoveryCheckAt){
    const groups=cycles(state,decisions);if(groups.length){state.recoveryCheckAt=state.time+1;for(const group of groups){const plan=planFor(state,group,actors);if(plan){state.recovery=plan;break;}}}
  }
  const recovery=state.recovery;if(!recovery)return;
  const winner=state.traffic.find(car=>car.id===recovery.winnerId);
  if(!winner||winner.distance!>=recovery.clearDistance){state.recovery=null;state.recoveryCheckAt=state.time+1;return;}
  const backed=recovery.backingIds.every(id=>state.traffic.find(car=>car.id===id)!.distance!<=recovery.targets[id]+.5);
  if(recovery.phase==='backing'&&backed){recovery.phase='clearing';recovery.lastProgress=0;recovery.lastProgressAt=state.time;}
  const progress=recovery.phase==='clearing'?winner.distance!:-recovery.backingIds.reduce((sum,id)=>sum+state.traffic.find(car=>car.id===id)!.distance!,0);
  if(progress>recovery.lastProgress+.25){recovery.lastProgress=progress;recovery.lastProgressAt=state.time;}
  if(state.time-recovery.lastProgressAt>8){state.recovery=null;state.recoveryCheckAt=state.time+1;return;}
  state.traffic.forEach((car,i)=>{
    const decision=decisions[i];
    if(recovery.backingIds.includes(car.id)){
      if(recovery.phase==='backing'&&car.distance!>recovery.targets[car.id]+.5){Object.assign(decision,{speed:-REVERSE_SPEED,stop:recovery.targets[car.id],reason:'safety',blockedBy:recovery.winnerId,recovery:'backing'});}
      else Object.assign(decision,{speed:0,stop:car.distance,reason:'priority',blockedBy:recovery.winnerId,recovery:'waiting'});
    }else if(car.id===winner.id){
      if(recovery.phase==='backing')Object.assign(decision,{speed:0,stop:car.distance,reason:'priority',blockedBy:recovery.backingIds[0]??null,recovery:'waiting'});
      else if(decision.blockedBy!==-1)Object.assign(decision,{speed:CLEAR_SPEED,stop:recovery.clearDistance,reason:null,blockedBy:null,recovery:'clearing'});
    }else if(car.distance!<APPROACH_STOP+8){
      const room=Math.max(0,APPROACH_STOP-car.distance!);decision.speed=Math.min(decision.speed,Math.sqrt(2*75*room));decision.stop=Math.min(decision.stop,APPROACH_STOP);decision.reason='priority';decision.blockedBy=winner.id;
    }
  });
}

// Recheck actual, simultaneous motion every step: a plan never authorizes overlap
// with another vehicle or the player if the situation changes while backing.
export function guardRecoveryMotion(state:State,previous:Traffic[],decisions:Decision[]) {
  if(!state.recovery)return;
  const reject=new Map<number,number>();
  for(let i=0;i<state.traffic.length;i++){
    const a=state.traffic[i];
    if(vehiclesOverlap(a,state.player)||(vehiclesOverlap(a,state.player,25,47)&&Math.hypot(a.x-state.player.x,a.y-state.player.y)<Math.hypot(previous[i].x-state.player.x,previous[i].y-state.player.y)-1e-6))reject.set(i,-1);
    for(let j=i+1;j<state.traffic.length;j++){const b=state.traffic[j],closing=Math.hypot(a.x-b.x,a.y-b.y)<Math.hypot(previous[i].x-previous[j].x,previous[i].y-previous[j].y)-1e-6;if(vehiclesOverlap(a,b)||(closing&&vehiclesOverlap(a,b,25,47))){reject.set(i,b.id);reject.set(j,a.id);}}
  }
  for(const [i,blocker] of reject){const car=state.traffic[i],old=previous[i];car.distance=old.distance;Object.assign(car,lanePose(car.direction,car.route!,car.distance!));car.speed=0;car.braking=true;car.reversing=false;decisions[i].reason='safety';decisions[i].blockedBy=blocker;}
}
