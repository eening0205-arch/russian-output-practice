import asyncio
import csv
import json
import pathlib
import sys
import tempfile
import types
import unittest
from unittest import mock

from build_output_practice_pack import (
    build_manifest,
    copy_web_assets,
    load_weekly_exercises,
    load_wordbook_csv,
    normalize_word,
    synthesize_exercise_audio,
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

    def test_synthesize_exercise_audio_retries_empty_edge_responses(self):
        attempts = []

        class FakeCommunicate:
            def __init__(self, text, voice, rate):
                self.text = text
                self.voice = voice
                self.rate = rate

            async def save(self, output_path):
                attempts.append(output_path)
                output = pathlib.Path(output_path)
                if len(attempts) == 1:
                    output.write_bytes(b"")
                    raise RuntimeError("No audio was received")
                output.write_bytes(b"audio")

        async def fast_sleep(_seconds):
            return None

        exercises = [
            {
                "id": "001",
                "answer_ru": "Я сегодня хочу выйти пораньше.",
            }
        ]

        with tempfile.TemporaryDirectory() as tmp:
            audio_dir = pathlib.Path(tmp)
            with mock.patch.dict(
                sys.modules,
                {"edge_tts": types.SimpleNamespace(Communicate=FakeCommunicate)},
            ), mock.patch("build_output_practice_pack.asyncio.sleep", fast_sleep):
                asyncio.run(
                    synthesize_exercise_audio(
                        exercises,
                        audio_dir,
                        voice="ru-RU-DmitryNeural",
                        rate="-15%",
                        overwrite=True,
                    )
                )

            self.assertEqual(len(attempts), 2)
            self.assertEqual((audio_dir / "001.mp3").read_bytes(), b"audio")

    def test_synthesize_exercise_audio_retries_timed_out_edge_responses(self):
        attempts = []

        class FakeCommunicate:
            def __init__(self, text, voice, rate):
                self.text = text
                self.voice = voice
                self.rate = rate

            async def save(self, output_path):
                attempts.append(output_path)
                output = pathlib.Path(output_path)
                if len(attempts) == 1:
                    await asyncio.Event().wait()
                output.write_bytes(b"audio")

        exercises = [
            {
                "id": "001",
                "answer_ru": "Я сегодня хочу выйти пораньше.",
            }
        ]

        with tempfile.TemporaryDirectory() as tmp:
            audio_dir = pathlib.Path(tmp)
            with mock.patch.dict(
                sys.modules,
                {"edge_tts": types.SimpleNamespace(Communicate=FakeCommunicate)},
            ), mock.patch(
                "build_output_practice_pack.TTS_SAVE_TIMEOUT_SECONDS", 0.01, create=True
            ), mock.patch("build_output_practice_pack.TTS_RETRY_DELAY_SECONDS", 0):
                asyncio.run(
                    asyncio.wait_for(
                        synthesize_exercise_audio(
                            exercises,
                            audio_dir,
                            voice="ru-RU-DmitryNeural",
                            rate="-15%",
                            overwrite=True,
                        ),
                        timeout=0.5,
                    )
                )

            self.assertEqual(len(attempts), 2)
            self.assertEqual((audio_dir / "001.mp3").read_bytes(), b"audio")

    def test_copy_web_assets_copies_nested_icon_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            project_dir = pathlib.Path(tmp) / "project"
            out_dir = pathlib.Path(tmp) / "out"
            icon_dir = project_dir / "output_web" / "icons"
            icon_dir.mkdir(parents=True)
            (project_dir / "output_web" / "index.html").write_text(
                "<html></html>", encoding="utf-8"
            )
            (project_dir / "output_web" / "practice.js").write_text(
                "window.OUTPUT_PRACTICE = {};",
                encoding="utf-8",
            )
            (icon_dir / "icon.svg").write_text("<svg></svg>", encoding="utf-8")
            out_dir.mkdir()

            copy_web_assets(project_dir, out_dir)

            self.assertTrue((out_dir / "index.html").exists())
            self.assertTrue((out_dir / "icons" / "icon.svg").exists())
            self.assertFalse((out_dir / "practice.js").exists())

    def test_real_daily_packs_have_twenty_output_first_exercises(self):
        packs = [
            (
                pathlib.Path("weekly_packs/daily_expression_2026-06-09.json"),
                "2026-06-09",
                "我现在有点忙，晚点回复你。",
            ),
            (
                pathlib.Path("weekly_packs/daily_expression_2026-06-14.json"),
                "2026-06-14",
                "我今天想早点出门。",
            ),
        ]

        for path, week, first_prompt in packs:
            with self.subTest(path=path):
                weekly = load_weekly_exercises(path)
                self.assertEqual(weekly["week"], week)
                self.assertIn("俄语日常表达", weekly["theme"])
                self.assertEqual(len(weekly["exercises"]), 20)
                self.assertEqual(weekly["exercises"][0]["prompt_zh"], first_prompt)
                self.assertIn("answer_ru", weekly["exercises"][0])


if __name__ == "__main__":
    unittest.main()
