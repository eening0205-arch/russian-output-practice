# Russian Output Practice Design

Date: 2026-06-09

## Goal

Build a Russian speaking-output practice page that trains the user to produce Russian from Chinese prompts before seeing the model answer.

The first weekly theme is "俄语日常表达". Future weeks can switch to another direction, such as work communication, logistics, academic defense, meeting speech, or travel and daily life.

## Confirmed User Decisions

- The content should be AI-generated.
- The app should use one theme or direction per week.
- The first theme is daily Russian expressions.
- Vocabulary should come from the user's recent Apple Notes Russian word lists and the "鹅语菌/eyujun" wordbook data.
- The standard Russian answer must not be shown immediately. It appears only after the user has tried speaking and clicks "显示答案".

## Vocabulary Sources

Use local vocabulary exports before reading raw Apple Notes again:

- Latest eyujun wordbook export: `/Users/weiwei/Ning/outputs/eyujun/nin-knig-words-after-daily-notes-2026-06-09.csv`
- Latest eyujun wordbook JSON: `/Users/weiwei/Ning/outputs/eyujun/nin-knig-words-after-daily-notes-2026-06-09.json`
- Current wordbook size: 1058 words or short phrases.
- Historical Apple Notes scan: `/Users/weiwei/Ning/outputs/eyujun/apple-notes-russian-word-scan-2026-05-26.csv`
- Relevant Apple Notes titles observed include `Слово`, `10 月单词`, `9 月单词`, `俄语单词11月`, `俄语单词 12 月`, `俄语短句`, and `莱特俄语`.

Raw Apple Notes scanning should be limited to Russian vocabulary notes and should not read unrelated notes.

## Training Flow

Each exercise starts with only a Chinese prompt.

Example:

```text
我现在有点忙，晚点回复你。
```

The user first says the Russian aloud. They can optionally record themselves.

Before answer reveal, the page may show controls only:

- `开始录音`
- `显示关键词`
- `显示答案`
- previous / next
- mark done

The answer area is hidden by default. After clicking `显示答案`, the page shows:

- standard Russian sentence
- key vocabulary used
- short Chinese explanation of why the Russian is natural
- audio playback

The standard audio should also be unavailable before answer reveal, because playing it would reveal the answer indirectly.

Example revealed answer:

```text
Я сейчас немного занята, отвечу позже.
```

Keywords:

```text
занята · отвечу · позже
```

## Weekly Pack Structure

Generate a static weekly practice pack rather than live generation inside the public webpage.

Each weekly pack should contain about 20 exercises. The generator should select 30-60 relevant vocabulary items from the available wordbook data and produce short, natural daily-expression prompts.

Each generated exercise should include:

- `id`
- Chinese prompt
- standard Russian answer
- keywords
- source vocabulary ids or words
- short Chinese explanation
- difficulty
- audio path

The page should continue to run on GitHub Pages as static HTML, CSS, JavaScript, JSON, and MP3 files.

## UI Behavior

The first screen should be the actual practice interface, not a landing page.

The earlier shadowing page can be used as a structural reference, but this project should own its own static assets:

- left list of exercise items
- main practice panel
- audio player
- speed selector
- loop and auto-next controls
- done tracking in local storage
- browser recording and playback

Required changes for output practice:

- show Chinese prompt prominently
- hide Russian answer by default
- hide keywords by default or show them only after clicking `显示关键词`
- reveal answer only after clicking `显示答案`
- keep answer visible for the current exercise after reveal
- use dedicated local storage keys prefixed with `russian-output-practice`
- show weekly theme and pack metadata

## Data Flow

1. Read vocabulary export from eyujun output files.
2. Filter and group vocabulary by weekly theme.
3. Generate a weekly exercise manifest.
4. Generate Edge TTS audio for each Russian answer.
5. Write static assets:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `segments.js` or `practice.js`
   - `data/practice.json`
   - `audio/*.mp3`
6. Open locally for verification.
7. Optionally sync to GitHub Pages.

## Error Handling

- If a selected vocabulary item has no usable translation, skip it or mark it for review.
- If a generated Russian answer is too formal, too long, or not daily-speech-like, reject it during generation.
- If Edge TTS fails for a sentence, keep the exercise but mark audio as missing and show a clear disabled state.
- If the browser cannot record audio, keep the rest of the practice flow usable.
- If no weekly pack is available, show an empty-state message with the expected data file path.

## Testing

Focused tests should cover:

- vocabulary export loading and normalization
- weekly exercise manifest shape
- answer-hidden initial state
- reveal answer behavior
- keyword reveal behavior
- local storage does not collide with other practice pages
- existing audio playback and recording controls still initialize

Manual browser verification should cover:

- desktop and mobile layout
- answer is not visible before reveal
- audio plays after reveal
- recording and playback work on HTTPS or local browser where supported

## Out of Scope For First Version

- live AI generation from the public webpage
- backend server
- API keys in the browser
- automatic pronunciation scoring
- full spaced repetition scheduling
- automatic upload back into Apple Notes or eyujun

## Open Follow-Up

After this design is accepted, the next step is an implementation plan for a static weekly pack generator and an output-first practice page.
