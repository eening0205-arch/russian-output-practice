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
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Mn"
    )
    normalized = unicodedata.normalize("NFC", normalized)
    normalized = normalized.replace("ё", "е").replace("Ё", "Е")
    return re.sub(r"\s+", " ", normalized.strip().lower())


def strip_stress_marks_for_tts(text):
    decomposed = unicodedata.normalize("NFD", text or "")
    stripped = "".join(char for char in decomposed if char not in {"\u0301", "\u0300"})
    return unicodedata.normalize("NFC", stripped)


def load_wordbook_csv(path):
    words = {}
    path = Path(path)
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
    data = json.loads(Path(path).read_text(encoding="utf-8"))
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
            raise ValueError(
                f"exercise {exercise['id']} keywords must be a non-empty list"
            )


def source_words_for_keywords(keywords, wordbook):
    matched_words = []
    fallback_words = []
    for keyword in keywords:
        record = wordbook.get(normalize_word(keyword))
        if record:
            matched_words.append(record)
        else:
            fallback_words.append(
                {
                    "wordId": "",
                    "word": keyword,
                    "translation": "",
                    "partOfSpeech": "",
                    "difficulty": "",
                }
            )
    return matched_words + fallback_words


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
                "source_words": source_words_for_keywords(
                    exercise["keywords"], wordbook
                ),
                "audio": f"audio/{exercise['id']}.mp3",
                "initially_revealed": False,
            }
            for exercise in exercises
        ],
    }


def copy_web_assets(project_dir, out_dir):
    web_src = Path(project_dir) / "output_web"
    if not web_src.exists():
        raise FileNotFoundError(f"missing web asset directory: {web_src}")
    out_dir = Path(out_dir)
    for source in web_src.iterdir():
        if source.name == "practice.js":
            continue
        destination = out_dir / source.name
        if source.is_dir():
            shutil.copytree(source, destination, dirs_exist_ok=True)
        elif source.is_file():
            shutil.copy2(source, destination)


def write_manifest(out_dir, manifest):
    out_dir = Path(out_dir)
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

    audio_dir = Path(audio_dir)
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
    parser = argparse.ArgumentParser(
        description="Build an output-first Russian practice pack."
    )
    parser.add_argument(
        "--weekly-pack",
        type=Path,
        default=Path("weekly_packs/daily_expression_2026-06-09.json"),
        help="Weekly exercise JSON file.",
    )
    parser.add_argument(
        "--wordbook",
        type=Path,
        default=Path(
            "/Users/weiwei/Ning/outputs/eyujun/"
            "nin-knig-words-after-daily-notes-2026-06-09.csv"
        ),
        help="eyujun wordbook CSV export.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("build/output_daily_2026-06-09"),
        help="Output folder for the static practice pack.",
    )
    parser.add_argument("--voice", default="ru-RU-DmitryNeural", help="Edge TTS voice.")
    parser.add_argument(
        "--rate", default="-15%", help="TTS speech rate, for example -15%% or +0%%."
    )
    parser.add_argument("--overwrite", action="store_true", help="Regenerate MP3 files.")
    parser.add_argument(
        "--skip-audio",
        action="store_true",
        help="Write text and web assets without MP3 generation.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    project_dir = Path(__file__).resolve().parent
    weekly_path = (
        args.weekly_pack if args.weekly_pack.is_absolute() else project_dir / args.weekly_pack
    )
    wordbook_path = (
        args.wordbook if args.wordbook.is_absolute() else project_dir / args.wordbook
    )
    out_dir = args.out if args.out.is_absolute() else project_dir / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)

    weekly_pack = load_weekly_exercises(weekly_path)
    wordbook = load_wordbook_csv(wordbook_path)
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
        asyncio.run(
            synthesize_exercise_audio(
                exercises, out_dir / "audio", args.voice, args.rate, args.overwrite
            )
        )

    print(f"exercises: {len(exercises)}")
    print(f"manifest: {manifest_path}")
    print(f"open: {out_dir / 'index.html'}")


if __name__ == "__main__":
    main()
