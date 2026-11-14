import type {TrafficDensity} from '../core/world.ts';
export const densityLabels:Record<TrafficDensity,string>={none:'Ingen trafikk',low:'Lite trafikk',normal:'Normal trafikk',high:'Mye trafikk'};
export function TrafficSettings({pending,active,onChange,onRestart}:{pending:TrafficDensity;active:TrafficDensity;onChange:(value:TrafficDensity)=>void;onRestart:()=>void}){
  return <section className="traffic-settings" aria-label="Verdensinnstillinger"><label htmlFor="traffic-density">Trafikkmengde</label><select id="traffic-density" value={pending} onChange={e=>onChange(e.target.value as TrafficDensity)}>{Object.entries(densityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><small role="status">{pending===active?'Brukes ved neste omstart.':`Nå: ${densityLabels[active].toLowerCase()}. Endres ved omstart.`}</small><button className="secondary restart" onClick={onRestart}>↻ Start verdenen på nytt</button></section>;
}
