export type Point={x:number;y:number};
export type Body=Point & {angle:number;wheel:number};
export type Projection=Point & {distance:number;offset:number;angle:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const angleDifference=(a:number,b:number)=>((a-b+540)%360+360)%360-180;

export function projectPath(points:Point[],p:Point):Projection {
  let best:Projection={...points[0],distance:0,offset:Infinity,angle:0},total=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length),0,1);
    const q={x:a.x+t*dx,y:a.y+t*dy},offset=Math.hypot(p.x-q.x,p.y-q.y);
    if(offset<best.offset)best={...q,offset,distance:total+t*length,angle:Math.atan2(dx,-dy)*180/Math.PI};
    total+=length;
  }
  return best;
}
export function pointAlong(points:Point[],distance:number):Point {
  let left=distance;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    if(left<=length||i===points.length-1){const t=left/length;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
    left-=length;
  }
  return points[0];
}
export function steeringInput(keys:ReadonlySet<string>):number {
  return Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));
}
export function stepDriving(body:Body,speed:number,steer:number,points:Point[],dt:number,assistance=.6):void {
  const nearest=projectPath(points,body),lookahead=42+speed*.35,target=pointAlong(points,nearest.distance+lookahead);
  const targetAngle=Math.atan2(target.x-body.x,-(target.y-body.y))*180/Math.PI;
  const error=angleDifference(targetAngle,body.angle)*Math.PI/180;
  // A broad dead band leaves room to drift; the guide supplies a bounded steering nudge.
  const slack=nearest.offset<10&&Math.abs(angleDifference(nearest.angle,body.angle))<4;
  const fade=clamp(1-(nearest.offset-25)/65,0,1);
  const guide=slack?0:clamp(Math.atan(2*45*Math.sin(error)/lookahead),-.28,.28)*assistance*fade;
  const manual=clamp(steer,-1,1);
  const desired=manual*.72+guide*(1-Math.abs(manual));
  body.wheel+=(desired-body.wheel)*(1-Math.exp(-7*dt));
  // A bicycle model: turning depends on speed and wheel angle, never a selected route.
  const yaw=speed/45*Math.tan(body.wheel)*180/Math.PI;
  const mid=(body.angle+yaw*dt/2)*Math.PI/180;
  body.x+=Math.sin(mid)*speed*dt;body.y-=Math.cos(mid)*speed*dt;
  body.angle+=yaw*dt;
}
export type LaneStatus='ok'|'wrong-lane'|'off-road';
export function laneStatus(p:Point & {angle:number}):LaneStatus {
  const vertical=p.x>=398&&p.x<=562,horizontal=p.y>=278&&p.y<=442;
  if(!vertical&&!horizontal)return'off-road';
  const a=p.angle*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a);
  if(vertical&&!horizontal&&Math.abs(dy)>.35&&((dy<0&&p.x<480)||(dy>0&&p.x>480)))return'wrong-lane';
  if(horizontal&&!vertical&&Math.abs(dx)>.35&&((dx>0&&p.y<360)||(dx<0&&p.y>360)))return'wrong-lane';
  return'ok';
}
export function cameraPoint(p:Point,body:Body,follow=true):Point {
  if(!follow)return p;
  const a=-body.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-body.x,y=p.y-body.y;
  return{x:480+x*c-y*s,y:535+x*s+y*c};
}
