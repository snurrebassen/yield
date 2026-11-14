import type {Point,Body} from '../core/physics.ts';
export function cameraPoint(p:Point,body:Body,follow=true):Point {
  if(!follow)return p;
  const a=-body.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-body.x,y=p.y-body.y;
  return{x:480+x*c-y*s,y:535+x*s+y*c};
}
