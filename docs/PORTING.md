# Reusing the simulation

`src/core/` is a dependency-free TypeScript module. It does not import React, SVG, DOM, keyboard APIs, wall clocks, storage, network clients, display text, or unseeded randomness. The current road layout and traffic policy are implemented as separate modules. The web app is one adapter around the core.

## Build a standalone module

```sh
npm ci
npm run build:core
```

`dist-core/` contains ES modules, TypeScript declarations, and package metadata, so the folder can be copied to another JavaScript project directly. Import `dist-core/index.js` in Node, a worker, or another JavaScript game host. Other languages can reuse the JSON schemas, deterministic seed/input logs and algorithms, or embed a JavaScript runtime; the compiled module is not a native Unity/Godot binary.

## Host loop

```js
import {
  createState, createClock, advanceSimulation, setPaused, toggleIndicator,
  captureFrame, soundHorn,
} from './dist-core/index.js';

const state = createState(12345); // seed is explicit and deterministic
const clock = createClock();
state.phase = 'driving';

function update(elapsedSeconds, controls) {
  advanceSimulation(state, clock, elapsedSeconds, {
    gas: controls.accelerating,
    brake: controls.braking,
    steer: controls.steerAxis, // -1 left, 0 neutral, +1 right; car-relative
  });
  render(captureFrame(state), state.warning, state.failure, state.horns);
}

setPaused(state, true);
setPaused(state, false);
toggleIndicator(state, 'left'); // calling again cancels; right switches sides
soundHorn(state); // player horn; audio/rendering remain host responsibilities
```

Physics runs at 60 fixed steps per second. The clock caps catch-up to 250 ms per host call and drops paused elapsed time. Rendering may run at any frequency. The web adapter renders at up to 30 fps and memoizes static road geometry.

Coordinates are logical scene units, Y points downward, heading 0 points up, and positive heading/steering turn clockwise/right. Speed is logical units per second; the current UI maps 88 units/s to 30 km/h. A new renderer supplies its own coordinate and camera conversion. The core does not own a camera.

## Modules

| Module | Responsibility |
| --- | --- |
| `types.ts` | Plain-data state, inputs, events and snapshots |
| `state.ts`, `scenario.ts` | Seeded junction creation, pause-independent state and continuation |
| `geometry.ts` | Cached lane paths, segment bounds, crossing and merge geometry |
| `physics.ts` | Free player motion, soft steering assistance, projections and lane status |
| `traffic.ts` | Reciprocal priority, NPC target speeds, queues and shared step predictions |
| `recovery.ts` | Waiting-cycle detection, priority-aware coordination, rear-path checks and safe backing with followers |
| `horn.ts` | Rate-limited player/NPC horn pulses, independent of sound hardware |
| `evaluation.ts` | Warning versus failure decisions based on observed motion and reactions |
| `collision.ts` | Oriented vehicle-rectangle overlap |
| `events.ts` | Warning deduplication, bounded history, pause and immutable failure captures |
| `simulation.ts`, `clock.ts` | Ordered simulation steps and host timing adapter |

The scene is currently a four-way junction. Porting the renderer does not require changing the simulation. Supporting a different road layout requires changing the geometry, lane classifier, spawn/exit rules and visual map together; the code does not pretend those coordinates are already a generic road-network editor.

## Events and reviewing a failure

The renderer translates stable event codes into UI text. `src/ui/messages.ts` is the Norwegian web adapter's copy. Event records contain an ID, step number, junction-local time, seed, severity, code, actor IDs, optional world point, and numerical evidence. Player ID is `-1`; NPC IDs are local to the junction.

- `yield-caution`: a developing tight gap, without stopping the simulation.
- `priority-pressure`: cautious braking in response to the player's approach, before a confirmed junction obstruction.
- `yield-violation`: an immediate conflict after entry or forced hard braking by priority traffic.
- `collision`: overlapping oriented vehicle bodies at the same simulation instant.
- `wrong-lane` / `off-road`: driving-control failures, reported separately from collision/priority evidence.

Warnings are deduplicated, expire in simulation time, and permit correction. Actual hindering of priority traffic is not declared legally harmless: this training model distinguishes early pressure from an established unsafe entry/forced hard-braking event. Thresholds live in `evaluation.ts` and are game heuristics, not a complete legal adjudicator.

On failure, `state.phase` becomes `failed` and `state.failure.scene` contains a copied, consistent scene from that exact step. Every car has already been advanced to that instant. Further updates, pause/resume attempts and indicator input do not move the failed scene. The UI highlights the event's actors and shows the explanation outside the road view.

## Save, resume and deterministic checks

State, events and snapshots are JSON-compatible data. A host may transfer `JSON.stringify(state)` and resume a parsed state with a fresh clock. Geometry/prediction caches are derived data outside state; they do not need transfer. To preserve fractional host time exactly, transfer `clock.accumulator` too. Record initial seed, fixed-step inputs and indicator changes for a replay.

Event history is capped at 64 records, warning cooldowns reset at each junction, geometry/segment lengths are cached, intersection tests use bounding-box rejection, and the player's future path is predicted once per simulation step and shared by traffic and evaluation.

Run `npm test` for warning/failure boundaries, exact freeze frames, pause, collision geometry, frame-rate independence, state transfer, driving and reciprocal yielding.

## Queues, deadlocks and horns

Ordinary queues are allowed. Recovery only starts after a group of stopped NPCs has formed a circular waiting dependency for 2.5 seconds. It prefers the vehicle with fewer yielding obligations, checks complete swept paths, and may ask other vehicles and their queued followers to reverse slowly. A car that can safely clear without backing may be released directly. Recovery never moves the player, removes vehicles, or authorizes overlap. Each live step rechecks clearance, including a player moving into a previously free space. A stalled plan times out and is re-evaluated; if no physical escape is safe, cars continue waiting and retry as space changes. A legally waiting queue that ends at the player is not treated as a deadlock.

`state.recovery`, car `stoppedFor`, `blockedBy`, and `reversing` fields are plain transfer data. NPC reversing uses negative speed along its own lane path. Pause freezes the manoeuvre; JSON transfer preserves it. The existing exact failure capture remains separate from traffic coordination.

`state.horns` contains bounded, short-lived `{id, actorId, startedAt}` pulses. `hornSequence` stays monotonic across junctions. `soundHorn(state)` requests the player's horn, with a cooldown; NPCs may emit a pulse after waiting when they expect priority. A horn can request a fresh deadlock check, but does not change legal priority or skip the clearance checks. Render expanding rings at the actor pose, and optionally synthesize sound in the host. The web adapter uses Web Audio after a user gesture and includes a mute toggle; neither Web Audio nor its timers enter the reusable core.

`src/ui/feedback.ts` maps situation codes to short car-adjacent labels and screen positions. These labels are kept upright outside the rotating world transform; expanded Norwegian explanations remain in the sidebar.
