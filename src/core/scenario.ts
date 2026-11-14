import type {JunctionRule,Traffic,Direction,Route} from './types.ts';
import {lanePose} from './geometry.ts';
export function random(seed: number) { let value = seed >>> 0; return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296; }; }
const colors = ['#cf6956', '#d1b66a', '#7a90ac', '#d5dbd6', '#526d65', '#a98bb2'];
export function makeTraffic(rule:JunctionRule,seed:number):Traffic[] {
  const rng=random(seed^0x5bd1e995);
  // Random streams vary approach, spacing, turns, speed, body and colour. Responses
  // still obey the same deterministic rules; driver hesitation is a later increment.
  const horizontal=rule==='signed'||rng()<.65;
  const directions:Direction[]=horizontal?(rng()<.5?['east','west']:['west','east']):['south'];
  const traffic:Traffic[]=[];
  for(const direction of directions){
    const count=2+Math.floor(rng()*3);let distance=-20-rng()*135;
    for(let i=0;i<count;i++){
      const turn=rng();
      const route:Route=direction==='west'?(turn<.3?'right':'straight'):turn<.25?'left':turn>.72?'right':'straight';
      const cruiseSpeed=48+rng()*22;
      traffic.push({id:traffic.length,direction,route,distance,cruiseSpeed,speed:cruiseSpeed,...lanePose(direction,route,distance),color:colors[Math.floor(rng()*colors.length)],style:Math.floor(rng()*3),indicator:null,braking:false,waitingFor:null});
      distance-=210+rng()*130;
    }
  }
  return traffic;
}
