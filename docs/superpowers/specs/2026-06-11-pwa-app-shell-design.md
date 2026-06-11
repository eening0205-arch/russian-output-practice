# PWA App Shell Design

Date: 2026-06-11

## Goal

Make the Russian output practice project feel like a phone program without using the Apple App Store.

## Behavior

- The public GitHub Pages app remains the entry point.
- iPhone users can add it to the home screen.
- The app opens in standalone mode where supported.
- The app caches the shell, weekly data, and standard audio for offline use.
- Bottom navigation exposes four app areas:
  - `练习`: the existing output-first practice flow.
  - `复练`: items currently in the unknown/retry queue.
  - `总库`: all weekly sentences with known/review status and unknown counts.
  - `设置`: installation and offline status notes.

## Data

The first PWA version still stores practice progress locally in browser storage:

- known items
- retry queue
- sentence stats such as unknown count and last review time

Cloud synchronization remains a later step. The PWA app shell does not introduce unsafe browser-side GitHub tokens.

## Assets

The app includes:

- `manifest.webmanifest`
- `sw.js`
- `offline.html`
- PNG app icons at 192 and 512 pixels
- SVG favicon

## Testing

Unit/static tests verify install metadata, service worker cache contents, app navigation hooks, icon directory copying, and the existing answer-hidden behavior.
