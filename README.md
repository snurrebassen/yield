# Yield

Learn basic Norwegian yielding rules by driving through short, interactive road scenarios. The interface and lessons are in Norwegian Bokmål.

## Current version — reciprocal yielding

- A top-down SVG intersection with Norwegian markings, randomized traffic colours and vehicle shapes, brake lights, and animated indicators.
- Four exercises: priority from the right, left turns across oncoming traffic, signed yield from both directions, and a scenario where the other drivers must yield to you.
- Lane and turning assistance. The player controls acceleration, braking, route choice, and indicators; assistance never makes yielding decisions.
- Reciprocal priority rules for every driver, smooth braking and resuming, queues, turning NPCs with indicators, and brake lights.
- Sustained, matching indicators refine how other drivers predict your route. Unclear or misleading signals keep them cautious; a turn signal never overrides priority.
- Swept-path conflict and merge checks, collision checks, feedback, exact-situation retries, and new traffic variants.
- Pause, visual route hints, local completion progress, responsive layout, and touch accelerator/brake controls.

This is an early learning prototype. The traffic model predicts shared crossing/merging points with a vehicle-clearance margin and deterministic response timing. It does not yet model randomized hesitation or driver personalities. Traffic lights, roundabouts, pedestrians, and cyclists are planned but are not simulated in this version.

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
| W / Up | Select straight before route lock; hold to accelerate |
| S / Down | Brake |
| A / Left | Select a left turn |
| D / Right | Select a right turn |
| Q / E | Toggle left / right indicator |
| Space | Pause / resume |
| Escape | Pause or close help |

Hold W to accelerate, then press A or D while approaching to choose a turn. Releasing and pressing W again selects straight while the route is still unlocked. Choose a turn before reaching the intersection. Steering then follows the selected lane through a smooth curve. Use the route, indicator, and accelerator/brake buttons on touch devices. Indicators switch off after a completed turn.

## Structure

- `src/engine.ts`: seeded traffic, lane geometry, car motion, conflict prediction, and lesson outcomes. Independent of React and the DOM.
- `src/main.tsx`: SVG scene, controls, lesson selection, help, and feedback.
- `src/style.css`: responsive interface and map presentation.
- `tests/engine.test.ts`: safe waiting, unsafe entry, clear-gap completion, pause/braking, deterministic retries, route geometry, mutual NPC/player yielding, NPC-to-NPC yielding, queue spacing, indicator interpretation, and controls.
- `.openai/hosting.json`: private playable-preview hosting configuration.

## Rule sources

Lesson wording was checked on 8 November 2026 against primary sources:

- [Trafikkreglene § 7 — Vikeplikt](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§7): show yielding in good time, traffic from the right, and turning left across opposing traffic.
- [Trafikkreglene § 14 — Signal og tegn](https://lovdata.no/dokument/SF/forskrift/1986-03-21-747/§14): turn signals guide other road users.
- [Skiltforskriften § 6 — sign 202](https://lovdata.no/dokument/SF/forskrift/2005-10-07-1219/§6): yield to traffic in both directions on the crossing road.
- [Statens vegvesen — traffic rules](https://www.vegvesen.no/trafikkinformasjon/trafikksikkerhet/trafikkregler/).

The game describes its simplified decision checks as practice feedback; it does not claim to certify driving competence.

## Next increments

1. Refine driving feel and gap feedback from playtesting; add approach/replay explanations.
2. STOP and priority-road scenarios, building on reciprocal yielding and the current player-priority exercise.
3. Traffic-light state machine: red, red/amber, green, amber, all-red clearance, and permitted turning conflicts.
4. Single-lane roundabouts with entry yielding, exit choice, and indicator guidance.
5. Pedestrians, cyclists, driveways, obstructions, and buses leaving stops.
6. Randomized hesitation and driver behaviour, more seeded traffic patterns, reduced hints, mixed practice, and scenario-specific progression.
