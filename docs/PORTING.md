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
  captureFrame,
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
  render(captureFrame(state), state.warning, state.failure);
}

setPaused(state, true);
setPaused(state, false);
toggleIndicator(state, 'left'); // calling again cancels; right switches sides
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
