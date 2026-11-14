import type {Body,LaneStatus} from './physics.ts';
import type {WorldState} from './world.ts';
export type Route = 'straight' | 'left' | 'right';
export type Indicator = 'left' | 'right' | null;
export type JunctionRule = 'unsigned' | 'signed' | 'priority' | 'roundabout';
export type Phase = 'ready' | 'driving' | 'paused' | 'failed';
export type Point = { x: number; y: number };
export type Direction = 'north' | 'east' | 'south' | 'west';
export type Traffic = {
  id: number; x: number; y: number; angle: number; speed: number;
  color: string; style: number; direction: Direction;
  route?: Route; distance?: number; cruiseSpeed?: number; indicator?: Indicator;
  braking?: boolean; reversing?: boolean; stoppedFor?:number; blockedBy?:number|null; lastHornAt?:number; waitingFor?: 'priority' | 'queue' | 'safety' | null;
};
export type State={phase:Phase;rule:JunctionRule;seed:number;time:number;distance:number;speed:number;speedLimit:number;route:Route;player:Body;assistance:number;lane:LaneStatus;offRoadTime:number;indicator:Indicator;indicatorSince:number;indicatorUsed:Indicator;traffic:Traffic[];reason:EventCode|null;slowed:boolean;crossings:number;notice:NoticeCode|null;noticeUntil:number;events:TrafficEvent[];eventSequence:number;warning:TrafficEvent|null;warningUntil:number;warningCooldown:Record<string,number>;failure:Failure|null;frameNumber:number;recovery:Recovery|null;recoveryCheckAt:number;horns:HornPulse[];hornSequence:number;playerHornAt:number;world?:WorldState};
export type Actor={id:number;direction:Direction;route:Route;distance:number;speed:number;cruiseSpeed:number;pose?:Point & {angle:number}};

export type Input={gas:boolean;brake:boolean;reverse?:boolean;steer?:number};
export type EventCode='yield-caution'|'priority-pressure'|'yield-violation'|'collision'|'off-road'|'wrong-lane';
export type NoticeCode='junction-cleared'|'signal-missing';
export type TrafficEvent={id:number;frame:number;time:number;seed:number;severity:'warning'|'failure';code:EventCode;actorIds:number[];point:Point|null;facts:Record<string,number>};
export type SceneFrame={frame:number;time:number;seed:number;rule:JunctionRule;player:Body;speed:number;speedLimit:number;traffic:Traffic[]};
export type Failure={event:TrafficEvent;scene:SceneFrame};
export type Decision={speed:number;stop:number;reason:Traffic['waitingFor'];blockedBy:number|null;recovery?:'backing'|'clearing'|'waiting'};

export type Recovery={winnerId:number;holdIds:number[];backingIds:number[];targets:Record<number,number>;clearDistance:number;phase:'backing'|'clearing';startedAt:number;lastProgressAt:number;lastProgress:number};
export type HornPulse={id:number;actorId:number;startedAt:number};
