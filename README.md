# Yield

Learn basic Norwegian yielding rules by driving through short, interactive road scenarios. The interface and lessons are in Norwegian Bokmål.

## Current version — free steering and a car-relative camera

- A top-down SVG intersection with Norwegian markings, randomized traffic colours and vehicle shapes, brake lights, and animated indicators.
- Four exercises: priority from the right, left turns across oncoming traffic, signed yield from both directions, and a scenario where the other drivers must yield to you.
- Continuous car-relative steering: hold A/D at any point, including through and after the junction. W/S only control speed.
- A bicycle-model car with independent world position, heading, and wheel angle. A bounded steering guide provides gentle corrections with a lateral dead band; the player can oversteer, understeer, cross into the opposing lane, or leave the road.
- A car-following, heading-up camera by default, with a fixed overview toggle. A large green destination zone and a bearing-correct off-screen pointer mark the target exit.
- Lane-departure feedback, steerable front wheels, and touch controls for steering, acceleration, braking, and indicators.
- Reciprocal priority rules for every driver, smooth braking and resuming, queues, turning NPCs with indicators, and brake lights.
- Sustained indicators and observed movement refine how other drivers predict your route; the exercise goal remains private to the player. Unclear or misleading signals keep them cautious; a turn signal never overrides priority.
- Swept-path conflict and merge checks, collision checks, feedback, exact-situation retries, and new traffic variants.
- Pause, visual route hints, local completion progress, responsive layout, and touch accelerator/brake controls.

This is an early learning prototype. The traffic model predicts shared crossing/merging points with a vehicle-clearance margin and deterministic response timing. NPCs follow lane paths; the player moves freely. Collision and emergency-braking checks use the player’s actual position, and entry checks predict from the player’s current heading and wheel angle. It does not yet model randomized hesitation or driver personalities. Traffic lights, roundabouts, pedestrians, and cyclists are planned but are not simulated in this version.

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

The production build is static and written to `dist/`. No backend, account, or API key is needed. Completion progress is stored on the current device using localStorage. The interface uses system font fallbacks if Google Fonts is unavailable.

## Controls

| Control | Action |
| --- | --- |
| W / Up | Hold to accelerate; never selects a route |
| S / Down | Brake |
| A / Left | Hold to steer left relative to the car |
| D / Right | Hold to steer right relative to the car |
| Q / E | Toggle left / right indicator |
| Space | Pause / resume |
| Escape | Pause or close help |

Hold W to accelerate and A/D to steer continuously. Release A/D to let the steering wheel centre; gentle guidance helps align the car but never snaps its position onto a track. The lesson sets a destination, not a turn command. Drive to the green exit zone in the correct lane. The camera keeps forward at the top of the screen; choose Overview for a fixed map. Touch controls support simultaneous steering and acceleration/braking. Indicators switch off after a completed turn.

## Structure

- `src/engine.ts`: seeded traffic, lane geometry, reciprocal priority, actual-motion conflict prediction, and physical goal detection. Independent of React and the DOM.
- `src/driving.ts`: bicycle-model motion, soft steering guidance, path projection, lane warnings, camera transforms, and off-screen goal bearings.
- `src/main.tsx`: SVG scene, controls, lesson selection, help, and feedback.
- `src/style.css`: responsive interface and map presentation.
- `tests/engine.test.ts`: safe waiting, unsafe entry, clear-gap completion, pause/braking, deterministic retries, route geometry, mutual NPC/player yielding, NPC-to-NPC yielding, queue spacing, indicator interpretation, continuous steering, free-position collisions, recoverable lane departure, physical goal detection, camera transforms, and goal-pointer bearings.
- `.openai/hosting.json`: private playable-preview hosting configuration.

## Rule sources

Lesson wording was checked on 8 November 2026 against primary sources:

- [Trafikkreglene § 7 — Vikeplikt](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§7): show yielding in good time, traffic from the right, and turning left across opposing traffic.
- [Trafikkreglene § 14 — Signal og tegn](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§14): turn signals guide other road users.
- [Skiltforskriften § 6 — sign 202](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§6): yield to traffic in both directions on the crossing road.
- [Statens vegvesen — traffic rules](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/).

The game describes its simplified decision checks as practice feedback; it does not claim to certify driving competence.

## Next increments

1. Tune the continuous steering, soft assistance, and car-relative camera from playtesting; add approach/replay explanations.
2. STOP and priority-road scenarios, building on reciprocal yielding and the current player-priority exercise.
3. Traffic-light state machine: red, red/amber, green, amber, all-red clearance, and permitted turning conflicts.
4. Single-lane roundabouts with entry yielding, exit choice, and indicator guidance.
5. Pedestrians, cyclists, driveways, obstructions, and buses leaving stops.
6. Randomized hesitation and driver behaviour, more seeded traffic patterns, reduced hints, mixed practice, and scenario-specific progression.
