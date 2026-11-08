// Keep the original world scale: 88 logical units/s = 30 km/h.
export const speedToKmh=(speed:number)=>speed*30/88;
export const kmhToSpeed=(kmh:number)=>kmh*88/30;
export const MAX_DRIVING_SPEED=kmhToSpeed(70);
export type SpeedLimit=30|40|50|60;
