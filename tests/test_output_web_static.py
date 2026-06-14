import pathlib
import unittest


class OutputWebStaticTests(unittest.TestCase):
    def test_index_has_output_first_controls(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertIn('id="promptText"', html)
        self.assertIn('id="showAnswerButton"', html)
        self.assertIn('id="showKeywordsButton"', html)
        self.assertIn('id="knowButton"', html)
        self.assertIn('id="unknownButton"', html)
        self.assertIn('id="reviewQueueText"', html)
        self.assertIn('id="answerPanel"', html)
        self.assertIn("hidden", html)

    def test_app_uses_separate_storage_and_reveal_state(self):
        js = pathlib.Path("output_web/app.js").read_text(encoding="utf-8")

        self.assertIn("russian-output-practice", js)
        self.assertIn("revealedAnswers", js)
        self.assertIn("showAnswer", js)
        self.assertIn("answerPanel.hidden = !isAnswerRevealed", js)
        self.assertIn("playButton.disabled = !isAnswerRevealed", js)

    def test_app_persists_known_and_retry_queue_state(self):
        js = pathlib.Path("output_web/app.js").read_text(encoding="utf-8")

        self.assertIn("knownKey", js)
        self.assertIn("retryQueueKey", js)
        self.assertIn("retryQueue", js)
        self.assertIn("markKnown", js)
        self.assertIn("markUnknown", js)
        self.assertIn("advanceAfterAssessment", js)

    def test_retry_selection_hides_previously_revealed_answer(self):
        js = pathlib.Path("output_web/app.js").read_text(encoding="utf-8")

        self.assertIn("resetRevealFor", js)
        self.assertIn("resetReveal: true", js)

    def test_index_does_not_include_any_static_russian_answer(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertNotIn("Я сейчас немного занята", html)
        self.assertNotIn("Хорошо, договорились", html)

    def test_index_cache_busts_changed_assets(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertIn('styles.css?v=', html)
        self.assertIn('practice.js?v=', html)
        self.assertIn('app.js?v=', html)


if __name__ == "__main__":
    unittest.main()
