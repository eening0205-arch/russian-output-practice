import json
import pathlib
import unittest


class PwaStaticTests(unittest.TestCase):
    def test_index_declares_installable_app_metadata_and_nav(self):
        html = pathlib.Path("output_web/index.html").read_text(encoding="utf-8")

        self.assertIn('rel="manifest"', html)
        self.assertIn('name="theme-color"', html)
        self.assertIn('name="apple-mobile-web-app-capable"', html)
        self.assertIn('id="appNav"', html)
        self.assertIn('data-view="practice"', html)
        self.assertIn('data-view="review"', html)
        self.assertIn('data-view="library"', html)
        self.assertIn('data-view="settings"', html)

    def test_manifest_is_installable(self):
        manifest = json.loads(
            pathlib.Path("output_web/manifest.webmanifest").read_text(encoding="utf-8")
        )

        self.assertEqual(manifest["name"], "俄语输出练习")
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(manifest["start_url"], "./")
        self.assertEqual(manifest["scope"], "./")
        self.assertEqual(manifest["theme_color"], "#23694b")
        self.assertTrue(
            any(icon["sizes"] == "192x192" for icon in manifest["icons"])
        )
        self.assertTrue(
            any(icon["sizes"] == "512x512" for icon in manifest["icons"])
        )

    def test_service_worker_caches_app_shell_and_audio(self):
        sw = pathlib.Path("output_web/sw.js").read_text(encoding="utf-8")

        self.assertIn("CACHE_NAME", sw)
        self.assertIn("offline.html", sw)
        self.assertIn("data/practice.json", sw)
        self.assertIn("audio/001.mp3", sw)
        self.assertIn("self.addEventListener(\"fetch\"", sw)

    def test_app_registers_service_worker_and_handles_app_views(self):
        js = pathlib.Path("output_web/app.js").read_text(encoding="utf-8")

        self.assertIn("navigator.serviceWorker.register", js)
        self.assertIn("activateView", js)
        self.assertIn("renderLibraryView", js)
        self.assertIn("sentenceStatsKey", js)
        self.assertIn("renderReviewView", js)


if __name__ == "__main__":
    unittest.main()
