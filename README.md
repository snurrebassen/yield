# Yield

An open-ended Norwegian road-rules practice game. Drive wherever you choose through randomized intersections, with Norwegian Bokmål feedback on yielding and lane position.

## Randomized free driving

- No lesson sequence, assigned destination, marked target, prescribed turn, or completion checklist.
- A streamed, seeded road graph prefetches two junction links around the player. Curved roads connect four-way junctions, T-junctions, signed side roads, priority roads and single-lane roundabouts. Signs 202, 206, 208, 362 and 406 and yield markings describe the local rule.
- Take any legal exit and physically continue to the next junction in the same coordinates. The session counts passages without imposing a route.
- Retry restores an approach checkpoint, including the nearby world and traffic. “Ny tilfeldig verden” starts a fresh seed.
- A compact sidebar with collapsible rule details. Pause preserves its layout; traffic density (none/low/normal/high) applies only when restarting the world, while a checkpoint retry keeps its original traffic.
- Signed 30/40/50/60 km/h limits along roads and junction approaches. The dashboard shows the current limit and turns the speed reading red above it. Player speed can reach 70 km/h; signs do not automatically brake the player. NPC cruising respects road limits and slows before junctions.
- Continuous car-relative steering, a soft lane guide with slack, independent world position/heading/wheel angle, and recoverable lane warnings. The guide responds to observed steering and indicators, never to a destination.
- A heading-up following camera with a north-up overview centred on the player, animated indicators, brake lights, visible steering, and simultaneous touch driving controls.
- Unobstructed pause and failure views. Short situation warnings stay anchored above/below the player car; the sidebar retains the full explanation and retry controls. Static instructional boxes remain absent from the road.
- Amber warnings for developing tight gaps and early pressure on other drivers; collisions and clear unsafe entries/forced hard braking freeze the exact incident frame.
- All drivers follow reciprocal right-hand, signed-yield, and opposing-left-turn rules. NPCs brake, yield, resume, and queue. Their decisions use signals and actual vehicle movement.
- World junctions reserve passage one car at a time. Circular right-hand waits receive a persistent courtesy release after a pause, while player priority and physical clearance remain checked. The legacy isolated-junction harness also retains coordinated backing. No visible car disappears or teleports to clear a jam.
- H or the horn button emits a short horn with expanding visual rings. Selected waiting drivers can honk when they expect priority. Sound can be muted while retaining the rings. A horn never changes the yielding rules.

This remains a simplified traffic simulation. Junction admission is conservative: roundabouts currently reserve the junction for one NPC at a time rather than allowing full multi-car circulation. Side roads are two-way roads; narrow private driveways, traffic lights, pedestrians and cyclists are future work. Driver hesitation and personalities are not randomized yet. The network uses a jittered cell topology with varied junction angles and cubic road curves, not arbitrary terrain-aware road routing.

Traffic keeps stable IDs and path progress across links. Near cars update at 60 Hz, offscreen cars beyond 1,250 units advance at 5 Hz, and only cars within 1,050 units are drawn. Distant cars are removed beyond 3,500 units. The graph is capped at 28 nodes / 36 links / 72 cars, with cached geometry and memoized SVG road components. Headless timing is not a browser frame-rate guarantee.

## Run locally

Use Node.js 22.18 or newer.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run bench:world
npm run bench:world -- high
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
| H | Horn with a visible circle wave |
| Space | Pause / resume |
| Escape | Pause or close help |

Release A/D to let the steering wheel centre. Bounded assistance gives gentle corrections without snapping the car to a lane. You can still oversteer, understeer, cross the centre line, or leave the road. W never changes direction. Use the steering, indicator, and accelerator/brake buttons on touch devices. Turn signals cancel after a completed turn.

## Structure and portability

- `src/core/`: dependency-free simulation, typed plain-data state, fixed-step timing, physics, cached geometry, seeded generation, traffic policy, evaluation, collision detection, and structured events.
- `src/ui/`: SVG road renderer, keyboard/seed adapter, camera conversion, and Norwegian display text.
- `src/main.tsx`: React host loop and interface. Core physics runs at 60 Hz; visual updates are capped at 30 Hz, with static road geometry memoized.
- `src/engine.ts`, `src/driving.ts`: compatibility entry points for earlier callers.
- `tests/world.test.ts`: streamed graph continuity, culling budgets, curved lanes, roundabout geometry/priority, traffic persistence, courtesy release and world state transfer.
- `scripts/benchmark-world.ts`: repeatable 8,000-hop traversal and 80-seed traffic/performance stress check.
- `tests/engine.test.ts`: behavior and regression coverage, including warning/failure thresholds, exact frozen scene capture, pause, deterministic state transfer, renderer frame-rate independence, and engine boundary checks.
- `docs/PORTING.md`: standalone build, host integration, units, event evidence, deterministic replay, and current scene limitations.

Warnings permit correction and expire in simulation time. Actual hindering of priority traffic is not described as legally harmless: the model distinguishes developing pressure from immediate unsafe entry or forced hard braking. These are training heuristics. Failure frames contain all vehicle poses from the same step and remain unchanged until retry. Event history is capped, warning events are deduplicated, and geometry and per-step motion predictions are shared.

## Rule sources

Rule wording was checked on 8 November 2026 against primary sources:

- [Trafikkreglene § 7 — Vikeplikt](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§7).
- [Trafikkreglene § 14 — Signal og tegn](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§14).
- [Skiltforskriften § 8 — speed limit sign 362](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§8).
- [Skiltforskriften § 6 — signs 202, 206 and 208](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§6).
- [Statens vegvesen — traffic rules](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/).

- [Statens vegvesen — roundabouts](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/kjoring-i-rundkjoringer/).

## Next increments

1. Tune steering, soft assistance, and the following camera from playtesting.
2. Narrow driveways, STOP signs and richer roadside scenery.
3. Traffic lights with turning conflicts and proper signal sequences.
4. Multiple simultaneous circulating vehicles and more selective conflict reservations.
5. Pedestrians, cyclists, driveways, obstructions, and buses leaving stops.
6. Randomized hesitation and driver behaviour.

## Mobile driving

Hold a finger on the road to accelerate; drag left/right from the initial touch point for analogue steering. Drag down to reverse (up to 12 km/h); release to brake to a stop. Changing between forward and reverse first brakes through zero. Touch uses the heading-up camera, captures one pointer and clears on cancellation, focus loss, pause or hidden page. The layout adapts to portrait/landscape touch devices; indicators, horn and settings remain separate controls.
