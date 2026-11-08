import test from 'node:test';
import assert from 'node:assert/strict';
import {moveTouch} from '../src/ui/touch.ts';
import {createWorldState,stepSimulation,kmhToSpeed} from '../src/core/index.ts';
test('touch steering is relative to the held origin, bounded and has a dead band',()=>{
 const t={id:1,x:100,y:100,steer:0,reverse:false};assert.equal(moveTouch(t,105,100).steer,0);assert.equal(moveTouch(t,200,100).steer,1);assert.equal(moveTouch(t,0,100).steer,-1);assert.equal(moveTouch(t,100,160).reverse,true);assert.equal(moveTouch(moveTouch(t,100,160),100,135).reverse,true);assert.equal(moveTouch(t,100,100).reverse,false);
});
test('reverse brakes through zero, backs up slowly, and release braking stops in both directions',()=>{
 const s=createWorldState(42,{trafficDensity:'none'});s.phase='driving';s.speed=40;stepSimulation(s,{gas:false,brake:false,reverse:true});assert.ok(s.speed>0&&s.speed<40);
 for(let i=0;i<120;i++)stepSimulation(s,{gas:false,brake:false,reverse:true});assert.ok(s.speed<0);assert.ok(s.speed>=-kmhToSpeed(12));const before={...s.player};for(let i=0;i<10;i++)stepSimulation(s,{gas:false,brake:false,reverse:true});assert.ok(s.player.y>before.y);
 for(let i=0;i<60;i++)stepSimulation(s,{gas:false,brake:true});assert.equal(s.speed,0);const stopped={...s.player};for(let i=0;i<60;i++)stepSimulation(s,{gas:false,brake:true});assert.equal(s.player.x,stopped.x);assert.equal(s.player.y,stopped.y);assert.equal(s.player.angle,stopped.angle);
});
