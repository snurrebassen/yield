import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldState,worldGuide,stepSimulation,toggleIndicator} from '../src/core/index.ts';
test('indicators never change the world steering path or vehicle motion, including roundabouts',()=>{
 for(const seed of [2,9,42])for(const angle of [-40,0,40]){
  const base=createWorldState(seed,{trafficDensity:'none'});base.phase='driving';base.player.angle=angle;
  const reference=worldGuide(base);
  for(const side of ['left','right'] as const){
   const plain=structuredClone(base),signalled=structuredClone(base);toggleIndicator(signalled,side);
   assert.deepEqual(worldGuide(signalled),reference);
   for(let i=0;i<90;i++){const input={gas:true,brake:false,steer:.2};stepSimulation(plain,input);stepSimulation(signalled,input);assert.deepEqual(signalled.player,plain.player);}
  }
 }
});
