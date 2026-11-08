import type {JunctionRule,EventCode,NoticeCode,State,TrafficEvent} from '../core/types.ts';
export const ruleInfo:Record<JunctionRule,{title:string;description:string;source:string}>={
  unsigned:{title:'Høyreregelen',description:'Her er det ingen vikepliktskilt. Vik for kjøretøy fra høyre. Når du svinger til venstre, må du også vike for møtende trafikk som krysser ruten din. De andre bilene følger de samme reglene.',source:'Trafikkreglene § 7'},
  signed:{title:'Skiltet vikeplikt',description:'Vikepliktskiltet betyr at du skal vike for kjørende i begge retninger på den kryssende veien. Velg selv om du vil til venstre, rett fram eller til høyre, og vent på en trygg luke.',source:'Skiltforskriften, skilt 202 · Trafikkreglene § 7'},
};
export const eventMessages:Record<EventCode,{title:string;detail:string}>={
  'yield-caution':{title:'Liten luke foran deg',detail:'Du nærmer deg trafikk du skal vike for. Senk farten og vis tydelig at du slipper den fram. Dette er et tidlig varsel; kjøringen fortsetter.'},
  'priority-pressure':{title:'Den andre bilen reagerer',detail:'Tilnærmingen din får en annen bil til å bremse forsiktig. Gi mer plass og gjør vikeplikten tydelig. Situasjonen er foreløpig et varsel.'},
  'yield-violation':{title:'Vikeplikten ble brutt',detail:'Du kjørte inn i en umiddelbar konflikt med trafikk du skulle vike for, eller tvang den til å bremse kraftig. Situasjonen er fryst med begge bilene synlige.'},
  collision:{title:'Kollisjon',detail:'Bilene traff hverandre. Se på plassering og fart i den fryste situasjonen før du prøver igjen.'},
  'off-road':{title:'Kjøringen er avbrutt',detail:'Bilen ble værende utenfor veien. Bruk roligere styreutslag og senk farten når du skal tilbake.'},
  'wrong-lane':{title:'Feil kjørefelt eller retning',detail:'Du kjørte ut i feil felt eller retning. Hold til høyre og rett opp bilen gjennom svingen.'},
};
export function noticeMessage(code:NoticeCode|null):string{return code==='signal-missing'?'Trygt gjennom. Husk å gi tegn før du svinger.':code==='junction-cleared'?'Trygt gjennom. Et nytt kryss venter.':'';}

export function affectedDriver(state:State,event:TrafficEvent):string {
  const id=event.actorIds.find(id=>id!==-1),car=state.traffic.find(car=>car.id===id);
  return car?.direction==='west'?'Bil fra høyre':car?.direction==='east'?'Bil fra venstre':car?.direction==='south'?'Møtende bil':car?'Annen bil':'';
}
