export type TouchDrive={id:number;x:number;y:number;steer:number;reverse:boolean};
export function moveTouch(touch:TouchDrive,x:number,y:number):TouchDrive {
 const dx=x-touch.x,dy=y-touch.y;
 return {...touch,steer:Math.max(-1,Math.min(1,(Math.abs(dx)<10?0:dx-Math.sign(dx)*10)/65)),reverse:dy>(touch.reverse?28:48)};
}
