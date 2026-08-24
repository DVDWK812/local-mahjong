"""Offline tests for the content-fingerprint voice generation plan."""

from __future__ import annotations

import importlib.util
import contextlib
import io
import json
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
                item.key, item.line, item.tts_text, item.filename, item.fingerprint, self.config, item.settings, item.effective
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

        # The frozen per-line schema owns speed defaults; legacy config speed no
        # longer silently rewrites every CSV row's generation semantics.
        faster_config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.1, 5, 0)
        changed_config_plan, changed_config_orphans = self.plan(self.rows, cache, faster_config)
        changed_config_summary = voice.plan_summary(changed_config_plan, changed_config_orphans)
        self.assertEqual(changed_config_summary["unchanged"], 100)
        self.assertEqual(changed_config_summary["api_calls"], 0)

        # Voice and model identity are effective inputs, so either change updates all lines.
        different_voice = voice.FishAudioConfig("https://example.invalid", "voice-b", "model-a", "mp3", 1.0, 5, 0)
        different_voice_plan, _ = self.plan(self.rows, cache, different_voice)
        self.assertEqual(voice.plan_summary(different_voice_plan, [])["changed"], 100)
        different_model = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-b", "mp3", 1.0, 5, 0)
        different_model_plan, _ = self.plan(self.rows, cache, different_model)
        self.assertEqual(voice.plan_summary(different_model_plan, [])["changed"], 100)

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

    def test_key_filter_limits_plan_without_changing_unselected_rows(self) -> None:
        first_plan, _ = self.plan(self.rows, {})
        cache = self.materialize_first_run(first_plan)
        edited_rows = [dict(row, tts_text=f"changed {index}") if index < 10 else row for index, row in enumerate(self.rows)]
        full_plan, _ = self.plan(edited_rows, cache)
        selected = [row["key"] for row in edited_rows[:10]]
        filtered = voice.filter_generation_plan(full_plan, selected, self.filenames)
        summary = voice.plan_summary(filtered, [])
        self.assertEqual(len(filtered), 10)
        self.assertEqual(summary["changed"], 10)
        self.assertEqual(summary["api_calls"], 10)
        self.assertTrue(all(item.key in selected for item in filtered))
        one = voice.filter_generation_plan(full_plan, [selected[0]], self.filenames)
        one_summary = voice.plan_summary(one, [])
        self.assertEqual(one_summary["changed"], 1)
        self.assertEqual(one_summary["api_calls"], 1)
        with self.assertRaisesRegex(ValueError, "Unknown CSV key"):
            voice.filter_generation_plan(full_plan, ["../escape"], self.filenames)

    def test_json_plan_does_not_include_tts_text_or_credentials(self) -> None:
        plan, _ = self.plan([self.rows[0]], {})
        summary = voice.plan_summary(plan, [])
        payload = voice.json_plan(summary, plan, Path("safe-pack"))
        self.assertEqual(payload["plan"]["total"], 1)
        self.assertEqual(payload["plan"]["apiCalls"], 1)
        self.assertNotIn("tts_text", str(payload))
        self.assertNotIn("api_key", str(payload).lower())

    def test_json_protocol_keeps_stdout_as_one_secret_free_object_and_logs_on_stderr(self) -> None:
        args = SimpleNamespace(json=True)
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            voice.cli_log(args, "ordinary progress")
            exit_code = voice.cli_failure(args, "API_KEY_UNAVAILABLE", "No configured Fish Audio API key is available.")
        self.assertEqual(exit_code, 2)
        self.assertEqual(stderr.getvalue(), "ordinary progress\n")
        payload = voice.json.loads(stdout.getvalue())
        self.assertEqual(payload["kind"], "result")
        self.assertFalse(payload["result"]["success"])
        self.assertEqual(payload["result"]["error"]["code"], "API_KEY_UNAVAILABLE")
        self.assertNotIn("key=", stdout.getvalue().lower())

    def test_rotates_to_the_next_key_after_an_authentication_failure(self) -> None:
        calls: list[str] = []
        original_synthesize = voice.synthesize

        def fake_synthesize(session, config, api_key, effective):
            calls.append(api_key)
            if api_key == "first-key":
                return None, 401, "unauthorized", []
            return b"ID3 test audio", 200, None, []

        voice.synthesize = fake_synthesize
        try:
            audio, status, error, warnings = voice.synthesize_with_api_keys(
                object(), self.config, ["first-key", "second-key"], voice.EffectiveGenerationConfig("test", self.config.voice_id, self.config.model_id, self.config.audio_format, 1.0, 0.0, 1.0, 1.0, "zh-CN", True)
            )
        finally:
            voice.synthesize = original_synthesize

        self.assertEqual(audio, b"ID3 test audio")
        self.assertEqual(status, 200)
        self.assertIsNone(error)
        self.assertEqual(warnings, [])
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
                first.key, first.line, first.tts_text, first.filename, first.fingerprint, self.config, first.settings, first.effective
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
            phoneme.key, phoneme.line, phoneme.tts_text, phoneme.filename, phoneme.fingerprint, self.config, phoneme.settings, phoneme.effective
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
        audio, status, error, warnings = voice.synthesize(session, self.config, "test-key", voice.EffectiveGenerationConfig(tts_text, self.config.voice_id, self.config.model_id, self.config.audio_format, 1.0, 0.0, 1.0, 1.0, "zh-CN", True))
        self.assertEqual(audio, b"ID3 test audio")
        self.assertEqual(status, 200)
        self.assertIsNone(error)
        self.assertEqual(warnings, [])
        self.assertIn(tts_text.encode("utf-8"), session.data)
        self.assertEqual(session.headers["Content-Type"], "application/json; charset=utf-8")

    def test_v3_payload_filters_unsupported_controls_and_surfaces_ignored_parameters(self) -> None:
        config = voice.FishAudioConfig(
            "https://fishaudio.org/api/open/v3/speech/tts", "voice-a", "model-a", "mp3", 1.0, 5, 0,
            controls={"speed": True, "volume": True, "pitch": False, "stability": True, "similarity": True, "language": True, "textNormalization": True, "emotion": False, "instruction": True},
        )
        effective = voice.resolve_effective_generation_config({
            "line": "立直", "tts_text": "立直", "locale": "zh-CN", "pitch": "3",
            "tts_emotion": "never-send", "tts_instruction": "calm",
        }, config, "zh-CN")
        response = voice.requests.Response(); response.status_code = 200; response._content = b"ID3"; response.headers["X-OpenAPI-Ignored-Parameters"] = "instruction"
        class CapturingSession:
            def post(self, *args, **kwargs): self.data = kwargs["data"]; self.headers = kwargs["headers"]; return response
        session = CapturingSession()
        audio, status, error, warnings = voice.synthesize(session, config, "test-key", effective)
        payload = voice.json.loads(session.data.decode("utf-8"))
        self.assertEqual(audio, b"ID3"); self.assertEqual(status, 200); self.assertIsNone(error)
        self.assertNotIn("pitch", payload); self.assertNotIn("emotion", payload); self.assertEqual(payload["instruction"], "calm")
        self.assertEqual(warnings, ["instruction"])
        self.assertEqual(session.headers["Idempotency-Key"], voice.effective_config_fingerprint(effective))

    def test_429_retries_without_rotating_to_another_key(self) -> None:
        calls: list[str] = []
        original_synthesize = voice.synthesize
        def fake_synthesize(session, config, api_key, effective):
            calls.append(api_key); return None, 429, "rate limited", []
        voice.synthesize = fake_synthesize
        try:
            _, status, _, _ = voice.synthesize_with_api_keys(object(), self.config, ["first-key", "second-key"])
        finally:
            voice.synthesize = original_synthesize
        self.assertEqual(status, 429); self.assertEqual(calls, ["first-key"])

    def test_per_line_generation_settings_change_only_their_own_fingerprint_and_payload(self) -> None:
        rows = [{"key": "action.riichi", "line": "立直", "tts_text": "立直", "locale": "zh-CN", "speed": "1", "volume": "0", "stability": "1", "similarity": "1", "language_override": "", "text_normalization": "true"}]
        filenames = voice.validate_unique_keys(rows)
        first_plan, _ = voice.build_generation_plan(rows, filenames, {}, self.output, self.config, False)
        first = first_plan[0]
        self.output.files.add(first.filename)
        cache = {first.key: voice.cache_entry(first.key, first.line, first.tts_text, first.filename, first.fingerprint, self.config, first.settings, first.effective)}
        self.assertEqual(cache[first.key]["fingerprintVersion"], voice.FINGERPRINT_VERSION)
        unchanged, _ = voice.build_generation_plan(rows, filenames, cache, self.output, self.config, False)
        self.assertEqual(unchanged[0].status, "unchanged")

        changed_speed = [dict(rows[0], speed="1.2")]
        speed_plan, _ = voice.build_generation_plan(changed_speed, filenames, cache, self.output, self.config, False)
        self.assertEqual(speed_plan[0].status, "changed")
        changed_stability = [dict(rows[0], stability="0.7")]
        stability_plan, _ = voice.build_generation_plan(changed_stability, filenames, cache, self.output, self.config, False)
        self.assertEqual(stability_plan[0].status, "changed")
        changed_language = [dict(rows[0], language_override="ja-JP")]
        language_plan, _ = voice.build_generation_plan(changed_language, filenames, cache, self.output, self.config, False)
        self.assertEqual(language_plan[0].status, "changed")
        changed_normalization = [dict(rows[0], text_normalization="false")]
        normalization_plan, _ = voice.build_generation_plan(changed_normalization, filenames, cache, self.output, self.config, False)
        self.assertEqual(normalization_plan[0].status, "changed")

        response = voice.requests.Response(); response.status_code = 200; response._content = b"ID3 test audio"
        class CapturingSession:
            def post(self, *args, **kwargs): self.data = kwargs["data"]; return response
        session = CapturingSession()
        voice.synthesize(session, self.config, "test-key", speed_plan[0].effective)
        payload = voice.json.loads(session.data.decode("utf-8"))
        self.assertEqual(payload["speed"], 1.2)
        self.assertEqual(payload["volume"], 0.0)
        self.assertEqual(payload["stability"], 1.0)
        self.assertEqual(payload["similarity"], 1.0)
        self.assertEqual(payload["language"], "zh-CN")
        self.assertTrue(payload["textNormalization"])

    def test_supported_parameter_only_changes_plan_and_unsupported_controls_do_not(self) -> None:
        controls = {
            "speed": True, "volume": True, "stability": True, "similarity": True,
            "language": True, "textNormalization": True, "pitch": False, "emotion": False, "instruction": False,
        }
        config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.0, 5, 0, controls=controls)
        row = {
            "key": "action.riichi", "line": "立直", "tts_text": "立直", "locale": "zh-CN",
            "speed": "1", "volume": "0", "stability": "1", "similarity": "1",
            "language_override": "", "text_normalization": "true", "pitch": "",
        }
        filenames = voice.validate_unique_keys([row])
        first_plan, _ = voice.build_generation_plan([row], filenames, {}, self.output, config, False)
        first = first_plan[0]
        self.output.files.add(first.filename)
        cache = {first.key: voice.cache_entry(first.key, first.line, first.tts_text, first.filename, first.fingerprint, config, first.settings, first.effective)}

        for field, value in (
            ("speed", "1.15"), ("volume", "2"), ("stability", "0.9"), ("similarity", "0.9"),
            ("language_override", "ja-JP"), ("text_normalization", "false"),
        ):
            plan, _ = voice.build_generation_plan([dict(row, **{field: value})], filenames, cache, self.output, config, False)
            self.assertEqual(plan[0].status, "changed", field)
            self.assertEqual(voice.plan_summary(plan, [])["api_calls"], 1, field)
            self.assertNotEqual(plan[0].fingerprint, first.fingerprint, field)
            self.assertNotEqual(plan[0].effective, first.effective, field)

        unchanged, _ = voice.build_generation_plan([dict(row, pitch="3")], filenames, cache, self.output, config, False)
        self.assertEqual(unchanged[0].status, "unchanged")
        self.assertEqual(voice.plan_summary(unchanged, [])["api_calls"], 0)

    def test_legacy_cache_with_new_default_csv_columns_remains_unchanged(self) -> None:
        row = {"key": "action.riichi", "line": "立直", "tts_text": "立直", "locale": "zh-CN", "speed": "1", "volume": "0", "stability": "1", "similarity": "1", "language_override": "", "text_normalization": "true"}
        filename = voice.validate_unique_keys([row])[row["key"]]
        self.output.files.add(filename)
        legacy = {row["key"]: {"key": row["key"], "fingerprint": voice.legacy_cache_hash(self.config, "立直"), "voiceId": self.config.voice_id, "modelId": self.config.model_id, "speed": 1.0, "format": "mp3", "file": filename}}
        plan, _ = voice.build_generation_plan([row], {row["key"]: filename}, legacy, self.output, self.config, False)
        self.assertEqual(plan[0].status, "unchanged")

    def test_legacy_cache_rejects_each_supported_numeric_setting_when_it_differs_from_defaults(self) -> None:
        controls = {"speed": True, "volume": True, "pitch": False, "stability": True, "similarity": True, "language": True, "textNormalization": True, "emotion": False, "instruction": False}
        config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.0, 5, 0, controls=controls)
        row = {"key": "action.riichi", "line": "立直", "tts_text": "立直", "locale": "zh-CN", "speed": "1", "volume": "0", "stability": "1", "similarity": "1", "language_override": "", "text_normalization": "true"}
        filename = voice.validate_unique_keys([row])[row["key"]]
        self.output.files.add(filename)
        legacy = {row["key"]: {"key": row["key"], "fingerprint": voice.legacy_cache_hash(config, "立直"), "voiceId": config.voice_id, "modelId": config.model_id, "speed": 1.0, "format": "mp3", "file": filename}}
        for field, value in (("speed", "1.15"), ("volume", "2"), ("stability", "0.9"), ("similarity", "0.9")):
            plan, _ = voice.build_generation_plan([dict(row, **{field: value})], {row["key"]: filename}, legacy, self.output, config, False)
            self.assertEqual(plan[0].status, "changed", field)
            self.assertEqual(voice.plan_summary(plan, [])["api_calls"], 1, field)

    def test_incomplete_capability_snapshot_is_legacy_not_an_implicit_false_for_numeric_controls(self) -> None:
        config = voice.FishAudioConfig("https://example.invalid", "voice-a", "model-a", "mp3", 1.0, 5, 0, controls={"language": True})
        effective = voice.resolve_effective_generation_config({"line": "立直", "speed": "1.15"}, config, "zh-CN")
        self.assertEqual(effective.speed, 1.15)

    def test_synthesis_settings_contract_normalizes_legacy_empty_and_language_inheritance(self) -> None:
        legacy = {"key": "action.riichi", "line": "立直", "tts_text": "立直", "locale": "ja-JP"}
        empty = dict(legacy, speed="", volume="", stability="", similarity="", language_override="", text_normalization="")
        self.assertEqual(
            voice.synthesis_settings_for_row(legacy, self.config, "zh-CN"),
            voice.VoiceSynthesisSettings(1.0, 0.0, 1.0, 1.0, "zh-CN", True),
        )
        self.assertEqual(
            voice.synthesis_settings_for_row(empty, self.config, "zh-CN"),
            voice.VoiceSynthesisSettings(1.0, 0.0, 1.0, 1.0, "zh-CN", True),
        )
        self.assertFalse(voice.synthesis_settings_for_row(dict(legacy, text_normalization="false"), self.config, "zh-CN").text_normalization)
        self.assertEqual(voice.synthesis_settings_for_row(dict(legacy, language_override="en-US"), self.config, "zh-CN").language, "en-US")

    def test_matches_shared_python_browser_fingerprint_fixtures(self) -> None:
        fixture_path = Path(__file__).parent / "voice" / "voiceFingerprint.fixture.json"
        fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))["cases"]
        for fixture in fixtures:
            config = voice.FishAudioConfig("https://example.invalid", fixture["voiceId"], fixture["modelId"], fixture["format"], 1.0, 0, 0)
            effective = voice.EffectiveGenerationConfig(
                fixture["ttsText"], fixture["voiceId"], fixture["modelId"], fixture["format"],
                float(fixture["speed"]), float(fixture["volume"]), float(fixture["stability"]), float(fixture["similarity"]), fixture["language"], fixture["textNormalization"],
            )
            self.assertEqual(voice.effective_config_fingerprint(effective), fixture["fingerprint"], fixture["name"])

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
