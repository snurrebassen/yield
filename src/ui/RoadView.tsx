import {memo} from 'react';
import type {State,Traffic,JunctionRule} from '../core/index.ts';
function Car({x,y,angle,color,style=0,player=false,braking=false,indicator=null,time=0,wheel=0}:{x:number;y:number;angle:number;color:string;style?:number;player?:boolean;braking?:boolean;indicator?:'left'|'right'|null;time?:number;wheel?:number}){
  const width=style===1?25:23,length=style===2?46:43;
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    {player&&<><circle r="34" fill="#e9c05b" opacity=".12"/><circle r="31" fill="none" stroke="#d4b363" strokeWidth="1" strokeDasharray="3 5"/></>}
    <rect x={-width/2+2} y={-length/2+4} width={width} height={length} rx="7" fill="#15241e" opacity=".16"/>
    <rect transform={`rotate(${wheel*180/Math.PI} ${-width/2} -8.5)`} x={-width/2-2} y="-13" width="4" height="9" rx="1" fill="#273330"/><rect transform={`rotate(${wheel*180/Math.PI} ${width/2} -8.5)`} x={width/2-2} y="-13" width="4" height="9" rx="1" fill="#273330"/>
    <rect x={-width/2} y={-length/2} width={width} height={length} rx={style===1?5:7} fill={color} stroke="#26352e" strokeOpacity=".2" strokeWidth="1"/>
    <path d={`M${-width/2+3} -9 Q0 -14 ${width/2-3} -9 L${width/2-4} -1 H${-width/2+4}Z`} fill="#2c4947"/>
    <rect x={-width/2+4} y="2" width={width-8} height="13" rx="2.5" fill={color} stroke="#fff" strokeOpacity=".23"/>
    <path d={`M${-width/2+4} 16 H${width/2-4} L${width/2-3} 12 H${-width/2+3}Z`} fill="#35514d"/>
    <rect x={-width/2+2} y={-length/2+2} width="5" height="3" rx="1" fill="#fff0bb"/><rect x={width/2-7} y={-length/2+2} width="5" height="3" rx="1" fill="#fff0bb"/>
    <rect x={-width/2+2} y={length/2-4} width="5" height="2.5" rx="1" fill={braking?'#ff4238':'#af4741'}/><rect x={width/2-7} y={length/2-4} width="5" height="2.5" rx="1" fill={braking?'#ff4238':'#af4741'}/>
    {indicator&&Math.floor(time*2.5)%2===0&&<><rect x={indicator==='left'?-width/2-2:width/2-1} y="-18" width="3" height="7" rx="1" fill="#ffbc3a"/><rect x={indicator==='left'?-width/2-2:width/2-1} y="13" width="3" height="6" rx="1" fill="#ffbc3a"/></>}
  </g>;
}
function Tree({x,y,r=23}:{x:number;y:number;r?:number}){return <g><ellipse cx={x+6} cy={y+9} rx={r} ry={r*.85} fill="#203d2b" opacity=".07"/><circle cx={x} cy={y} r={r} fill="#a8ba91"/><circle cx={x-5} cy={y-4} r={r*.7} fill="#b5c69e"/><circle cx={x+6} cy={y-7} r={r*.4} fill="#c0cda8"/></g>}
export function RoadView({state,braking,follow}:{state:State;braking:boolean;follow:boolean}){
  const p=state.player,event=state.failure?.event??state.warning,focusColor=state.failure?'#bd5747':'#be913d';
  const camera=follow?`translate(480 535) rotate(${-p.angle}) translate(${-p.x} ${-p.y})`:undefined;
  return <svg className="road-map" viewBox="0 0 960 720" role="img" aria-label="Tilfeldig veikryss med fri styring. Du bestemmer hvor du vil kjøre. Kameraet kan følge bilen eller vise oversikt.">
    <defs><pattern id="grain" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="5" cy="8" r=".7" fill="#718763" opacity=".18"/><circle cx="19" cy="21" r=".7" fill="#718763" opacity=".12"/></pattern><pattern id="pavement" width="19" height="19" patternUnits="userSpaceOnUse"><path d="M0 0H19V19" fill="none" stroke="#c8c9bb" strokeWidth=".5"/></pattern></defs>
    <g transform={camera}><StaticRoad rule={state.rule}/>
    {state.traffic.map((car:Traffic)=><Car key={car.id} {...car} time={state.time}/>)}
    <Car {...p} color="#f0cc70" player braking={braking} indicator={state.indicator} time={state.time}/>

    {event&&<g className="incident-focus">{event.actorIds.map(id=>{const car=id===-1?state.player:state.traffic.find(car=>car.id===id);return car?<circle key={id} cx={car.x} cy={car.y} r="34" fill="none" stroke={focusColor} strokeWidth="3" strokeDasharray="5 4"/>:null;})}{event.point&&<circle cx={event.point.x} cy={event.point.y} r="8" fill={focusColor} fillOpacity=".2" stroke={focusColor} strokeWidth="2"/>}</g>}
    </g>
  </svg>;
}

const StaticRoad=memo(function StaticRoad({rule}:{rule:JunctionRule}){return <>
<rect x="-3000" y="-3000" width="7000" height="7000" fill="#dce2c9"/><rect x="375" y="-3000" width="210" height="7000" fill="#d3d3c7"/><rect x="-3000" y="255" width="7000" height="210" fill="#d3d3c7"/><rect x="398" y="-3000" width="164" height="7000" fill="#626c68"/><rect x="-3000" y="278" width="7000" height="164" fill="#626c68"/><path d="M480-3000V4000M-3000 360H4000" fill="none" stroke="#e6ca72" strokeWidth="2.5" strokeDasharray="17 20"/>
    <rect width="960" height="720" fill="#dce2c9"/><rect width="960" height="720" fill="url(#grain)"/>
    <path d="M0 255H375V0H585V255H960V465H585V720H375V465H0Z" fill="#d3d3c7"/><path d="M0 255H375V0H585V255H960V465H585V720H375V465H0Z" fill="url(#pavement)"/>
    <path d="M0 278H398V0H562V278H960V442H562V720H398V442H0Z" fill="#626c68"/>
    <path d="M0 279H398V0M562 0V279H960M960 441H562V720M398 720V441H0" fill="none" stroke="#f7f4db" strokeWidth="2" opacity=".85"/>
    <path d="M480 0V263M480 457V720M0 360H383M577 360H960" fill="none" stroke="#e6ca72" strokeWidth="2.5" strokeDasharray="17 20"/>
    <path d="M0 274H393V0M567 0V274H960M960 446H567V720M393 720V446H0" fill="none" stroke="#b9bbae" strokeWidth="2"/>
    <rect x="97" y="57" width="176" height="113" rx="7" fill="#bdc3af" opacity=".3" transform="translate(7 9)"/><rect x="97" y="57" width="176" height="113" rx="5" fill="#e4dec9" stroke="#c9c7b1"/><rect x="108" y="68" width="154" height="91" rx="3" fill="#c7c2ad"/><path d="M97 113H273" stroke="#b8b4a0" strokeWidth="2"/><rect x="145" y="94" width="58" height="27" rx="2" fill="#d5d3c1"/>
    <rect x="697" y="535" width="138" height="104" rx="4" fill="#d5c9b6" stroke="#c3b9a7"/><path d="M712 549H820V625H712Z" fill="#c1b5a3"/><path d="M698 587H835" stroke="#b4a792" strokeWidth="2"/>
    {[[54,62,26],[319,70,25],[316,187,31],[61,205,22],[660,65,27],[886,90,29],[704,209,30],[896,225,20],[75,516,29],[299,538,33],[110,666,25],[335,678,22],[653,548,22],[888,540,31],[886,683,26],[650,681,32]].map(([x,y,r],i)=><Tree key={i} x={x} y={y} r={r}/>)}
    <path d="M14 226H351M612 491H944" stroke="#c4cdb3" strokeWidth="2"/>
    {rule==='signed'&&<><path d="M488 451l9 15 9-15Zm25 0 9 15 9-15Zm25 0 9 15 9-15Z" fill="#f5f0de"/><g transform="translate(588 478)"><rect x="-2" y="-5" width="4" height="30" fill="#8f968b"/><path d="M-15-15H15L0 12Z" fill="#fff4d9" stroke="#c65247" strokeWidth="4"/></g></>}

</>;});
