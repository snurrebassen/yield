import type {Route,Point,Direction} from './types.ts';
import {heading} from './config.ts';
import {pathMetrics} from './physics.ts';
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
export function routeLength(route:Route):number{return pathMetrics(routePoints(route)).length;}
export function poseAt(route:Route,distance:number):Point & {angle:number} {
  const segments=pathMetrics(routePoints(route)).segments;
  for(let i=0;i<segments.length;i++){const {a,dx,dy,length,start}=segments[i];if(distance<=start+length||i===segments.length-1){const t=(distance-start)/length;return{x:a.x+dx*t,y:a.y+dy*t,angle:Math.atan2(dx,-dy)*180/Math.PI};}}
  return{x:521,y:650,angle:0};
}
function rotate(p:Point,direction:Direction):Point {
  const a=heading[direction]*Math.PI/180,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));
  return{x:480+(p.x-480)*c-(p.y-360)*s,y:360+(p.x-480)*s+(p.y-360)*c};
}
export function lanePose(direction:Direction,route:Route,distance:number) {const p=poseAt(route,distance);return{...rotate(p,direction),angle:p.angle+heading[direction]};}
const pathCache=new Map<string,Point[]>();
export function path(direction:Direction,route:Route){const key=direction+route;let p=pathCache.get(key);if(!p){p=routePoints(route).map(p=>rotate(p,direction));pathCache.set(key,p);}return p;}
export type Conflict={point:Point; a:number; b:number};
const conflictCache=new Map<string,Conflict[]>();
export const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
export const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
export function pathConflicts(ad:Direction,ar:Route,bd:Direction,br:Route):Conflict[] {
  const key=[ad,ar,bd,br].join(':');const cached=conflictCache.get(key);if(cached)return cached;
  const result=intersections(path(ad,ar),path(bd,br));conflictCache.set(key,result);return result;
}
export function intersections(ap:Point[],bp:Point[]):Conflict[]{
  const result:Conflict[]=[];let al=0;
  for(let i=1;i<ap.length;i++){
    const p=ap[i-1],r=sub(ap[i],p),rl=Math.hypot(r.x,r.y);let bl=0;
    for(let j=1;j<bp.length;j++){
      const q=bp[j-1],s=sub(bp[j],q),sl=Math.hypot(s.x,s.y),qp=sub(q,p),den=cross(r,s);
      if(Math.max(p.x,ap[i].x)<Math.min(q.x,bp[j].x)-1e-8||Math.min(p.x,ap[i].x)>Math.max(q.x,bp[j].x)+1e-8||Math.max(p.y,ap[i].y)<Math.min(q.y,bp[j].y)-1e-8||Math.min(p.y,ap[i].y)>Math.max(q.y,bp[j].y)+1e-8){bl+=sl;continue;}
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
  const unique=result.filter((v,i)=>!result.slice(0,i).some(o=>Math.abs(o.a-v.a)<1&&Math.abs(o.b-v.b)<1));return unique;
}
export function conflictOnRoute(route:Route,direction:Direction):{point:Point;distance:number}|null {const c=pathConflicts('north',route,direction,'straight').sort((a,b)=>a.a-b.a)[0];return c?{point:c.point,distance:c.a}:null;}
