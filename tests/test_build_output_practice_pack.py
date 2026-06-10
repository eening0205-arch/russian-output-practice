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

    def test_real_weekly_pack_has_twenty_output_first_exercises(self):
        weekly = load_weekly_exercises(
            pathlib.Path("weekly_packs/daily_expression_2026-06-09.json")
        )

        self.assertEqual(weekly["theme"], "俄语日常表达")
        self.assertEqual(len(weekly["exercises"]), 20)
        self.assertEqual(
            weekly["exercises"][0]["prompt_zh"], "我现在有点忙，晚点回复你。"
        )
        self.assertIn("answer_ru", weekly["exercises"][0])


if __name__ == "__main__":
    unittest.main()
