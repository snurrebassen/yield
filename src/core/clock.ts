import type {State,Input} from './types.ts';
import {FIXED_STEP} from './config.ts';
import {stepSimulation} from './simulation.ts';
export type SimulationClock={accumulator:number};
export function createClock():SimulationClock{return{accumulator:0};}
export function advanceSimulation(state:State,clock:SimulationClock,elapsed:number,input:Input):number {
  if(state.phase!=='driving'){clock.accumulator=0;return 0;}
  if(!Number.isFinite(elapsed)||elapsed<0)return 0;
  clock.accumulator+=Math.min(elapsed,.25);let steps=0;
  while(clock.accumulator+1e-9>=FIXED_STEP&&state.phase==='driving'){
    stepSimulation(state,input);clock.accumulator=Math.max(0,clock.accumulator-FIXED_STEP);steps++;
  }
  if(state.phase!=='driving')clock.accumulator=0;
  return steps;
}
