export type Route = 'straight' | 'left' | 'right';
export type Indicator = 'left' | 'right' | null;
export type LessonId = 'right' | 'left' | 'signed' | 'priority';
export type Phase = 'ready' | 'driving' | 'paused' | 'success' | 'failed';
export type Point = { x: number; y: number };
export type Direction = 'north' | 'east' | 'south' | 'west';
export type Traffic = {
  id: number; x: number; y: number; angle: number; speed: number;
  color: string; style: number; direction: Direction;
  route?: Route; distance?: number; cruiseSpeed?: number; indicator?: Indicator;
  braking?: boolean; waitingFor?: 'priority' | 'queue' | 'safety' | null;
};
export type Lesson = { id: LessonId; title: string; short: string; description: string; rule: string; source: string; preferred: Route; required?: Route };
export const lessons: Lesson[] = [
  { id: 'right', title: 'Trafikk fra høyre', short: 'Høyreregelen', description: 'Kjør gjennom krysset. Se etter trafikk fra høyre. Biler fra venstre må vike for deg når rutene deres møtes.', rule: 'Uten skilt eller lyssignaler gjelder høyreregelen for alle. Du viker for trafikk fra høyre; trafikk fra venstre viker for deg når dere kan komme i konflikt.', source: 'Trafikkreglene § 7 nr. 1–2', preferred: 'straight' },
  { id: 'left', title: 'Sving til venstre', short: 'Møtende trafikk', description: 'Ta til venstre i krysset. Gi tegn med Q, og slipp fram møtende trafikk før du svinger.', rule: 'Når du svinger til venstre og får møtende kjøretøy på din høyre side, har du vikeplikt. Vis tydelig at du vil vike. Blinklys varsler; det gir ikke forkjørsrett.', source: 'Trafikkreglene § 7 og § 14', preferred: 'left', required: 'left' },
  { id: 'signed', title: 'Skiltet vikeplikt', short: 'Se begge veier', description: 'Kjør rett fram. Se etter trafikk fra begge sider, og vike før vikelinjen. Blinklys opphever ikke vikeplikten.', rule: 'Vikepliktskiltet betyr at du skal vike for kjørende i begge retninger på den kryssende veien. Det er ikke krav om full stans hvis du kan kjøre uten å hindre eller forstyrre andre.', source: 'Skiltforskriften, skilt 202 · Trafikkreglene § 7 nr. 1', preferred: 'straight', required: 'straight' },
  { id: 'priority', title: 'De andre viker', short: 'Din tur til å kjøre', description: 'Kjør gjennom krysset. Bilen fra venstre skal vike for deg. Den møtende bilen som svinger til venstre, skal også slippe deg fram.', rule: 'Høyreregelen gjelder også de andre bilene. Møtende som svinger til venstre, må vike når ruten deres krysser din. Gi tydelig tegn før en sving, og følg med selv om andre har vikeplikt.', source: 'Trafikkreglene § 7 og § 14', preferred: 'straight' },
];
export function random(seed: number) { let value = seed >>> 0; return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296; }; }
const colors = ['#cf6956', '#d1b66a', '#7a90ac', '#d5dbd6', '#526d65', '#a98bb2'];
const heading: Record<Direction, number> = {north:0,east:90,south:180,west:270};
const APPROACH_STOP = 176;
const ROUTE_LOCK = 175;
const CLEARANCE = 46;
export function makeTraffic(lesson: LessonId, seed: number): Traffic[] {
  const rng = random(seed);
  const specs: [Direction, number, number, Route][] = lesson === 'left'
    ? [['south',10,61,'straight'],['south',-255,65,'straight']]
    : lesson === 'signed' ? [['west',800,62,'straight'],['east',125,57,'straight'],['west',1105,66,'straight']]
    : lesson === 'priority' ? [['east',220,58,'straight'],['south',88,56,'left'],['east',-20,60,'right']]
    : [['west',800,62,'straight'],['east',200,58,'straight'],['west',1090,68,'straight']];
  return specs.map(([direction,pos,speed,route],id) => {
    const distance=direction==='south'?pos-70:direction==='west'?770-pos:direction==='east'?pos-190:650-pos;
    const cruiseSpeed=speed+rng()*3;
    return {id,direction,route,distance,cruiseSpeed,speed:cruiseSpeed,...lanePose(direction,route,distance),color:colors[Math.floor(rng()*colors.length)],style:Math.floor(rng()*3),indicator:null,braking:false,waitingFor:null};
  });
}
const routeCache=new Map<Route,Point[]>();
export function routePoints(route:Route):Point[] {
  const cached=routeCache.get(route);if(cached)return cached;
  let points:Point[];
  if(route==='straight')points=[{x:521,y:650},{x:521,y:65}];
  else {
    points=[{x:521,y:650},{x:521,y:route==='left'?425:487}];
    const start=points[1],control={x:521,y:route==='left'?319:401},end={x:route==='left'?395:615,y:route==='left'?319:401};
    for(let i=1;i<=40;i++){
      const t=i/40,u=1-t;
      // Opposing left turns pass in front of each other, with separate swept paths.
      if(route==='left')points.push({x:u*u*u*start.x+3*u*u*t*521+3*u*t*t*405+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*415+3*u*t*t*319+t*t*t*end.y});
      else points.push({x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y});
    }
    points.push({x:route==='left'?45:915,y:end.y});
  }
  routeCache.set(route,points);return points;
}
export function routeLength(route:Route):number {const p=routePoints(route);return p.slice(1).reduce((s,v,i)=>s+Math.hypot(v.x-p[i].x,v.y-p[i].y),0);}
export function poseAt(route:Route,distance:number):Point & {angle:number} {
  const points=routePoints(route);let remaining=distance;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);
    if(remaining<=len||i===points.length-1){const t=remaining/len;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI};}
    remaining-=len;
  }
  return {x:521,y:650,angle:0};
}
function rotate(p:Point,direction:Direction):Point {
  const a=heading[direction]*Math.PI/180,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));
  return{x:480+(p.x-480)*c-(p.y-360)*s,y:360+(p.x-480)*s+(p.y-360)*c};
}
export function lanePose(direction:Direction,route:Route,distance:number) {const p=poseAt(route,distance);return{...rotate(p,direction),angle:p.angle+heading[direction]};}
const pathCache=new Map<string,Point[]>();
function path(direction:Direction,route:Route){const key=direction+route;let p=pathCache.get(key);if(!p){p=routePoints(route).map(p=>rotate(p,direction));pathCache.set(key,p);}return p;}
export type Conflict={point:Point; a:number; b:number};
const conflictCache=new Map<string,Conflict[]>();
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
export function pathConflicts(ad:Direction,ar:Route,bd:Direction,br:Route):Conflict[] {
  const key=[ad,ar,bd,br].join(':');const cached=conflictCache.get(key);if(cached)return cached;
  const ap=path(ad,ar),bp=path(bd,br),result:Conflict[]=[];let al=0;
  for(let i=1;i<ap.length;i++){
    const p=ap[i-1],r=sub(ap[i],p),rl=Math.hypot(r.x,r.y);let bl=0;
    for(let j=1;j<bp.length;j++){
      const q=bp[j-1],s=sub(bp[j],q),sl=Math.hypot(s.x,s.y),qp=sub(q,p),den=cross(r,s);
      const add=(t:number,u:number)=>{if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8)result.push({point:{x:p.x+t*r.x,y:p.y+t*r.y},a:al+t*rl,b:bl+u*sl});};
      if(Math.abs(den)>1e-8)add(cross(qp,s)/den,cross(qp,r)/den);
      else if(Math.abs(cross(qp,r))<1e-8){
        // Include both ends of shared lane sections: turns may merge rather than cross.
        const t0=(qp.x*r.x+qp.y*r.y)/(rl*rl),t1=t0+(s.x*r.x+s.y*r.y)/(rl*rl);
        for(const t of [Math.max(0,Math.min(t0,t1)),Math.min(1,Math.max(t0,t1))]){const v={x:p.x+t*r.x-q.x,y:p.y+t*r.y-q.y};add(t,(v.x*s.x+v.y*s.y)/(sl*sl));}
      }
      bl+=sl;
    }
    al+=rl;
  }
  const unique=result.filter((v,i)=>!result.slice(0,i).some(o=>Math.abs(o.a-v.a)<1&&Math.abs(o.b-v.b)<1));conflictCache.set(key,unique);return unique;
}
export function conflictOnRoute(route:Route,direction:Direction):{point:Point;distance:number}|null {const c=pathConflicts('north',route,direction,'straight').sort((a,b)=>a.a-b.a)[0];return c?{point:c.point,distance:c.a}:null;}
export type State={phase:Phase;lesson:LessonId;seed:number;time:number;distance:number;speed:number;route:Route;indicator:Indicator;indicatorSince:number;indicatorUsed:Indicator;traffic:Traffic[];reason:string;slowed:boolean};
export function createState(lesson:LessonId='right',seed=42):State {const info=lessons.find(l=>l.id===lesson)!;return{phase:'ready',lesson,seed,time:0,distance:0,speed:0,route:info.preferred,indicator:null,indicatorSince:0,indicatorUsed:null,traffic:makeTraffic(lesson,seed),reason:'',slowed:false};}
export function chooseRoute(state:State,route:Route){if(state.distance<ROUTE_LOCK&&!['failed','success'].includes(state.phase))state.route=route;}
export function toggleIndicator(state:State,side:Exclude<Indicator,null>){if(['failed','success'].includes(state.phase))return;state.indicator=state.indicator===side?null:side;state.indicatorSince=state.time;}
export function selectDirection(state:State,key:string){if(key==='w'||key==='ArrowUp')chooseRoute(state,'straight');else if(key==='a'||key==='ArrowLeft')chooseRoute(state,'left');else if(key==='d'||key==='ArrowRight')chooseRoute(state,'right');}
export type Actor={id:number;direction:Direction;route:Route;distance:number;speed:number;cruiseSpeed:number};
export function mustYield(a:Pick<Actor,'direction'|'route'>,b:Pick<Actor,'direction'|'route'>,lesson:LessonId):boolean {
  if(a.direction===b.direction)return false;
  const av=a.direction==='north'||a.direction==='south',bv=b.direction==='north'||b.direction==='south';
  if(lesson==='signed'&&av!==bv)return av;
  const diff=(heading[b.direction]-heading[a.direction]+360)%360;
  return diff===270 || (diff===180&&a.route==='left'&&b.route!=='left');
}
function carActor(car:Traffic):Actor {
  if(car.distance===undefined)car.distance=car.direction==='west'?770-car.x:car.direction==='east'?car.x-190:car.direction==='south'?car.y-70:650-car.y;
  car.route??='straight';car.cruiseSpeed??=car.speed;
  return{id:car.id,direction:car.direction,route:car.route,distance:car.distance,speed:car.speed,cruiseSpeed:car.cruiseSpeed};
}
function playerActor(s:State):Actor{return{id:-1,direction:'north',route:s.route,distance:s.distance,speed:s.speed,cruiseSpeed:88};}
function perceivedPlayerRoutes(s:State):Route[] {
  // Route selection is private. Others use a sustained, plausible signal or an observable turn.
  const turned=Math.abs(poseAt(s.route,s.distance).angle)>18;
  const signalled=s.indicator===s.route&&s.indicator!==null&&s.time-s.indicatorSince>=.6&&s.speed<=55;
  return turned||signalled||s.distance>330?[s.route]:['straight','left','right'];
}
function gapRisk(a:Actor,b:Actor,c:Conflict,margin=1.3):boolean {
  const da=c.a-a.distance,db=c.b-b.distance;
  if(da < -CLEARANCE||db < -CLEARANCE||da>360||db>360)return false;
  const ta=Math.max(0,da)/Math.max(25,a.speed),tb=Math.max(0,db)/Math.max(25,b.speed);
  const clearanceA=CLEARANCE/Math.max(25,a.speed),clearanceB=CLEARANCE/Math.max(25,b.speed);
  return ta<=tb+clearanceB+margin && tb<=ta+clearanceA+margin;
}
function targetFor(car:Actor,actors:Actor[],state:State):{speed:number;stop:number;reason:Traffic['waitingFor']} {
  let target=car.cruiseSpeed,stop=Infinity,reason:Traffic['waitingFor']=null;
  for(const other of actors){
    if(other.id===car.id)continue;
    const mine=lanePose(car.direction,car.route,car.distance),theirs=lanePose(other.direction,other.route,other.distance);
    const angle=mine.angle*Math.PI/180,forward={x:Math.sin(angle),y:-Math.cos(angle)},delta=sub(theirs,mine),along=delta.x*forward.x+delta.y*forward.y,lateral=Math.abs(cross(delta,forward));
    const aligned=Math.cos((mine.angle-theirs.angle)*Math.PI/180)>.8;
    if(along>0&&along<95&&lateral<25&&aligned){
      const room=Math.max(0,along-56);const safe=Math.min(other.speed+room*.7,Math.sqrt(2*90*room));
      if(safe<target){target=safe;reason='queue';stop=Math.min(stop,car.distance+room);}
    }
    const routes=other.id===-1?perceivedPlayerRoutes(state):[other.route];
    for(const route of routes){
      const perceived={...other,route};
      if(!mustYield(car,perceived,state.lesson))continue;
      for(const c of pathConflicts(car.direction,car.route,other.direction,route)){
        // Once already through the crossing, do not brake for traffic behind it.
        if(c.a-car.distance < -22 || !gapRisk(car,perceived,c,1.6))continue;
        const line=Math.min(APPROACH_STOP,c.a-60);
        if(car.distance>line+8)continue; // committed vehicles clear the junction
        const room=Math.max(0,line-car.distance);
        const safe=room<1?0:Math.sqrt(2*75*room);
        if(safe<target||room<80){target=Math.min(target,safe);stop=Math.min(stop,line);reason='priority';}
      }
    }
    // Emergency braking reacts to actual proximity, independently of signals or priority.
    if(!aligned && Math.hypot(delta.x,delta.y)<90 && along>0 && lateral<42){target=0;stop=Math.min(stop,car.distance+Math.max(0,along-50));reason='safety';}
  }
  return{speed:target,stop,reason};
}
export function tick(state:State,dt:number,input:{gas:boolean;brake:boolean}) {
  if(state.phase!=='driving')return;
  dt=Math.min(Math.max(dt,0),.05);state.time+=dt;
  state.speed=Math.max(0,Math.min(88,state.speed+(input.brake?-125:input.gas?37:-19)*dt));
  if(state.distance>95&&state.distance<200&&state.speed<35)state.slowed=true;
  state.distance+=state.speed*dt;
  if(state.indicator===state.route&&state.distance>ROUTE_LOCK)state.indicatorUsed=state.indicator;
  const player=playerActor(state),actors=[player,...state.traffic.map(carActor)];
  // Check the player's actual obligations, not whether NPCs can rescue an unsafe entry.
  for(const other of actors.slice(1)){
    if(!mustYield(player,other,state.lesson))continue;
    for(const c of pathConflicts(player.direction,player.route,other.direction,other.route)){
      const remaining=c.a-state.distance;
      if(state.speed>10&&state.distance>190&&remaining>0&&remaining<155&&gapRisk(player,other,c,.55)){
        state.phase='failed';state.reason=state.lesson==='left'?'Du svingte inn foran møtende trafikk. Vent før svingen til du kan krysse uten å forstyrre den andre bilen.':'Du kjørte inn i et for lite mellomrom. Slipp fram trafikken du har vikeplikt for, selv om du har satt på blinklyset.';return;
      }
    }
  }
  const decisions=state.traffic.map(car=>targetFor(carActor(car),actors,state));
  state.traffic.forEach((car,i)=>{
    const decision=decisions[i],old=car.speed;
    car.speed=decision.speed<old?Math.max(decision.speed,old-95*dt):Math.min(decision.speed,old+30*dt);
    const desired=car.distance!+car.speed*dt;
    car.distance=Math.min(desired,decision.stop);
    if(car.distance<desired)car.speed=0;
    car.braking=car.speed<old-.1||(car.speed<1&&!!decision.reason);car.waitingFor=decision.reason;
    Object.assign(car,lanePose(car.direction,car.route!,car.distance));
    car.indicator=car.route==='straight'||car.distance<40||car.distance>routeLength(car.route!)-230?null:car.route;
  });
  const p=poseAt(state.route,state.distance);
  if(state.traffic.some(car=>Math.hypot(p.x-car.x,p.y-car.y)<35)){state.phase='failed';state.reason='Bilene kom for nær hverandre. Senk farten tidligere, og vent til du har en trygg luke.';return;}
  if(state.distance>routeLength(state.route)-230&&state.route!=='straight')state.indicator=null;
  if(state.distance>routeLength(state.route)-20){
    const required=lessons.find(l=>l.id===state.lesson)!.required;
    if(required&&state.route!==required){state.phase='failed';state.reason=required==='left'?'Oppgaven var å svinge til venstre. Velg venstre med A før du kommer inn i krysset.':'Oppgaven var å kjøre rett fram. Velg rett fram med W før du kommer inn i krysset.';}
    else {state.phase='success';state.reason=state.lesson==='priority'?'Trygt gjennomført. De andre bilene vek for deg når de hadde vikeplikt. Du beholdt oversikten og kjørte da det var klart.':'Trygt gjennomført. Du passerte uten å hindre eller forstyrre trafikken du hadde vikeplikt for.';}
  }
}
