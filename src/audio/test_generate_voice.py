"""Offline tests for the content-fingerprint voice generation plan."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("generate_voice.py")
SPEC = importlib.util.spec_from_file_location("generate_voice", MODULE_PATH)
assert SPEC and SPEC.loader
voice = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = voice
SPEC.loader.exec_module(voice)


class FakeAudioFile:
    """Minimal Path-like file for plan tests; no filesystem or API dependency."""

    def __init__(self, output: "FakeOutput", filename: str) -> None:
        self.output = output
        self.filename = filename

    def is_file(self) -> bool:
        return self.filename in self.output.files

    def stat(self) -> SimpleNamespace:
        return SimpleNamespace(st_size=1 if self.is_file() else 0)


class FakeOutput:
    def __init__(self) -> None:
        self.files: set[str] = set()

    def __truediv__(self, filename: str) -> FakeAudioFile:
        return FakeAudioFile(self, filename)


class VoiceGenerationPlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.output = FakeOutput()
        self.config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.0, 5, 0)
        self.rows = [
            {"key": f"action.line_{index}", "line": f"line {index}"}
            for index in range(100)
        ]
        self.filenames = voice.validate_unique_keys(self.rows)

    def plan(self, rows: list[dict[str, str]], cache: dict[str, dict[str, object]], config=None):
        return voice.build_generation_plan(rows, self.filenames, cache, self.output, config or self.config, False)

    def materialize_first_run(self, plan: list[object]) -> dict[str, dict[str, object]]:
        cache: dict[str, dict[str, object]] = {}
        for item in plan:
            self.assertEqual(item.status, "new")
            self.output.files.add(item.filename)
            cache[item.key] = voice.cache_entry(
                item.key, item.line, item.tts_text, item.filename, item.fingerprint, self.config
            )
        return cache

    def test_incremental_generation_plan_for_one_hundred_rows(self) -> None:
        # First run: every row is new and therefore requires one API call.
        first_plan, first_orphans = self.plan(self.rows, {})
        first_summary = voice.plan_summary(first_plan, first_orphans)
        self.assertEqual(first_summary["new"], 100)
        self.assertEqual(first_summary["api_calls"], 100)

        # Same CSV with materialized files/cache: zero calls.
        cache = self.materialize_first_run(first_plan)
        unchanged_plan, unchanged_orphans = self.plan(self.rows, cache)
        unchanged_summary = voice.plan_summary(unchanged_plan, unchanged_orphans)
        self.assertEqual(unchanged_summary["unchanged"], 100)
        self.assertEqual(unchanged_summary["api_calls"], 0)

        # Ten changed lines: only those ten become stale.
        edited_rows = [dict(row, line=f"edited {index}") if index < 10 else row for index, row in enumerate(self.rows)]
        edited_plan, edited_orphans = self.plan(edited_rows, cache)
        edited_summary = voice.plan_summary(edited_plan, edited_orphans)
        self.assertEqual(edited_summary["changed"], 10)
        self.assertEqual(edited_summary["unchanged"], 90)
        self.assertEqual(edited_summary["api_calls"], 10)

        # Sound-affecting configuration changes invalidate every key.
        faster_config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.1, 5, 0)
        changed_config_plan, changed_config_orphans = self.plan(self.rows, cache, faster_config)
        changed_config_summary = voice.plan_summary(changed_config_plan, changed_config_orphans)
        self.assertEqual(changed_config_summary["changed"], 100)
        self.assertEqual(changed_config_summary["api_calls"], 100)

        # Missing output requires only that key to be regenerated.
        missing_key = self.rows[-1]["key"]
        self.output.files.remove(self.filenames[missing_key])
        missing_plan, missing_orphans = self.plan(self.rows, cache)
        missing_summary = voice.plan_summary(missing_plan, missing_orphans)
        self.assertEqual(missing_summary["missing"], 1)
        self.assertEqual(missing_summary["unchanged"], 99)
        self.assertEqual(missing_summary["api_calls"], 1)

        # Orphans are reported but retained, never deleted automatically.
        cache["removed.from.csv"] = voice.cache_entry(
            "removed.from.csv", "old", "old", "removed_from_csv.mp3", "old-fingerprint", self.config
        )
        _, orphaned = self.plan(self.rows, cache)
        self.assertEqual(orphaned, ["removed.from.csv"])

    def test_existing_file_without_a_matching_cache_is_not_unchanged(self) -> None:
        key = self.rows[0]["key"]
        self.output.files.add(self.filenames[key])
        plan, orphaned = self.plan([self.rows[0]], {})
        summary = voice.plan_summary(plan, orphaned)
        self.assertEqual(summary["new"], 1)
        self.assertEqual(summary["unchanged"], 0)
        self.assertEqual(summary["api_calls"], 1)

    def test_rotates_to_the_next_key_after_an_authentication_failure(self) -> None:
        calls: list[str] = []
        original_synthesize = voice.synthesize

        def fake_synthesize(session, config, api_key, text):
            calls.append(api_key)
            if api_key == "first-key":
                return None, 401, "unauthorized"
            return b"ID3 test audio", 200, None

        voice.synthesize = fake_synthesize
        try:
            audio, status, error = voice.synthesize_with_api_keys(
                object(), self.config, ["first-key", "second-key"], "test"
            )
        finally:
            voice.synthesize = original_synthesize

        self.assertEqual(audio, b"ID3 test audio")
        self.assertEqual(status, 200)
        self.assertIsNone(error)
        self.assertEqual(calls, ["first-key", "second-key"])

    def test_tts_text_fallback_and_tts_only_cache_changes(self) -> None:
        pronunciation = "<|phoneme_start|>fa1<|phoneme_end|>"
        line = chr(0x53d1)
        self.assertEqual(voice.get_tts_text({"line": line}), line)
        self.assertEqual(voice.get_tts_text({"line": line, "tts_text": ""}), line)
        self.assertEqual(voice.get_tts_text({"line": line, "tts_text": "   "}), line)
        self.assertEqual(voice.get_tts_text({"line": line, "tts_text": float("nan")}), line)
        self.assertEqual(voice.get_tts_text({"line": line, "tts_text": line}), line)

        rows = [{"key": "yaku.hatsu", "line": line, "tts_text": line}]
        filenames = voice.validate_unique_keys(rows)
        first_plan, _ = voice.build_generation_plan(rows, filenames, {}, self.output, self.config, False)
        first = first_plan[0]
        self.output.files.add(first.filename)
        cache = {
            first.key: voice.cache_entry(
                first.key, first.line, first.tts_text, first.filename, first.fingerprint, self.config
            )
        }

        phoneme_rows = [{"key": "yaku.hatsu", "line": line, "tts_text": pronunciation}]
        phoneme_plan, _ = voice.build_generation_plan(phoneme_rows, filenames, cache, self.output, self.config, False)
        self.assertEqual(phoneme_plan[0].status, "changed")
        self.assertNotEqual(first.fingerprint, phoneme_plan[0].fingerprint)
        self.assertEqual(voice.plan_summary(phoneme_plan, [])['api_calls'], 1)

        # After generating the phoneme version, a UI-only line change must not regenerate it.
        phoneme = phoneme_plan[0]
        cache[phoneme.key] = voice.cache_entry(
            phoneme.key, phoneme.line, phoneme.tts_text, phoneme.filename, phoneme.fingerprint, self.config
        )
        ui_only_rows = [{"key": "yaku.hatsu", "line": line + "牌", "tts_text": pronunciation}]
        ui_only_plan, _ = voice.build_generation_plan(ui_only_rows, filenames, cache, self.output, self.config, False)
        self.assertEqual(ui_only_plan[0].status, "unchanged")
        self.assertEqual(voice.plan_summary(ui_only_plan, [])['api_calls'], 0)

    def test_tts_payload_serializes_phoneme_text_as_utf8(self) -> None:
        tts_text = chr(0x53d1) + "<|phoneme_start|>fa1<|phoneme_end|>"
        response = voice.requests.Response()
        response.status_code = 200
        response._content = b"ID3 test audio"

        class CapturingSession:
            def post(self, *args, **kwargs):
                self.data = kwargs["data"]
                self.headers = kwargs["headers"]
                return response

        session = CapturingSession()
        audio, status, error = voice.synthesize(session, self.config, "test-key", tts_text)
        self.assertEqual(audio, b"ID3 test audio")
        self.assertEqual(status, 200)
        self.assertIsNone(error)
        self.assertIn(tts_text.encode("utf-8"), session.data)
        self.assertEqual(session.headers["Content-Type"], "application/json; charset=utf-8")

    def test_voice_pack_migrates_legacy_cache_and_prefers_environment_key(self) -> None:
        """Legacy root audio/cache remains reusable after moving into a Pack audio directory."""
        row = {"key": "action.riichi", "line": "line"}
        filename = voice.validate_unique_keys([row])[row["key"]]
        legacy_entry = {
            "key": row["key"],
            "text": row["line"],
            "voiceId": self.config.voice_id,
            "modelId": self.config.model_id,
            "speed": self.config.speed,
            "format": self.config.audio_format,
            "file": filename,
        }
        migrated = voice.migrate_voice_cache({row["key"]: legacy_entry}, self.config)
        self.assertEqual(migrated[row["key"]]["line"], row["line"])
        self.assertEqual(migrated[row["key"]]["ttsText"], row["line"])

        self.output.files.add(filename)
        plan, _ = voice.build_generation_plan(
            [row], {row["key"]: filename}, migrated, self.output, self.config, False
        )
        self.assertEqual(plan[0].status, "unchanged")
        manifest = voice.build_manifest("xiaozhang", self.config, [{
            "key": row["key"], "file": filename, "status": "skipped"
        }], self.output)
        self.assertEqual(manifest["voices"][row["key"]]["file"], f"audio/{filename}")

        class MemoryKeyFile:
            def exists(self) -> bool:
                return True

            def read_text(self, encoding: str) -> str:
                self.encoding = encoding
                return "file-key\nsecond-file-key\n"

        with patch.dict("os.environ", {"FISHAUDIO_API_KEY": "environment-key"}, clear=True):
            self.assertEqual(
                voice.load_api_keys(MemoryKeyFile()),
                ["environment-key", "file-key", "second-file-key"],
            )

        self.assertEqual(voice.DEFAULT_API_KEYS_FILE.parent.name, ".secrets")
        self.assertEqual(voice.DEFAULT_PACK.name, "xiaozhang")


if __name__ == "__main__":
    unittest.main()
