export type Route = 'straight' | 'left' | 'right';
export type LessonId = 'right' | 'left' | 'signed';
export type Phase = 'ready' | 'driving' | 'paused' | 'success' | 'failed';
export type Point = { x: number; y: number };
export type Traffic = { id: number; x: number; y: number; angle: number; speed: number; color: string; style: number; direction: 'west' | 'south' | 'east' };
export type Lesson = { id: LessonId; title: string; short: string; description: string; rule: string; source: string; preferred: Route; required?: Route };
export const lessons: Lesson[] = [
  { id: 'right', title: 'Trafikk fra høyre', short: 'Høyreregelen', description: 'Kjør gjennom krysset. Se etter trafikk fra høyre, og velg et trygt tidspunkt å kjøre.', rule: 'I dette krysset er det ingen skilt eller lyssignaler. Du har vikeplikt for kjøretøy fra høyre. Senk farten i god tid, og stans hvis det trengs.', source: 'Trafikkreglene § 7 nr. 1–2', preferred: 'straight' },
  { id: 'left', title: 'Sving til venstre', short: 'Møtende trafikk', description: 'Ta til venstre i krysset. Slipp fram den møtende trafikken før du svinger.', rule: 'Når du svinger til venstre og får møtende kjøretøy på din høyre side, har du vikeplikt. Vis tydelig at du vil vike.', source: 'Trafikkreglene § 7 nr. 1–2', preferred: 'left', required: 'left' },
  { id: 'signed', title: 'Et tydelig vikepliktskilt', short: 'Skiltet vikeplikt', description: 'Kjør rett fram. Her må du se etter trafikk fra begge sider, og vike før vikelinjen.', rule: 'Vikepliktskiltet betyr at du skal vike for kjørende i begge retninger på den kryssende veien. Det er ikke krav om full stans hvis du kan kjøre uten å hindre eller forstyrre andre.', source: 'Skiltforskriften, skilt 202 · Trafikkreglene § 7 nr. 1', preferred: 'straight', required: 'straight' },
];
export function random(seed: number) { let value = seed >>> 0; return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296; }; }
const colors = ['#cf6956', '#d1b66a', '#7a90ac', '#d5dbd6', '#526d65', '#a98bb2'];
export function makeTraffic(lesson: LessonId, seed: number): Traffic[] {
  const rng = random(seed);
  const specs: [Traffic['direction'], number, number][] = lesson === 'left' ? [['south', 10, 61], ['south', -255, 65]] : lesson === 'signed' ? [['west', 800, 62], ['east', 125, 57], ['west', 1105, 66]] : [['west', 800, 62], ['west', 1090, 68]];
  return specs.map(([direction, pos, speed], id) => ({ id, direction, x: direction === 'south' ? 439 : pos, y: direction === 'south' ? pos : direction === 'west' ? 319 : 401, angle: direction === 'south' ? 180 : direction === 'west' ? -90 : 90, speed: speed + rng() * 3, color: colors[Math.floor(rng() * colors.length)], style: Math.floor(rng() * 3) }));
}
export function routePoints(route: Route): Point[] {
  if (route === 'straight') return [{x:521,y:650},{x:521,y:65}];
  const points: Point[] = [{x:521,y:650},{x:521,y:route === 'left' ? 425 : 487}];
  const start=points[1], control={x:521,y:route==='left'?319:401}, end={x:route==='left'?395:615,y:route==='left'?319:401};
  for(let i=1;i<=40;i++){const t=i/40;points.push({x:(1-t)**2*start.x+2*(1-t)*t*control.x+t*t*end.x,y:(1-t)**2*start.y+2*(1-t)*t*control.y+t*t*end.y});}
  points.push({x:route==='left'?45:915,y:end.y}); return points;
}
export function routeLength(route: Route): number { const p=routePoints(route); return p.slice(1).reduce((s,v,i)=>s+Math.hypot(v.x-p[i].x,v.y-p[i].y),0); }
export function poseAt(route: Route, distance: number): Point & {angle: number} {
  const points=routePoints(route); let remaining=Math.max(0,distance);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(remaining<=len||i===points.length-1){const t=Math.min(1,remaining/len);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI};}remaining-=len;}
  return {x:521,y:650,angle:0};
}
// Conflict locations are derived from the same sampled lane geometry as the renderer.
export function conflictOnRoute(route: Route, direction: Traffic['direction']): {point:Point; distance:number} | null {
  if(route==='right' && direction==='west') return null;
  if(route!=='left' && direction==='south') return null;
  const pts=routePoints(route); let distance=0;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b.x-a.x,b.y-a.y);const axis=direction==='south'?'x':'y',target=direction==='south'?439:direction==='west'?319:401;
    if(a[axis]!==b[axis] && (target-a[axis])/(b[axis]-a[axis])>=0 && (target-a[axis])/(b[axis]-a[axis])<=1){const t=(target-a[axis])/(b[axis]-a[axis]);return{point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},distance:distance+len*t};}distance+=len;
  }return null;
}
export type State = { phase: Phase; lesson: LessonId; seed:number; time:number; distance:number; speed:number; route:Route; indicator:'left'|'right'|null; traffic:Traffic[]; reason:string; slowed:boolean; };
export function createState(lesson: LessonId='right',seed=42): State { const info=lessons.find(l=>l.id===lesson)!; return {phase:'ready',lesson,seed,time:0,distance:0,speed:0,route:info.preferred,indicator:null,traffic:makeTraffic(lesson,seed),reason:'',slowed:false}; }
export function chooseRoute(state:State,route:Route) { if(state.distance<175 && !['failed','success'].includes(state.phase))state.route=route; }
export function tick(state:State,dt:number,input:{gas:boolean;brake:boolean}) {
  if(state.phase!=='driving')return;
  dt=Math.min(Math.max(dt,0),0.05); state.time+=dt;
  state.speed=Math.max(0,Math.min(88,state.speed+(input.brake?-125:input.gas?37:-19)*dt));
  if(state.distance>95 && state.distance<200 && state.speed<35)state.slowed=true;
  state.distance+=state.speed*dt;
  state.traffic.forEach(car=>{if(car.direction==='south')car.y+=car.speed*dt;else car.x+=(car.direction==='west'?-1:1)*car.speed*dt;});
  const player=poseAt(state.route,state.distance);
  for(const car of state.traffic){
    if(Math.hypot(player.x-car.x,player.y-car.y)<35){state.phase='failed';state.reason='Bilene kom for nær hverandre. Senk farten tidligere, og vent til trafikken har passert.';return;}
    const conflict=conflictOnRoute(state.route,car.direction);if(!conflict)continue;
    const carDistance=car.direction==='south'?conflict.point.y-car.y:car.direction==='west'?car.x-conflict.point.x:conflict.point.x-car.x;
    const playerDistance=conflict.distance-state.distance;
    // Evaluate time to the shared crossing, including vehicle clearance and a safety margin.
    // A stopped car does not violate yield simply by waiting; it must be moving into a conflict.
    if(state.speed>10 && state.distance>190 && playerDistance>0 && playerDistance<155 && carDistance>-40 && carDistance<230){
      const theirTime=carDistance/car.speed,ourTime=playerDistance/state.speed;
      if(Math.abs(ourTime-theirTime)<1.25){state.phase='failed';state.reason=state.lesson==='left'?'Du svingte inn foran møtende trafikk. Vent før svingen til du kan krysse uten å forstyrre den andre bilen.':'Du kjørte inn i et for lite mellomrom. Den andre bilen ville måttet bremse. Slipp den fram, og prøv igjen.';return;}
    }
  }
  if(state.distance>routeLength(state.route)-20){
    const required=lessons.find(l=>l.id===state.lesson)!.required;
    if(required && state.route!==required){state.phase='failed';state.reason=required==='left'?'Oppgaven var å svinge til venstre. Velg venstre med A før du kommer inn i krysset.':'Oppgaven var å kjøre rett fram. Velg rett fram før du kommer inn i krysset.';}
    else {state.phase='success';state.reason=state.route==='right'&&state.lesson==='right'?'Trygt gjennomført. Rutene deres krysset ikke hverandre denne gangen. Prøv også rett fram for å øve på å slippe fram trafikk fra høyre.':'Trygt gjennomført. Du passerte uten å hindre eller forstyrre trafikken du hadde vikeplikt for.';}
  }
}
