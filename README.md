# Yield

Learn basic Norwegian yielding rules by driving through short, interactive road scenarios. The interface and lessons are in Norwegian Bokmål.

## First playable version

- A top-down SVG intersection with Norwegian markings, randomized traffic colours and vehicle shapes, brake lights, and animated indicators.
- Three exercises: priority from the right, left turns across oncoming traffic, and signed yield from both directions.
- Lane and turning assistance. The player controls acceleration, braking, route choice, and indicators; assistance never makes yielding decisions.
- Gap evaluation based on time to a shared conflict point, collision checks, feedback, exact-situation retries, and new traffic variants.
- Pause, visual route hints, local completion progress, responsive layout, and touch accelerator/brake controls.

This is an early learning prototype. The gap evaluator uses a simplified constant-speed prediction with a vehicle-clearance margin, rather than a complete traffic simulation. Traffic lights, roundabouts, pedestrians, and cyclists are planned but are not simulated in this version.

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
| W / Up | Accelerate |
| S / Down | Brake |
| A / Left | Select a left turn; press again to select straight |
| D / Right | Select a right turn; press again to select straight |
| Q / E | Toggle left / right indicator |
| Space | Pause / resume |
| Escape | Pause or close help |

Choose a turn before reaching the intersection. Steering then follows the selected lane through a smooth curve. Use the route buttons and accelerator/brake buttons on touch devices.

## Structure

- `src/engine.ts`: seeded traffic, lane geometry, car motion, conflict prediction, and lesson outcomes. Independent of React and the DOM.
- `src/main.tsx`: SVG scene, controls, lesson selection, help, and feedback.
- `src/style.css`: responsive interface and map presentation.
- `tests/engine.test.ts`: safe waiting, unsafe entry, clear-gap completion, pause/braking, deterministic retries, route geometry, and mission completion.
- `.openai/hosting.json`: private playable-preview hosting configuration.

## Rule sources

Lesson wording was checked on 8 November 2026 against primary sources:

- [Trafikkreglene § 7 — Vikeplikt](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§7): show yielding in good time, traffic from the right, and turning left across opposing traffic.
- [Skiltforskriften § 6 — sign 202](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§6): yield to traffic in both directions on the crossing road.
- [Statens vegvesen — traffic rules](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/).

The game describes its simplified decision checks as practice feedback; it does not claim to certify driving competence.

## Next increments

1. Refine driving feel and gap feedback from playtesting; add approach/replay explanations.
2. STOP and priority-road scenarios, including cases where the player has priority and other vehicles yield.
3. Traffic-light state machine: red, red/amber, green, amber, all-red clearance, and permitted turning conflicts.
4. Single-lane roundabouts with entry yielding, exit choice, and indicator guidance.
5. Pedestrians, cyclists, driveways, obstructions, and buses leaving stops.
6. More seeded traffic patterns, reduced hints, mixed practice, and scenario-specific progression.
