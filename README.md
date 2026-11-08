# Yield

An open-ended Norwegian road-rules practice game. Drive wherever you choose through randomized intersections, with Norwegian Bokmål feedback on yielding and lane position.

## Randomized free driving

- No lesson sequence, assigned destination, marked target, prescribed turn, or completion checklist.
- Every junction randomly varies right-hand priority versus signed yield, traffic approaches, turn intentions, spacing, speeds, car count, colours, and body styles.
- Take any legal exit. A safe passage continues automatically into another randomized junction; the session counts crossings without imposing a route.
- The same-junction retry uses the original seed to reproduce the rules and traffic exactly. “Nytt tilfeldig kryss” starts a fresh arrangement.
- Continuous car-relative steering, a soft lane guide with slack, independent world position/heading/wheel angle, and recoverable lane warnings. The guide responds to observed steering and indicators, never to a destination.
- A heading-up following camera with a fixed overview option, animated indicators, brake lights, visible steering, and simultaneous touch driving controls.
- Unobstructed pause and failure views. The road stays visible, affected cars get simple outlines, and feedback/retry controls stay beside the map.
- Amber warnings for developing tight gaps and early pressure on other drivers; collisions and clear unsafe entries/forced hard braking freeze the exact incident frame.
- All drivers follow reciprocal right-hand, signed-yield, and opposing-left-turn rules. NPCs brake, yield, resume, and queue. Their decisions use signals and actual vehicle movement.

This remains a simplified traffic simulation. Driver response timing is deterministic; randomized hesitation and driver personalities are future work. Traffic lights, roundabouts, pedestrians, and cyclists are not simulated yet. Junction geometry is currently the same four-way layout; the rule and traffic arrangement are randomized. Safe exit transitions reframe the next junction ahead while preserving speed, wheel angle, lateral lane offset, and heading relative to the new road.

## Run locally

Use Node.js 22.18 or newer.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
```

The static production build is written to `dist/`. `npm run build:core` emits a standalone JavaScript module and TypeScript declarations in `dist-core/`, without React or browser dependencies. See [the porting guide](docs/PORTING.md) for the input/event/snapshot contract and a host-loop example. No backend, account, or API key is needed to run locally. Practice state is kept in memory for the current session. System font fallbacks are available when Google Fonts is unavailable.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Hold to accelerate |
| S / Down | Hold to brake |
| A / Left | Hold to steer left relative to the car |
| D / Right | Hold to steer right relative to the car |
| Q / E | Toggle left / right indicator |
| Space | Pause / resume |
| Escape | Pause or close help |

Release A/D to let the steering wheel centre. Bounded assistance gives gentle corrections without snapping the car to a lane. You can still oversteer, understeer, cross the centre line, or leave the road. W never changes direction. Use the steering, indicator, and accelerator/brake buttons on touch devices. Turn signals cancel after a completed turn.

## Structure and portability

- `src/core/`: dependency-free simulation, typed plain-data state, fixed-step timing, physics, cached geometry, seeded generation, traffic policy, evaluation, collision detection, and structured events.
- `src/ui/`: SVG road renderer, keyboard/seed adapter, camera conversion, and Norwegian display text.
- `src/main.tsx`: React host loop and interface. Core physics runs at 60 Hz; visual updates are capped at 30 Hz, with static road geometry memoized.
- `src/engine.ts`, `src/driving.ts`: compatibility entry points for earlier callers.
- `tests/engine.test.ts`: behavior and regression coverage, including warning/failure thresholds, exact frozen scene capture, pause, deterministic state transfer, renderer frame-rate independence, and engine boundary checks.
- `docs/PORTING.md`: standalone build, host integration, units, event evidence, deterministic replay, and current scene limitations.

Warnings permit correction and expire in simulation time. Actual hindering of priority traffic is not described as legally harmless: the model distinguishes developing pressure from immediate unsafe entry or forced hard braking. These are training heuristics. Failure frames contain all vehicle poses from the same step and remain unchanged until retry. Event history is capped, warning events are deduplicated, and geometry and per-step motion predictions are shared.

## Rule sources

Rule wording was checked on 8 November 2026 against primary sources:

- [Trafikkreglene § 7 — Vikeplikt](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§7).
- [Trafikkreglene § 14 — Signal og tegn](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§14).
- [Skiltforskriften § 6 — sign 202](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§6).
- [Statens vegvesen — traffic rules](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/).

## Next increments

1. Tune steering, soft assistance, and the following camera from playtesting.
2. More road geometries, STOP signs, and priority roads.
3. Traffic lights with turning conflicts and proper signal sequences.
4. Single-lane roundabouts with entry yielding and indicator guidance.
5. Pedestrians, cyclists, driveways, obstructions, and buses leaving stops.
6. Randomized hesitation and driver behaviour.
