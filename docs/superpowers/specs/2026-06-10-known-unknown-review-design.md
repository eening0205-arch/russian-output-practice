# Known/Unknown Review Flow Design

Date: 2026-06-10

## Goal

Add a fast self-assessment flow for mobile practice. The learner can mark an exercise as known or unknown after attempting the Russian output.

## Behavior

- `不知道` keeps the current exercise in a retry queue, reveals the standard answer for study, and does not count the exercise as done.
- `知道` marks the current exercise as known, removes it from the retry queue, counts it as done, and advances to the next available exercise.
- When the normal exercise sequence reaches the end, queued unknown exercises appear again.
- A retry exercise hides any previously revealed answer when it returns, so the learner must attempt the Russian output again.
- The retry queue and known state are stored in browser local storage using keys scoped to this practice pack.

## UI

The existing output-first interface stays unchanged. The new controls appear near the reveal controls:

- `不知道`
- `知道`
- `复练 N`

The exercise list marks retry items separately from done items.

## Testing

Static tests cover the presence of the controls, local storage keys, retry queue functions, and the requirement that retry selection resets previously revealed answers. Browser verification covers the full flow: unknown, continue, known, return to retry, hide answer again, and clear retry on known.
