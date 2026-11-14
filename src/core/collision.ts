import type {Point} from './types.ts';
export type VehicleBox=Point & {angle:number};
// Exact oriented rectangles avoid flagging nearby cars in adjacent lanes as collisions.
export function vehiclesOverlap(a:VehicleBox,b:VehicleBox,width=23,length=43):boolean {
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>length*length+width*width)return false;
  const ar=a.angle*Math.PI/180,br=b.angle*Math.PI/180;
  const ax={x:Math.cos(ar),y:Math.sin(ar)},ay={x:-Math.sin(ar),y:Math.cos(ar)};
  const bx={x:Math.cos(br),y:Math.sin(br)},by={x:-Math.sin(br),y:Math.cos(br)};
  for(const axis of [ax,ay,bx,by]){
    const separation=Math.abs(dx*axis.x+dy*axis.y);
    const ra=width/2*Math.abs(ax.x*axis.x+ax.y*axis.y)+length/2*Math.abs(ay.x*axis.x+ay.y*axis.y);
    const rb=width/2*Math.abs(bx.x*axis.x+bx.y*axis.y)+length/2*Math.abs(by.x*axis.x+by.y*axis.y);
    if(separation>ra+rb)return false;
  }
  return true;
}
