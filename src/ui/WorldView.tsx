import {memo} from 'react';
import {atPort,portAngle,visibleWorld,vector,type WorldNode,type WorldRoad,type WorldState} from '../core/world.ts';
import type {Point} from '../core/types.ts';
const path=(points:Point[])=>points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
const Road=memo(function Road({road}:{road:WorldRoad}){const d=path(road.points);return <g><path d={d} fill="none" stroke="#d3d3c7" strokeWidth="188"/><path d={d} fill="none" stroke="#f7f4db" strokeWidth="167"/><path d={d} fill="none" stroke="#626c68" strokeWidth="164"/><path d={d} fill="none" stroke="#e6ca72" strokeWidth="2.5" strokeDasharray="17 20"/></g>;});
const Node=memo(function Node({node}:{node:WorldNode}){
  const round=node.kind==='roundabout';
  return <g transform={`translate(${node.x} ${node.y}) rotate(${node.angle})`}>
    {node.arms.map(port=><g key={'road'+port} transform={`rotate(${port*90})`}><path d="M0 0V-231" stroke="#d3d3c7" strokeWidth="188"/><path d="M0 0V-231" stroke="#f7f4db" strokeWidth="167"/><path d="M0 0V-231" stroke="#626c68" strokeWidth="164"/></g>)}
    {round?<><circle r="167" fill="#d3d3c7"/><circle r="156" fill="#626c68"/><circle r="72" fill="#f0ecda"/><circle r="65" fill="#b3c399"/><circle r="54" fill="#c3cea9"/><circle r="148" fill="none" stroke="#f4f1dc" strokeWidth="2"/><circle r="75" fill="none" stroke="#f4f1dc" strokeWidth="2"/></>:<circle r="83" fill="#626c68"/>}
    {node.arms.map(port=>{const yieldHere=round||(node.priority.length>0&&!node.priority.includes(port));return <g key={port} transform={`rotate(${port*90})`}>
      <path d={`M0 -231V-${round?179:105}`} fill="none" stroke="#e6ca72" strokeWidth="2.5" strokeDasharray="17 20"/>
      {yieldHere&&<><path d="M-70 -177l9 15 9-15Zm23 0 9 15 9-15Zm23 0 9 15 9-15Z" fill="#f5f0de"/><g transform="translate(-104 -186) rotate(180)"><rect x="-2" width="4" height="26" fill="#8f968b"/><path d="M-14-14H14L0 11Z" fill="#fff4d9" stroke="#c65247" strokeWidth="4"/>{round&&<g transform="translate(0 36)"><circle r="13" fill="#367497" stroke="#fff" strokeWidth="1.5"/><path d="M-7 2a7 7 0 0 1 10-8m-1-4 4 5-6 1M7-1a7 7 0 0 1-11 7m1 4-4-5 6-1" fill="none" stroke="#fff" strokeWidth="1.5"/></g>}</g></>}
      {node.priority.includes(port)&&<g transform="translate(-104 -197)"><rect x="-2" width="4" height="24" fill="#8f968b"/><rect x="-12" y="-12" width="24" height="24" transform="rotate(45)" fill="#fff9e8" stroke="#464d46" strokeWidth="1"/><rect x="-8" y="-8" width="16" height="16" transform="rotate(45)" fill="#e6c755"/></g>}
      {round&&<path d="M-32 -119Q-49 -110-55 -88m-5 4 4-12 7 9" fill="none" stroke="#f4f1dc" strokeWidth="2"/>}
    </g>;})}
    {[[-260,-270],[275,280],[-290,267],[270,-290]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r={24+(node.seed+i)%15} fill="#a8ba91"/><circle cx={x-5} cy={y-6} r="19" fill="#bdcba5"/></g>)}
  </g>;
});
// Priority is scoped to each junction. Show its end before an uncontrolled approach.
function PriorityEnd({world,node}:{world:WorldState;node:WorldNode}){return <>{node.arms.flatMap(port=>{const road=world.roads.find(r=>r.id===node.connections[port]);if(!road||node.priority.includes(port))return[];const other=world.nodes.find(n=>n.id===(road.a===node.id?road.b:road.a));const otherPort=road.a===node.id?road.bp:road.ap;if(!other?.priority.includes(otherPort))return[];const p=atPort(node,port,228,'in'),v=vector(portAngle(node,port));return <g key={port} transform={`translate(${p.x+v.y*64} ${p.y-v.x*64}) rotate(${portAngle(node,port)+180})`}><rect x="-12" y="-12" width="24" height="24" transform="rotate(45)" fill="#fff9e8" stroke="#464d46"/><rect x="-8" y="-8" width="16" height="16" transform="rotate(45)" fill="#e6c755"/><path d="M-11 14L11-14M-7 16L15-12" stroke="#454d47" strokeWidth="2"/></g>;})}</>}
export function WorldView({world,player}:{world:WorldState;player:Point}){const visible=visibleWorld(world,player);return <><rect x={player.x-2400} y={player.y-2400} width="4800" height="4800" fill="#dce2c9"/><rect x={player.x-2400} y={player.y-2400} width="4800" height="4800" fill="url(#grain)"/>{visible.roads.map(r=><Road key={r.id} road={r}/>)}{visible.nodes.map(n=><Node key={n.id+':'+n.arms.join(',')} node={n}/>)}{visible.nodes.map(n=><PriorityEnd key={n.id} node={n} world={world}/>)}</>}
