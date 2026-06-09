# Russian Output Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static output-first Russian daily-expression practice pack where Chinese prompts appear first and Russian answers/audio stay hidden until reveal.

**Architecture:** Build this as a standalone static practice project. A Python generator reads weekly exercise data, links it to the eyujun vocabulary export, generates a static manifest and optional Edge TTS audio, then copies a dedicated static web app into a build folder.

**Tech Stack:** Python 3 standard library, optional `edge_tts`, static HTML/CSS/JavaScript, browser `MediaRecorder`, `unittest`.

---

## File Structure

Work from repo root `/Users/weiwei/Documents/russian-output-practice`.

- Create `build_output_practice_pack.py`
  - Generator for output-first practice packs.
  - Loads weekly exercise JSON.
  - Reads eyujun vocabulary CSV/JSON exports.
  - Builds a `window.OUTPUT_PRACTICE` manifest.
  - Optionally generates Edge TTS MP3 from hidden Russian answers.
  - Copies dedicated static web assets into a local build folder.
- Create `output_web/index.html`
  - Static output-practice page shell.
  - Uses Chinese prompt as primary content.
  - Keeps answer panel empty and hidden initially.
- Create `output_web/app.js`
  - Output-first interaction logic.
  - Handles exercise selection, done state, keyword reveal, answer reveal, audio playback after reveal, recording, and local storage.
- Create `output_web/styles.css`
  - Dedicated styles copied from the existing practice page where useful.
  - Adds output-first answer-hidden states and responsive layout.
- Create `output_web/README.md`
  - Explains local build and GitHub Pages use.
- Create `weekly_packs/daily_expression_2026-06-09.json`
  - First weekly generated content: 20 daily-expression exercises.
- Create `tests/test_build_output_practice_pack.py`
  - Unit tests for vocabulary loading, exercise validation, manifest shape, audio path generation, and asset writing.
- Create `tests/test_output_web_static.py`
  - Static web tests for answer-hidden behavior contracts and storage key separation.

Generated build output should go to `build/output_daily_2026-06-09/` by default. Do not commit generated MP3 files until the user explicitly decides to publish the pack.

---

### Task 1: Generator Core Tests

**Files:**
- Create: `tests/test_build_output_practice_pack.py`
- Later modify: `build_output_practice_pack.py`

- [ ] **Step 1: Write failing generator tests**

Create `tests/test_build_output_practice_pack.py`:

```python
import csv
import json
import pathlib
import tempfile
import unittest

from build_output_practice_pack import (
    build_manifest,
    load_weekly_exercises,
    load_wordbook_csv,
    normalize_word,
    validate_exercises,
    write_manifest,
)


class OutputPracticeGeneratorTests(unittest.TestCase):
    def test_normalize_word_removes_stress_marks_and_lowercases(self):
        self.assertEqual(normalize_word("Отве́чу"), "отвечу")
        self.assertEqual(normalize_word("Счёт"), "счет")

    def test_load_wordbook_csv_keeps_minimal_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "words.csv"
            with path.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(
                    f,
                    fieldnames=["wordId", "word", "translation", "partOfSpeech", "difficulty"],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "wordId": "w1",
                        "word": "позже",
                        "translation": "晚点",
                        "partOfSpeech": "副词",
                        "difficulty": "easy",
                    }
                )

            words = load_wordbook_csv(path)

        self.assertEqual(words["позже"]["wordId"], "w1")
        self.assertEqual(words["позже"]["translation"], "晚点")

    def test_load_weekly_exercises_rejects_missing_required_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "weekly.json"
            path.write_text(
                json.dumps(
                    {
                        "theme": "俄语日常表达",
                        "week": "2026-06-09",
                        "exercises": [{"id": "001", "prompt_zh": "我晚点回复你。"}],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError) as ctx:
                load_weekly_exercises(path)

        self.assertIn("answer_ru", str(ctx.exception))

    def test_build_manifest_keeps_answers_available_but_not_initially_revealed(self):
        exercises = [
            {
                "id": "001",
                "prompt_zh": "我现在有点忙，晚点回复你。",
                "answer_ru": "Я сейчас немного занята, отвечу позже.",
                "keywords": ["занята", "отвечу", "позже"],
                "explanation_zh": "自然口语表达，适合先说明状态再说之后回复。",
                "difficulty": "easy",
            }
        ]
        wordbook = {
            "позже": {
                "wordId": "w-later",
                "word": "позже",
                "translation": "晚点",
                "partOfSpeech": "副词",
                "difficulty": "easy",
            }
        }

        manifest = build_manifest(
            exercises,
            wordbook,
            title="俄语输出练习",
            theme="俄语日常表达",
            week="2026-06-09",
            voice="ru-RU-DmitryNeural",
            rate="-15%",
        )

        exercise = manifest["exercises"][0]
        self.assertEqual(manifest["mode"], "output-first")
        self.assertEqual(exercise["audio"], "audio/001.mp3")
        self.assertEqual(exercise["answer_ru"], "Я сейчас немного занята, отвечу позже.")
        self.assertEqual(exercise["initially_revealed"], False)
        self.assertEqual(exercise["source_words"][0]["wordId"], "w-later")

    def test_write_manifest_creates_json_and_browser_script(self):
        manifest = {
            "title": "俄语输出练习",
            "mode": "output-first",
            "theme": "俄语日常表达",
            "week": "2026-06-09",
            "exercises": [],
        }

        with tempfile.TemporaryDirectory() as tmp:
            out_dir = pathlib.Path(tmp)
            manifest_path = write_manifest(out_dir, manifest)

            self.assertTrue(manifest_path.exists())
            self.assertTrue((out_dir / "practice.js").exists())
            self.assertIn(
                "window.OUTPUT_PRACTICE =",
                (out_dir / "practice.js").read_text(encoding="utf-8"),
            )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_build_output_practice_pack.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'build_output_practice_pack'`.

- [ ] **Step 3: Commit failing tests**

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- tests/test_build_output_practice_pack.py
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "test: add output practice generator contract"
```

---

### Task 2: Generator Core Implementation

**Files:**
- Create: `build_output_practice_pack.py`
- Modify: `tests/test_build_output_practice_pack.py` only if imports need path adjustment

- [ ] **Step 1: Implement generator core**

Create `build_output_practice_pack.py`:

```python
#!/usr/bin/env python3
import argparse
import asyncio
import csv
import json
import re
import shutil
import unicodedata
from pathlib import Path


CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
REQUIRED_EXERCISE_FIELDS = {
    "id",
    "prompt_zh",
    "answer_ru",
    "keywords",
    "explanation_zh",
    "difficulty",
}


def normalize_word(text):
    normalized = unicodedata.normalize("NFD", text or "")
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = unicodedata.normalize("NFC", normalized)
    normalized = normalized.replace("ё", "е").replace("Ё", "Е")
    return re.sub(r"\s+", " ", normalized.strip().lower())


def strip_stress_marks_for_tts(text):
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(char for char in decomposed if char not in {"\u0301", "\u0300"})
    return unicodedata.normalize("NFC", stripped)


def load_wordbook_csv(path):
    words = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            word = (row.get("word") or "").strip()
            if not word:
                continue
            words[normalize_word(word)] = {
                "wordId": (row.get("wordId") or "").strip(),
                "word": word,
                "translation": (row.get("translation") or "").strip(),
                "partOfSpeech": (row.get("partOfSpeech") or "").strip(),
                "difficulty": (row.get("difficulty") or "").strip(),
            }
    return words


def load_weekly_exercises(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    exercises = data.get("exercises")
    if not isinstance(exercises, list):
        raise ValueError("weekly pack must contain an exercises list")
    validate_exercises(exercises)
    return data


def validate_exercises(exercises):
    for index, exercise in enumerate(exercises, start=1):
        missing = sorted(field for field in REQUIRED_EXERCISE_FIELDS if field not in exercise)
        if missing:
            raise ValueError(f"exercise {index:03d} missing fields: {', '.join(missing)}")
        if not CJK_RE.search(exercise["prompt_zh"]):
            raise ValueError(f"exercise {exercise['id']} prompt_zh must contain Chinese text")
        if not CYRILLIC_RE.search(exercise["answer_ru"]):
            raise ValueError(f"exercise {exercise['id']} answer_ru must contain Russian text")
        if not isinstance(exercise["keywords"], list) or not exercise["keywords"]:
            raise ValueError(f"exercise {exercise['id']} keywords must be a non-empty list")


def source_words_for_keywords(keywords, wordbook):
    source_words = []
    for keyword in keywords:
        record = wordbook.get(normalize_word(keyword))
        if record:
            source_words.append(record)
        else:
            source_words.append(
                {
                    "wordId": "",
                    "word": keyword,
                    "translation": "",
                    "partOfSpeech": "",
                    "difficulty": "",
                }
            )
    return source_words


def build_manifest(exercises, wordbook, title, theme, week, voice, rate):
    validate_exercises(exercises)
    return {
        "title": title,
        "mode": "output-first",
        "theme": theme,
        "week": week,
        "voice": voice,
        "rate": rate,
        "storageKey": f"russian-output-practice-{week}",
        "exercises": [
            {
                "id": exercise["id"],
                "prompt_zh": exercise["prompt_zh"],
                "answer_ru": exercise["answer_ru"],
                "keywords": exercise["keywords"],
                "explanation_zh": exercise["explanation_zh"],
                "difficulty": exercise["difficulty"],
                "source_words": source_words_for_keywords(exercise["keywords"], wordbook),
                "audio": f"audio/{exercise['id']}.mp3",
                "initially_revealed": False,
            }
            for exercise in exercises
        ],
    }


def copy_web_assets(project_dir, out_dir):
    web_src = project_dir / "output_web"
    for source in web_src.iterdir():
        if source.is_file() and source.name != "practice.js":
            shutil.copy2(source, out_dir / source.name)


def write_manifest(out_dir, manifest):
    data_dir = out_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    manifest_json = json.dumps(manifest, ensure_ascii=False, indent=2)
    manifest_path = data_dir / "practice.json"
    manifest_path.write_text(manifest_json, encoding="utf-8")
    (out_dir / "practice.js").write_text(
        "window.OUTPUT_PRACTICE = " + manifest_json + ";\n",
        encoding="utf-8",
    )
    return manifest_path


async def synthesize_exercise_audio(exercises, audio_dir, voice, rate, overwrite):
    import edge_tts

    audio_dir.mkdir(parents=True, exist_ok=True)
    for exercise in exercises:
        output_path = audio_dir / f"{exercise['id']}.mp3"
        if output_path.exists() and not overwrite:
            print(f"skip existing {output_path.name}")
            continue
        print(f"generate {output_path.name}")
        communicate = edge_tts.Communicate(
            strip_stress_marks_for_tts(exercise["answer_ru"]),
            voice=voice,
            rate=rate,
        )
        await communicate.save(str(output_path))


def parse_args():
    parser = argparse.ArgumentParser(description="Build an output-first Russian practice pack.")
    parser.add_argument(
        "--weekly-pack",
        type=Path,
        default=Path("weekly_packs/daily_expression_2026-06-09.json"),
        help="Weekly exercise JSON file.",
    )
    parser.add_argument(
        "--wordbook",
        type=Path,
        default=Path("/Users/weiwei/Ning/outputs/eyujun/nin-knig-words-after-daily-notes-2026-06-09.csv"),
        help="eyujun wordbook CSV export.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("build/output_daily_2026-06-09"),
        help="Output folder for the static practice pack.",
    )
    parser.add_argument("--voice", default="ru-RU-DmitryNeural", help="Edge TTS Russian voice.")
    parser.add_argument("--rate", default="-15%", help="TTS speech rate, for example -15%% or +0%%.")
    parser.add_argument("--overwrite", action="store_true", help="Regenerate existing MP3 files.")
    parser.add_argument("--skip-audio", action="store_true", help="Write text/HTML assets without MP3 generation.")
    return parser.parse_args()


def main():
    args = parse_args()
    project_dir = Path(__file__).resolve().parent
    weekly_path = args.weekly_pack if args.weekly_pack.is_absolute() else project_dir / args.weekly_pack
    out_dir = args.out if args.out.is_absolute() else project_dir / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)

    weekly_pack = load_weekly_exercises(weekly_path)
    wordbook = load_wordbook_csv(args.wordbook)
    exercises = weekly_pack["exercises"]
    manifest = build_manifest(
        exercises,
        wordbook,
        title=weekly_pack.get("title", "俄语输出练习"),
        theme=weekly_pack.get("theme", "俄语日常表达"),
        week=weekly_pack.get("week", "2026-06-09"),
        voice=args.voice,
        rate=args.rate,
    )
    copy_web_assets(project_dir, out_dir)
    manifest_path = write_manifest(out_dir, manifest)

    if not args.skip_audio:
        asyncio.run(synthesize_exercise_audio(exercises, out_dir / "audio", args.voice, args.rate, args.overwrite))

    print(f"exercises: {len(exercises)}")
    print(f"manifest: {manifest_path}")
    print(f"open: {out_dir / 'index.html'}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run generator tests**

Run:

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_build_output_practice_pack.py -v
```

Expected: PASS for all tests in `test_build_output_practice_pack.py`.

- [ ] **Step 3: Commit generator core**

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- \
  build_output_practice_pack.py \
  tests/test_build_output_practice_pack.py
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "feat: add output practice pack generator"
```

---

### Task 3: First Weekly Exercise Pack

**Files:**
- Create: `weekly_packs/daily_expression_2026-06-09.json`
- Test: `tests/test_build_output_practice_pack.py`

- [ ] **Step 1: Add first weekly exercise data**

Create `weekly_packs/daily_expression_2026-06-09.json`:

```json
{
  "title": "俄语输出练习",
  "theme": "俄语日常表达",
  "week": "2026-06-09",
  "exercises": [
    {
      "id": "001",
      "prompt_zh": "我现在有点忙，晚点回复你。",
      "answer_ru": "Я сейчас немного занята, отвечу позже.",
      "keywords": ["занята", "отвечу", "позже"],
      "explanation_zh": "先说明自己现在忙，再说稍后回复，语气自然。",
      "difficulty": "easy"
    },
    {
      "id": "002",
      "prompt_zh": "你来选吧，我都可以。",
      "answer_ru": "Выбирай сам, мне всё подходит.",
      "keywords": ["выбирай", "подходит"],
      "explanation_zh": "用于熟人之间，让对方决定，同时表示自己都可以。",
      "difficulty": "easy"
    },
    {
      "id": "003",
      "prompt_zh": "好，那就这么说定了。",
      "answer_ru": "Хорошо, договорились.",
      "keywords": ["договорились"],
      "explanation_zh": "договорились 是非常常用的口语确认，表示说定了。",
      "difficulty": "easy"
    },
    {
      "id": "004",
      "prompt_zh": "请你给我写一下。",
      "answer_ru": "Напишите мне, пожалуйста.",
      "keywords": ["напишите", "мне", "пожалуйста"],
      "explanation_zh": "礼貌表达，请对方写给自己，适合聊天或工作沟通。",
      "difficulty": "easy"
    },
    {
      "id": "005",
      "prompt_zh": "有什么不对吗？",
      "answer_ru": "Что-то не так?",
      "keywords": ["что-то", "не так"],
      "explanation_zh": "自然口语，用来询问是不是哪里有问题。",
      "difficulty": "easy"
    },
    {
      "id": "006",
      "prompt_zh": "我们明天继续吧。",
      "answer_ru": "Давайте продолжим завтра.",
      "keywords": ["давайте", "продолжим", "завтра"],
      "explanation_zh": "давайте 加动词第一人称复数，表示一起做某事。",
      "difficulty": "easy"
    },
    {
      "id": "007",
      "prompt_zh": "我们晚点再讨论这个。",
      "answer_ru": "Давайте обсудим это позже.",
      "keywords": ["обсудим", "это", "позже"],
      "explanation_zh": "适合暂时不展开话题，推迟讨论。",
      "difficulty": "easy"
    },
    {
      "id": "008",
      "prompt_zh": "说实话，我还不太习惯。",
      "answer_ru": "Скажу честно, я ещё не совсем привыкла.",
      "keywords": ["скажу честно", "ещё", "привыкла"],
      "explanation_zh": "女性说自己还没习惯，用 привыкла；男性改为 привык。",
      "difficulty": "medium"
    },
    {
      "id": "009",
      "prompt_zh": "现在正是时候开始。",
      "answer_ru": "Сейчас самое время начать.",
      "keywords": ["сейчас", "самое время", "начать"],
      "explanation_zh": "самое время 表示正是合适的时候。",
      "difficulty": "easy"
    },
    {
      "id": "010",
      "prompt_zh": "这个今天必须做完。",
      "answer_ru": "Это обязательно нужно сделать сегодня.",
      "keywords": ["обязательно", "нужно", "сделать"],
      "explanation_zh": "обязательно нужно 强调必须做，语气明确。",
      "difficulty": "medium"
    },
    {
      "id": "011",
      "prompt_zh": "请结账。",
      "answer_ru": "Принесите, пожалуйста, счёт.",
      "keywords": ["принесите", "пожалуйста", "счёт"],
      "explanation_zh": "餐厅常用礼貌表达。",
      "difficulty": "easy"
    },
    {
      "id": "012",
      "prompt_zh": "不好意思，可以问你一下吗？",
      "answer_ru": "Простите, можно вас спросить?",
      "keywords": ["простите", "можно", "спросить"],
      "explanation_zh": "开口打扰别人时自然礼貌。",
      "difficulty": "easy"
    },
    {
      "id": "013",
      "prompt_zh": "我现在就做。",
      "answer_ru": "Я сейчас это сделаю.",
      "keywords": ["сейчас", "это", "сделаю"],
      "explanation_zh": "强调马上处理，适合回复任务或请求。",
      "difficulty": "easy"
    },
    {
      "id": "014",
      "prompt_zh": "我回去了。",
      "answer_ru": "Я возвращаюсь.",
      "keywords": ["возвращаюсь"],
      "explanation_zh": "表示正在回去或要回去了，短而自然。",
      "difficulty": "easy"
    },
    {
      "id": "015",
      "prompt_zh": "我希望一切都会正常。",
      "answer_ru": "Я надеюсь, всё будет нормально.",
      "keywords": ["надеюсь", "всё", "нормально"],
      "explanation_zh": "常用安慰或表达期待的句子。",
      "difficulty": "easy"
    },
    {
      "id": "016",
      "prompt_zh": "可以开门吗？",
      "answer_ru": "Можно открыть дверь?",
      "keywords": ["можно", "открыть", "дверь"],
      "explanation_zh": "можно 加不定式，用来礼貌询问是否可以做某事。",
      "difficulty": "easy"
    },
    {
      "id": "017",
      "prompt_zh": "我需要去一下洗手间。",
      "answer_ru": "Мне нужно сходить в туалет.",
      "keywords": ["мне нужно", "сходить", "туалет"],
      "explanation_zh": "日常直接表达，сходить 表示去一下。",
      "difficulty": "easy"
    },
    {
      "id": "018",
      "prompt_zh": "请你留在这里。",
      "answer_ru": "Оставайтесь здесь, пожалуйста.",
      "keywords": ["оставайтесь", "здесь", "пожалуйста"],
      "explanation_zh": "礼貌地请对方留在原地。",
      "difficulty": "medium"
    },
    {
      "id": "019",
      "prompt_zh": "至少需要十分钟。",
      "answer_ru": "Нужно как минимум десять минут.",
      "keywords": ["нужно", "как минимум", "десять минут"],
      "explanation_zh": "как минимум 表示至少，适合估计时间或数量。",
      "difficulty": "easy"
    },
    {
      "id": "020",
      "prompt_zh": "真的吗？这很有意思。",
      "answer_ru": "Правда? Это очень интересно.",
      "keywords": ["правда", "очень", "интересно"],
      "explanation_zh": "用于回应对方信息，表示惊讶和兴趣。",
      "difficulty": "easy"
    }
  ]
}
```

- [ ] **Step 2: Extend tests to load real weekly pack**

Append this test to `OutputPracticeGeneratorTests` in `tests/test_build_output_practice_pack.py`:

```python
    def test_real_weekly_pack_has_twenty_output_first_exercises(self):
        weekly = load_weekly_exercises(pathlib.Path("weekly_packs/daily_expression_2026-06-09.json"))

        self.assertEqual(weekly["theme"], "俄语日常表达")
        self.assertEqual(len(weekly["exercises"]), 20)
        self.assertEqual(weekly["exercises"][0]["prompt_zh"], "我现在有点忙，晚点回复你。")
        self.assertIn("answer_ru", weekly["exercises"][0])
```

- [ ] **Step 3: Run tests**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_build_output_practice_pack.py -v
```

Expected: PASS, including `test_real_weekly_pack_has_twenty_output_first_exercises`.

- [ ] **Step 4: Commit weekly content**

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- \
  weekly_packs/daily_expression_2026-06-09.json \
  tests/test_build_output_practice_pack.py
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "feat: add daily expression output pack"
```

---

### Task 4: Output Practice Static Web Shell

**Files:**
- Create: `output_web/index.html`
- Create: `output_web/styles.css`
- Create: `output_web/README.md`
- Create: `tests/test_output_web_static.py`

- [ ] **Step 1: Write static web contract tests**

Create `tests/test_output_web_static.py`:

```python
import pathlib
import unittest


class OutputWebStaticTests(unittest.TestCase):
    def test_index_has_output_first_controls(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertIn('id="promptText"', html)
        self.assertIn('id="showAnswerButton"', html)
        self.assertIn('id="showKeywordsButton"', html)
        self.assertIn('id="answerPanel"', html)
        self.assertIn('hidden', html)

    def test_app_uses_separate_storage_and_reveal_state(self):
        js = pathlib.Path("output_web/app.js").read_text(encoding="utf-8")

        self.assertIn("russian-output-practice", js)
        self.assertIn("revealedAnswers", js)
        self.assertIn("showAnswer", js)
        self.assertIn("answerPanel.hidden = !isAnswerRevealed", js)
        self.assertIn("playButton.disabled = !isAnswerRevealed", js)

    def test_index_does_not_include_any_static_russian_answer(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertNotIn("Я сейчас немного занята", html)
        self.assertNotIn("Хорошо, договорились", html)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run static web tests to verify they fail**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_output_web_static.py -v
```

Expected: FAIL because `output_web/index.html` and `output_web/app.js` do not exist yet.

- [ ] **Step 3: Create output web HTML**

Create `output_web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>俄语输出练习</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p id="themeLabel" class="eyebrow">Output Practice</p>
          <h1 id="packTitle">俄语输出练习</h1>
        </div>
        <div class="summary">
          <span id="progressText">0 / 0</span>
          <div class="meter" aria-hidden="true"><span id="progressBar"></span></div>
        </div>
      </header>

      <main class="workspace">
        <aside class="segment-pane" aria-label="练习列表">
          <div class="pane-tools">
            <button class="chip is-active" type="button" data-filter="all">全部</button>
            <button class="chip" type="button" data-filter="todo">未练</button>
            <button class="chip" type="button" data-filter="done">已练</button>
          </div>
          <ol id="exerciseList" class="segment-list"></ol>
        </aside>

        <section class="practice-pane" aria-live="polite">
          <div class="segment-meta">
            <span id="exerciseCounter">001</span>
            <button id="doneButton" class="icon-text" type="button">标记已练</button>
          </div>

          <article class="prompt-panel">
            <div class="panel-label">中文题目</div>
            <p id="promptText" class="prompt-zh"></p>
          </article>

          <div class="attempt-panel">
            <div class="recorder-head">
              <span id="recordStatus">先开口说俄语，再看答案</span>
              <div id="recordLight" class="record-light" aria-hidden="true"></div>
            </div>
            <div class="recorder-actions">
              <button id="recordButton" class="icon-text" type="button">开始录音</button>
              <button id="playRecordingButton" class="icon-text" type="button" disabled>回放录音</button>
              <a id="downloadRecording" class="download-link is-disabled" href="#" download>下载</a>
            </div>
            <audio id="recordingPlayer" controls></audio>
          </div>

          <div class="answer-actions">
            <button id="showKeywordsButton" class="icon-text" type="button">显示关键词</button>
            <button id="showAnswerButton" class="primary-button" type="button">显示答案</button>
          </div>

          <article id="keywordPanel" class="keyword-panel" hidden>
            <div class="panel-label">关键词</div>
            <div id="keywordList" class="keyword-list"></div>
          </article>

          <article id="answerPanel" class="answer-panel" hidden>
            <div class="panel-label">标准俄语</div>
            <p id="answerText" class="answer-ru"></p>
            <p id="explanationText" class="explanation-zh"></p>
            <audio id="player" preload="metadata"></audio>
          </article>

          <div class="transport">
            <button id="prevButton" class="icon-button" type="button" title="上一条" aria-label="上一条">‹</button>
            <button id="playButton" class="primary-button" type="button" disabled>播放标准音频</button>
            <button id="nextButton" class="icon-button" type="button" title="下一条" aria-label="下一条">›</button>
          </div>

          <div class="control-grid">
            <label>
              <span>速度</span>
              <select id="speedSelect">
                <option value="0.75">0.75x</option>
                <option value="0.85" selected>0.85x</option>
                <option value="1">1x</option>
                <option value="1.1">1.1x</option>
                <option value="1.25">1.25x</option>
              </select>
            </label>
            <label class="toggle-row">
              <input id="loopToggle" type="checkbox" checked />
              <span>单条循环</span>
            </label>
            <label class="toggle-row">
              <input id="autoNextToggle" type="checkbox" />
              <span>自动下一条</span>
            </label>
          </div>
        </section>
      </main>
    </div>

    <script src="practice.js"></script>
    <script src="app.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Create output web styles**

Create `output_web/styles.css` by starting from `web/styles.css` and applying these exact additions and replacements:

```css
.prompt-panel,
.answer-panel,
.keyword-panel,
.attempt-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 22px 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.panel-label {
  color: var(--gold);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.prompt-zh {
  margin: 0;
  font-size: 32px;
  line-height: 1.36;
  font-weight: 750;
  letter-spacing: 0;
}

.answer-ru {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 30px;
  line-height: 1.38;
  letter-spacing: 0;
}

.explanation-zh {
  margin: 0;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.55;
}

.answer-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.keyword-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.keyword-chip {
  padding: 7px 10px;
  border: 1px solid rgba(35, 105, 75, 0.22);
  border-radius: 8px;
  background: #eef5ef;
  color: var(--accent);
  font-weight: 800;
}
```

Keep the existing responsive media query from `web/styles.css`. In the mobile query, include:

```css
.prompt-zh {
  font-size: 25px;
}

.answer-ru {
  font-size: 25px;
}
```

- [ ] **Step 5: Create output web README**

Create `output_web/README.md`:

```markdown
# Russian Output Practice

Static output-first practice page for Russian daily-expression training.

The page shows Chinese prompts first. Standard Russian answers, explanations, and standard audio remain hidden until the learner clicks `显示答案`.

Build a local pack from the project root:

```bash
python3 build_output_practice_pack.py --skip-audio
```

Build with Edge TTS audio:

```bash
python3 build_output_practice_pack.py --overwrite
```
```

- [ ] **Step 6: Run static tests to confirm expected remaining failure**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_output_web_static.py -v
```

Expected: FAIL because `output_web/app.js` does not exist yet.

- [ ] **Step 7: Commit static shell**

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- \
  output_web/index.html \
  output_web/styles.css \
  output_web/README.md \
  tests/test_output_web_static.py
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "feat: add output practice web shell"
```

---

### Task 5: Output Practice Browser Logic

**Files:**
- Create: `output_web/app.js`
- Test: `tests/test_output_web_static.py`

- [ ] **Step 1: Create output-first JavaScript**

Create `output_web/app.js`:

```javascript
(function () {
  const manifest = window.OUTPUT_PRACTICE;
  const exercises = manifest && Array.isArray(manifest.exercises) ? manifest.exercises : [];
  const baseStorageKey = (manifest && manifest.storageKey) || "russian-output-practice";
  const doneKey = `${baseStorageKey}-done-v1`;
  const speedKey = `${baseStorageKey}-speed-v1`;

  const state = {
    currentIndex: 0,
    filter: "all",
    done: new Set(JSON.parse(localStorage.getItem(doneKey) || "[]")),
    revealedAnswers: new Set(),
    revealedKeywords: new Set(),
    recordings: new Map(),
    mediaRecorder: null,
    recordingChunks: [],
    activeStream: null,
  };

  const els = {
    themeLabel: document.getElementById("themeLabel"),
    packTitle: document.getElementById("packTitle"),
    list: document.getElementById("exerciseList"),
    player: document.getElementById("player"),
    playButton: document.getElementById("playButton"),
    prevButton: document.getElementById("prevButton"),
    nextButton: document.getElementById("nextButton"),
    promptText: document.getElementById("promptText"),
    answerPanel: document.getElementById("answerPanel"),
    answerText: document.getElementById("answerText"),
    explanationText: document.getElementById("explanationText"),
    keywordPanel: document.getElementById("keywordPanel"),
    keywordList: document.getElementById("keywordList"),
    showKeywordsButton: document.getElementById("showKeywordsButton"),
    showAnswerButton: document.getElementById("showAnswerButton"),
    exerciseCounter: document.getElementById("exerciseCounter"),
    progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    speedSelect: document.getElementById("speedSelect"),
    loopToggle: document.getElementById("loopToggle"),
    autoNextToggle: document.getElementById("autoNextToggle"),
    doneButton: document.getElementById("doneButton"),
    recordButton: document.getElementById("recordButton"),
    playRecordingButton: document.getElementById("playRecordingButton"),
    recordingPlayer: document.getElementById("recordingPlayer"),
    downloadRecording: document.getElementById("downloadRecording"),
    recordStatus: document.getElementById("recordStatus"),
    recordLight: document.getElementById("recordLight"),
    filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
  };

  function saveDone() {
    localStorage.setItem(doneKey, JSON.stringify(Array.from(state.done)));
  }

  function currentExercise() {
    return exercises[state.currentIndex];
  }

  function renderList() {
    els.list.innerHTML = "";
    exercises.forEach((exercise, index) => {
      const item = document.createElement("li");
      item.className = "segment-item";
      item.dataset.id = exercise.id;

      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => selectExercise(index));

      const no = document.createElement("span");
      no.className = "seg-no";
      no.textContent = exercise.id;

      const title = document.createElement("span");
      title.className = "seg-title";
      title.textContent = exercise.prompt_zh;

      const check = document.createElement("span");
      check.className = "seg-check";
      check.setAttribute("aria-hidden", "true");

      button.append(no, title, check);
      item.append(button);
      els.list.appendChild(item);
    });
    updateListState();
  }

  function updateListState() {
    Array.from(els.list.children).forEach((item, index) => {
      const exercise = exercises[index];
      const isDone = state.done.has(exercise.id);
      item.classList.toggle("is-active", index === state.currentIndex);
      item.classList.toggle("is-done", isDone);
      item.classList.toggle(
        "is-hidden",
        (state.filter === "todo" && isDone) || (state.filter === "done" && !isDone)
      );
    });
  }

  function updateProgress() {
    const doneCount = state.done.size;
    const total = exercises.length;
    const ratio = total ? (doneCount / total) * 100 : 0;
    els.progressText.textContent = `${doneCount} / ${total}`;
    els.progressBar.style.width = `${ratio}%`;
  }

  function updateRecordingControls() {
    const exercise = currentExercise();
    const saved = exercise ? state.recordings.get(exercise.id) : null;
    if (saved) {
      els.recordingPlayer.src = saved.url;
      els.playRecordingButton.disabled = false;
      els.downloadRecording.classList.remove("is-disabled");
      els.downloadRecording.href = saved.url;
      els.downloadRecording.download = `output-recording-${exercise.id}.webm`;
    } else {
      els.recordingPlayer.removeAttribute("src");
      els.playRecordingButton.disabled = true;
      els.downloadRecording.classList.add("is-disabled");
      els.downloadRecording.removeAttribute("href");
    }
  }

  function renderKeywords(exercise) {
    els.keywordList.innerHTML = "";
    exercise.keywords.forEach((keyword) => {
      const chip = document.createElement("span");
      chip.className = "keyword-chip";
      chip.textContent = keyword;
      els.keywordList.appendChild(chip);
    });
  }

  function updateRevealState() {
    const exercise = currentExercise();
    if (!exercise) return;
    const isAnswerRevealed = state.revealedAnswers.has(exercise.id);
    const areKeywordsRevealed = state.revealedKeywords.has(exercise.id) || isAnswerRevealed;

    els.keywordPanel.hidden = !areKeywordsRevealed;
    els.answerPanel.hidden = !isAnswerRevealed;
    els.playButton.disabled = !isAnswerRevealed;
    els.showAnswerButton.disabled = isAnswerRevealed;
    els.showKeywordsButton.disabled = areKeywordsRevealed;

    if (areKeywordsRevealed) renderKeywords(exercise);
    if (isAnswerRevealed) {
      els.answerText.textContent = exercise.answer_ru;
      els.explanationText.textContent = exercise.explanation_zh;
      els.player.src = exercise.audio;
      els.player.loop = els.loopToggle.checked;
      els.player.playbackRate = Number(els.speedSelect.value);
    } else {
      els.answerText.textContent = "";
      els.explanationText.textContent = "";
      els.player.removeAttribute("src");
    }
  }

  function selectExercise(index) {
    if (!exercises[index]) return;
    state.currentIndex = index;
    const exercise = currentExercise();
    els.exerciseCounter.textContent = exercise.id;
    els.promptText.textContent = exercise.prompt_zh;
    els.doneButton.textContent = state.done.has(exercise.id) ? "取消已练" : "标记已练";
    els.playButton.textContent = "播放标准音频";
    updateRevealState();
    updateRecordingControls();
    updateListState();
  }

  function selectRelative(offset) {
    const nextIndex = Math.max(0, Math.min(exercises.length - 1, state.currentIndex + offset));
    selectExercise(nextIndex);
  }

  function showKeywords() {
    const exercise = currentExercise();
    if (!exercise) return;
    state.revealedKeywords.add(exercise.id);
    updateRevealState();
  }

  function showAnswer() {
    const exercise = currentExercise();
    if (!exercise) return;
    state.revealedAnswers.add(exercise.id);
    state.revealedKeywords.add(exercise.id);
    updateRevealState();
  }

  async function togglePlay() {
    if (!currentExercise() || els.playButton.disabled) return;
    if (els.player.paused) {
      await els.player.play();
    } else {
      els.player.pause();
    }
  }

  function setDone(exerciseId, value) {
    if (value) {
      state.done.add(exerciseId);
    } else {
      state.done.delete(exerciseId);
    }
    saveDone();
    updateProgress();
    updateListState();
    els.doneButton.textContent = value ? "取消已练" : "标记已练";
  }

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      els.recordStatus.textContent = "当前浏览器不支持录音";
      return;
    }

    state.activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordingChunks = [];
    state.mediaRecorder = new MediaRecorder(state.activeStream);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.recordingChunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", finishRecording);
    state.mediaRecorder.start();
    els.recordStatus.textContent = "录音中";
    els.recordLight.classList.add("is-recording");
    els.recordButton.textContent = "停止录音";
  }

  function stopRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    }
  }

  function finishRecording() {
    if (state.activeStream) {
      state.activeStream.getTracks().forEach((track) => track.stop());
    }

    const exercise = currentExercise();
    const oldRecording = exercise ? state.recordings.get(exercise.id) : null;
    if (oldRecording) URL.revokeObjectURL(oldRecording.url);

    const blob = new Blob(state.recordingChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    if (exercise) state.recordings.set(exercise.id, { blob, url });

    state.mediaRecorder = null;
    state.activeStream = null;
    state.recordingChunks = [];
    els.recordStatus.textContent = "录音已保存";
    els.recordLight.classList.remove("is-recording");
    els.recordButton.textContent = "开始录音";
    updateRecordingControls();
  }

  function bindEvents() {
    els.showKeywordsButton.addEventListener("click", showKeywords);
    els.showAnswerButton.addEventListener("click", showAnswer);
    els.playButton.addEventListener("click", togglePlay);
    els.prevButton.addEventListener("click", () => selectRelative(-1));
    els.nextButton.addEventListener("click", () => selectRelative(1));
    els.player.addEventListener("play", () => {
      els.playButton.textContent = "暂停标准音频";
    });
    els.player.addEventListener("pause", () => {
      els.playButton.textContent = "播放标准音频";
    });
    els.player.addEventListener("ended", () => {
      const exercise = currentExercise();
      if (exercise) setDone(exercise.id, true);
      if (els.autoNextToggle.checked && !els.loopToggle.checked) {
        const canMove = state.currentIndex < exercises.length - 1;
        if (canMove) selectRelative(1);
      }
    });

    els.speedSelect.addEventListener("change", () => {
      els.player.playbackRate = Number(els.speedSelect.value);
      localStorage.setItem(speedKey, els.speedSelect.value);
    });
    els.loopToggle.addEventListener("change", () => {
      els.player.loop = els.loopToggle.checked;
      if (els.loopToggle.checked) els.autoNextToggle.checked = false;
    });
    els.autoNextToggle.addEventListener("change", () => {
      if (els.autoNextToggle.checked) els.loopToggle.checked = false;
      els.player.loop = els.loopToggle.checked;
    });
    els.doneButton.addEventListener("click", () => {
      const exercise = currentExercise();
      if (exercise) setDone(exercise.id, !state.done.has(exercise.id));
    });
    els.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.filter = button.dataset.filter;
        els.filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        updateListState();
      });
    });
    els.recordButton.addEventListener("click", async () => {
      try {
        if (state.mediaRecorder) {
          stopRecording();
        } else {
          await startRecording();
        }
      } catch (error) {
        els.recordStatus.textContent = "录音权限未开启";
        els.recordLight.classList.remove("is-recording");
        els.recordButton.textContent = "开始录音";
      }
    });
    els.playRecordingButton.addEventListener("click", () => {
      els.recordingPlayer.play();
    });
    document.addEventListener("keydown", (event) => {
      if (event.target && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
      if (event.key === "ArrowLeft") selectRelative(-1);
      if (event.key === "ArrowRight") selectRelative(1);
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      }
    });
  }

  function init() {
    if (manifest) {
      els.packTitle.textContent = manifest.title || "俄语输出练习";
      els.themeLabel.textContent = `${manifest.theme || "俄语日常表达"} · ${manifest.week || ""}`;
    }
    if (!exercises.length) {
      els.promptText.textContent = "没有找到练习数据";
      els.answerPanel.hidden = true;
      els.keywordPanel.hidden = true;
      els.playButton.disabled = true;
      return;
    }
    const savedSpeed = localStorage.getItem(speedKey);
    if (savedSpeed) els.speedSelect.value = savedSpeed;
    bindEvents();
    renderList();
    updateProgress();
    selectExercise(0);
  }

  init();
})();
```

- [ ] **Step 2: Run static web tests**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest tests/test_output_web_static.py -v
```

Expected: PASS.

- [ ] **Step 3: Commit browser logic**

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- \
  output_web/app.js \
  tests/test_output_web_static.py
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "feat: add output-first practice interactions"
```

---

### Task 6: Build Pack And Unit Verification

**Files:**
- Generated local files under: `build/output_daily_2026-06-09/`
- Modify tests only if the build command exposes a real defect.

- [ ] **Step 1: Run all unit tests**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 -m unittest discover -s tests -v
```

Expected: PASS for all output-practice tests.

- [ ] **Step 2: Build text-only local pack**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 build_output_practice_pack.py --skip-audio
```

Expected output contains:

```text
exercises: 20
manifest: /Users/weiwei/Documents/russian-output-practice/build/output_daily_2026-06-09/data/practice.json
open: /Users/weiwei/Documents/russian-output-practice/build/output_daily_2026-06-09/index.html
```

- [ ] **Step 3: Inspect generated manifest shape**

Run:

```bash
python3 - <<'PY'
import json
from pathlib import Path
p = Path("/Users/weiwei/Documents/russian-output-practice/build/output_daily_2026-06-09/data/practice.json")
data = json.loads(p.read_text(encoding="utf-8"))
assert data["mode"] == "output-first"
assert len(data["exercises"]) == 20
assert data["exercises"][0]["initially_revealed"] is False
assert data["exercises"][0]["prompt_zh"] == "我现在有点忙，晚点回复你。"
print("manifest ok")
PY
```

Expected: `manifest ok`.

- [ ] **Step 4: Commit build tooling readiness**

Do not add generated files. Commit only source and tests already changed in previous tasks if any remain uncommitted:

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" status --short
```

Expected: generated build files are untracked or ignored; source files from Tasks 1-5 are already committed.

---

### Task 7: Optional Edge TTS Audio Build

**Files:**
- Generated local files under: `build/output_daily_2026-06-09/audio/`

- [ ] **Step 1: Check whether `edge_tts` is importable**

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 - <<'PY'
try:
    import edge_tts
except Exception as exc:
    print(f"edge_tts unavailable: {exc}")
else:
    print("edge_tts available")
PY
```

Expected if the dependency is installed: `edge_tts available`.

- [ ] **Step 2: Generate MP3 audio when available**

If Step 1 prints `edge_tts available`, run:

```bash
cd "/Users/weiwei/Documents/russian-output-practice"
python3 build_output_practice_pack.py --overwrite
```

Expected: prints `generate 001.mp3` through `generate 020.mp3`, then prints the `open:` path.

If Step 1 prints `edge_tts unavailable`, skip this task and keep the text-only pack usable. Report that audio generation needs `edge_tts` installed in the Python environment.

- [ ] **Step 3: Verify audio file count when audio was generated**

```bash
find "/Users/weiwei/Documents/russian-output-practice/build/output_daily_2026-06-09/audio" -name '*.mp3' | wc -l
```

Expected after successful audio generation: `20`.

---

### Task 8: Browser Verification

**Files:**
- Use generated local app: `build/output_daily_2026-06-09/index.html`
- No source edits unless verification finds a defect.

- [ ] **Step 1: Open generated page**

Open:

```text
file:///Users/weiwei/Documents/New%20project/build/output_daily_2026-06-09/index.html
```

Expected initial page:

- Header shows `俄语日常表达`.
- Left list shows 20 Chinese prompts.
- Main panel shows the first Chinese prompt.
- Standard Russian answer is not visible.
- Keyword panel is not visible.
- `播放标准音频` is disabled.

- [ ] **Step 2: Verify keyword reveal does not reveal full answer**

Click `显示关键词`.

Expected:

- Keyword chips appear.
- Full standard Russian answer remains hidden.
- `播放标准音频` remains disabled.

- [ ] **Step 3: Verify answer reveal unlocks answer and audio**

Click `显示答案`.

Expected:

- `Я сейчас немного занята, отвечу позже.` appears.
- Explanation text appears.
- `播放标准音频` becomes enabled.
- If MP3s exist, clicking `播放标准音频` starts playback.

- [ ] **Step 4: Verify navigation and persistence**

Click next exercise, then return to exercise 001.

Expected:

- Exercise 001 still shows answer after reveal during the same browser session.
- Done state uses `russian-output-practice-2026-06-09-done-v1`.

- [ ] **Step 5: Mobile viewport check**

Use a mobile-width viewport or narrow the browser.

Expected:

- The list and practice pane stack vertically.
- Chinese prompt and Russian answer fit without overlap.
- Buttons wrap without clipping text.

- [ ] **Step 6: Commit fixes only if needed**

If browser verification required source fixes:

```bash
git -C "/Users/weiwei/Documents/russian-output-practice" add -- output_web build_output_practice_pack.py tests
git -C "/Users/weiwei/Documents/russian-output-practice" commit -m "fix: polish output practice verification issues"
```

If no fixes were needed, do not commit generated build output.

---

## Self-Review Notes

- Spec coverage:
  - AI-generated weekly theme content is represented by the first weekly JSON pack and generator workflow.
  - Vocabulary sources are wired through the eyujun CSV export.
  - Chinese-first output behavior is covered by `output_web/index.html` and `output_web/app.js`.
  - Russian answer and standard audio are hidden until `显示答案`.
  - Existing static-page architecture is preserved; no backend or browser API keys are introduced.
  - Tests cover manifest shape, answer-hidden contracts, reveal behavior contracts, and local storage separation.
- Placeholder scan:
  - The plan contains no unfinished-work markers.
  - Each code-creation step includes concrete file contents or exact code fragments.
- Type consistency:
  - Manifest fields are consistent across generator, data, tests, and JavaScript: `prompt_zh`, `answer_ru`, `keywords`, `explanation_zh`, `difficulty`, `source_words`, `audio`, `initially_revealed`.
  - Browser global is consistently `window.OUTPUT_PRACTICE`.
