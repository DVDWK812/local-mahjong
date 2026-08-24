#!/usr/bin/env python3
"""Batch-generate Fish Audio TTS assets from a UTF-8 CSV voice-line sheet.

The CSV remains the single source of truth.  This program deliberately has no
dependency on the game application, so it can be reused for any voice pack.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
import requests
from requests import Response
from requests.exceptions import RequestException


PROJECT_ROOT = Path(__file__).resolve().parents[2]
VOICE_LINES_ROOT = PROJECT_ROOT / "src" / "music" / "voice_lines"
DEFAULT_PACK = VOICE_LINES_ROOT / "xiaozhang"
DEFAULT_CONFIG = Path(__file__).resolve().parent / "config" / "fish_audio.example.json"
DEFAULT_API_KEYS_FILE = PROJECT_ROOT / ".secrets" / "fish_audio_api_keys.txt"
SYNTHESIS_SETTINGS_CONTRACT = Path(__file__).resolve().parent / "voice" / "voiceSynthesisSettings.contract.json"
REQUIRED_COLUMNS = {"key", "category", "action", "line", "locale", "character", "emotion"}
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
# Rate limiting is shared service pressure, not a reason to consume another key.
# 401/402 are the only credential/quota statuses eligible for a key rotation.
KEY_ROTATION_STATUS_CODES = {401, 402}
SUPPORTED_CSV_ENCODINGS = ("utf-8", "gbk", "gb18030", "cp936")
KNOWN_KEY_RECOMMENDATIONS = {
    "yaku.三倍役满": "yaku.triple_yakuman",
    "yaku.四倍役满": "yaku.quadruple_yakuman",
}


@dataclass(frozen=True)
class FishAudioConfig:
    """Connection and synthesis settings, with no secret material."""

    endpoint: str
    voice_id: str
    model_id: str
    audio_format: str
    speed: float
    timeout_seconds: int
    retries: int
    # Captured v3 model capability controls from pack.json.  Legacy Packs omit
    # this field and retain their established six-control request semantics.
    controls: dict[str, bool] | None = None


@dataclass
class GenerationRecord:
    """A serializable latest result for one CSV key."""

    key: str
    line: str
    ttsText: str
    voiceId: str
    modelId: str
    generatedAt: str
    file: str | None
    status: str
    speed: float = 1.0
    volume: float = 0.0
    stability: float = 1.0
    similarity: float = 1.0
    language: str = ""
    textNormalization: bool = True
    error: str | None = None
    httpStatus: int | None = None
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class GenerationPlanItem:
    """One key's deterministic generation decision, computed without API access."""

    key: str
    line: str
    tts_text: str
    filename: str
    fingerprint: str
    status: str
    reason: str
    settings: "VoiceSynthesisSettings"
    effective: "EffectiveGenerationConfig"


@dataclass(frozen=True)
class VoiceSynthesisSettings:
    """Per-line Fish TTS controls persisted in the Voice Pack CSV."""

    speed: float
    volume: float
    stability: float
    similarity: float
    language: str
    text_normalization: bool
    # These controls intentionally remain unset for legacy CSV rows.  An
    # omitted pitch is not the same persisted value as an explicit 0.
    pitch: float | None = None
    tts_emotion: str = ""
    tts_instruction: str = ""


@dataclass(frozen=True)
class EffectiveGenerationConfig:
    """The single resolved TTS identity for planning, cache, and request payloads."""

    text: str
    voice_id: str
    model_id: str
    audio_format: str
    speed: float | None
    volume: float | None
    stability: float | None
    similarity: float | None
    effective_language: str | None
    text_normalization: bool | None
    pitch: float | None = None
    tts_emotion: str = ""
    tts_instruction: str = ""


def load_synthesis_defaults() -> dict[str, Any]:
    """Load the shared CSV-default contract used by the browser and local Bridge."""
    try:
        value = json.loads(SYNTHESIS_SETTINGS_CONTRACT.read_text(encoding="utf-8"))
        defaults = value.get("defaults", {})
        if value.get("schemaVersion") != 1 or not isinstance(defaults, dict):
            raise ValueError("invalid synthesis settings contract")
        return defaults
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"Could not load synthesis settings contract: {exc}") from exc


SYNTHESIS_DEFAULTS = load_synthesis_defaults()
DEFAULT_SPEED = float(SYNTHESIS_DEFAULTS["speed"])
DEFAULT_VOLUME = float(SYNTHESIS_DEFAULTS["volume"])
DEFAULT_STABILITY = float(SYNTHESIS_DEFAULTS["stability"])
DEFAULT_SIMILARITY = float(SYNTHESIS_DEFAULTS["similarity"])
DEFAULT_TEXT_NORMALIZATION = bool(SYNTHESIS_DEFAULTS["text_normalization"])
FINGERPRINT_VERSION = "voice-fingerprint-v2"
CAPABILITY_CONTROL_NAMES = (
    "speed", "volume", "pitch", "stability", "similarity", "language",
    "textNormalization", "emotion", "instruction",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch-generate Fish Audio voice assets from CSV.")
    parser.add_argument("--pack", type=Path, help="Voice Pack root (default: src/music/voice_lines/xiaozhang).")
    parser.add_argument("--csv", type=Path, help="CSV source (default: <pack>/voice_lines.csv).")
    parser.add_argument("--output", type=Path, help="Voice Pack root for audio/, logs, and manifest.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Fish Audio non-secret JSON config.")
    parser.add_argument("--voice-id", help="Override voiceId from config for a new character.")
    parser.add_argument("--model-id", help="Override modelId from config.")
    parser.add_argument("--character", help="Manifest character name (defaults to CSV, or the output folder name).")
    parser.add_argument("--limit", type=int, help="Generate at most this many eligible CSV rows.")
    parser.add_argument("--keys", help="Comma-separated CSV key filter for safe single or selected-line generation.")
    parser.add_argument("--retries", type=int, help="Override retry count for network/429/5xx failures.")
    parser.add_argument("--dry-run", action="store_true", help="Validate CSV and show planned rows without an API request or writes.")
    parser.add_argument(
        "--migrate-pack",
        action="store_true",
        help="Rewrite legacy cache/log/manifest for the Pack layout only when every entry is unchanged; never calls Fish Audio.",
    )
    parser.add_argument("--force", action="store_true", help="Regenerate even when the cache and output file match.")
    parser.add_argument("--json", action="store_true", help="Append a machine-readable plan/result JSON record to stdout.")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.retries is not None and args.retries < 0:
        parser.error("--retries cannot be negative")
    return args


def parse_key_filter(value: str | None) -> list[str]:
    """Parse an optional comma-separated key selection without accepting empty keys."""
    if value is None:
        return []
    keys = [key.strip() for key in value.split(",")]
    if not keys or any(not key for key in keys):
        raise ValueError("--keys must contain one or more comma-separated CSV keys")
    if len(set(keys)) != len(keys):
        raise ValueError("--keys must not contain duplicate keys")
    return keys


def configure_json_streams(args: argparse.Namespace) -> None:
    """Force UTF-8 pipes on Windows so --json is safe for the local Bridge."""
    if args.json:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")


def cli_log(args: argparse.Namespace, message: str) -> None:
    """Keep the machine-readable stdout channel pristine when --json is selected."""
    print(message, file=sys.stderr if args.json else sys.stdout)


def json_result(
    *, success: bool, generated: int = 0, failed: int = 0, skipped: int = 0,
    items: list[dict[str, Any]] | None = None, error_code: str | None = None,
    error_message: str | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "success": success,
        "generated": generated,
        "failed": failed,
        "skipped": skipped,
        "items": items or [],
    }
    if error_code and error_message:
        result["error"] = {"code": error_code, "message": error_message}
    return {"kind": "result", "result": result}


def cli_failure(args: argparse.Namespace, code: str, message: str, exit_code: int = 2) -> int:
    """Return an inspectable, secret-free error response on known --json failure paths."""
    if args.json:
        print(json.dumps(json_result(success=False, failed=1, error_code=code, error_message=message), ensure_ascii=False))
    else:
        print(f"Error: {message}", file=sys.stderr)
    return exit_code


def resolve_path(path: Path) -> Path:
    """Resolve command-line relative paths from the project root, not the shell CWD."""
    return path if path.is_absolute() else PROJECT_ROOT / path


def load_pack_metadata(path: Path) -> dict[str, Any]:
    """Load optional non-secret Pack metadata without coupling it to game code."""
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Pack file is not valid JSON: {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"Pack file must contain a JSON object: {path}")
    return data


def load_config(path: Path, args: argparse.Namespace, pack_metadata: dict[str, Any] | None = None) -> FishAudioConfig:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Config file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Config file is not valid JSON: {path}: {exc}") from exc

    required = ("endpoint", "voiceId", "modelId", "format")
    missing = [name for name in required if not str(data.get(name, "")).strip()]
    if missing:
        raise ValueError(f"Config missing required value(s): {', '.join(missing)}")

    controls = normalized_capability_controls((pack_metadata or {}).get("ttsControls"))
    return FishAudioConfig(
        endpoint=str(data["endpoint"]),
        voice_id=args.voice_id or str((pack_metadata or {}).get("voiceId") or data["voiceId"]),
        model_id=args.model_id or str((pack_metadata or {}).get("modelId") or data["modelId"]),
        audio_format=str(data["format"]),
        speed=float(data.get("speed", 1.0)),
        timeout_seconds=int(data.get("timeoutSeconds", 90)),
        retries=args.retries if args.retries is not None else int(data.get("retries", 2)),
        controls=controls,
    )


def detect_csv_encoding(contents: bytes, csv_path: Path) -> tuple[str, str]:
    """Decode a voice-line CSV using the supported encodings in a safe order."""
    if contents.startswith(b"\xef\xbb\xbf"):
        try:
            return contents.decode("utf-8-sig"), "utf-8-sig"
        except UnicodeDecodeError as exc:
            raise ValueError(f"CSV decode failed (detected encoding: utf-8-sig): {csv_path}: {exc}") from exc

    for encoding in SUPPORTED_CSV_ENCODINGS:
        try:
            return contents.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    attempted = ", ".join(SUPPORTED_CSV_ENCODINGS)
    raise ValueError(
        f"CSV decode failed (detected encoding: none; attempted: {attempted}): {csv_path}"
    )


def validate_csv_fields(frame: pd.DataFrame, detected_encoding: str, csv_path: Path) -> None:
    """Check the stable CSV contract without rejecting future, unknown columns."""
    duplicated = frame.columns[frame.columns.duplicated()].tolist()
    if duplicated:
        raise ValueError(
            f"CSV has duplicate field(s) (detected encoding: {detected_encoding}): {', '.join(map(str, duplicated))}"
        )
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(
            f"CSV is missing required field(s) (detected encoding: {detected_encoding}): {', '.join(sorted(missing))}"
        )


def save_csv_as_utf8_bom(frame: pd.DataFrame, csv_path: Path) -> None:
    """Normalize a successfully validated source CSV to UTF-8 with a BOM."""
    temporary = csv_path.with_suffix(f"{csv_path.suffix}.utf8-bom.part")
    frame.to_csv(temporary, index=False, encoding="utf-8-sig", lineterminator="\n")
    temporary.replace(csv_path)


def load_lines(csv_path: Path) -> tuple[list[dict[str, str]], str]:
    """Detect encoding, validate CSV fields, and normalize the source to UTF-8 BOM."""
    try:
        contents = csv_path.read_bytes()
    except FileNotFoundError as exc:
        raise ValueError(f"CSV file not found (detected encoding: unavailable): {csv_path}") from exc
    except OSError as exc:
        raise ValueError(f"CSV could not be read (detected encoding: unavailable): {csv_path}: {exc}") from exc

    text, detected_encoding = detect_csv_encoding(contents, csv_path)
    try:
        frame = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    except pd.errors.ParserError as exc:
        raise ValueError(
            f"CSV parsing failed (detected encoding: {detected_encoding}): {csv_path}: {exc}"
        ) from exc

    validate_csv_fields(frame, detected_encoding, csv_path)
    try:
        save_csv_as_utf8_bom(frame, csv_path)
    except OSError as exc:
        raise ValueError(
            f"CSV UTF-8 BOM normalization failed (detected encoding: {detected_encoding}): {csv_path}: {exc}"
        ) from exc
    rows = [{name: str(value) for name, value in row.items()} for row in frame.to_dict("records")]
    return rows, detected_encoding


def filename_for_key(key: str) -> str:
    """Map only a key to a portable ASCII filename without losing uniqueness."""
    parts: list[str] = []
    for character in key.strip():
        if character == ".":
            parts.append("_")
        elif character.isascii() and (character.isalnum() or character in "_-"):
            parts.append(character)
        else:
            parts.append(f"_u{ord(character):04x}_")
    stem = "".join(parts).strip("_")
    if not stem:
        stem = f"key_{hashlib.sha256(key.encode('utf-8')).hexdigest()[:12]}"
    return f"{stem}.mp3"


def get_tts_text(row: dict[str, Any]) -> str:
    """Return the actual TTS input, falling back to the human-readable line."""
    line = str(row.get("line", "")).strip()
    candidate = row.get("tts_text")
    if candidate is None:
        return line
    try:
        if bool(pd.isna(candidate)):
            return line
    except (TypeError, ValueError):
        pass
    value = str(candidate)
    return value if value.strip() else line


def legacy_cache_hash(config: FishAudioConfig, tts_text: str) -> str:
    """Phase 0–8 fingerprint retained solely for safe default-setting migration."""
    payload = "\x1f".join((
        config.voice_id,
        config.model_id,
        tts_text,
        str(config.speed),
        config.audio_format,
    ))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def v1_cache_hash(config: FishAudioConfig, tts_text: str, settings: VoiceSynthesisSettings) -> str:
    """Unversioned Phase 8.5.2 advanced-settings fingerprint retained for cache migration."""
    payload = "\x1f".join((
        config.voice_id,
        config.model_id,
        tts_text,
        str(settings.speed),
        config.audio_format,
        str(settings.volume),
        str(settings.stability),
        str(settings.similarity),
        settings.language,
        "true" if settings.text_normalization else "false",
    ))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonical_effective_config_payload(effective: EffectiveGenerationConfig) -> str:
    """Fixed-order v2 identity shared with effectiveGenerationConfig.ts."""
    return "\x1f".join((
        FINGERPRINT_VERSION, effective.text, effective.voice_id, effective.model_id, effective.audio_format,
        "" if effective.speed is None else str(effective.speed), "" if effective.volume is None else str(effective.volume), "" if effective.stability is None else str(effective.stability), "" if effective.similarity is None else str(effective.similarity),
        effective.effective_language or "", "" if effective.text_normalization is None else ("true" if effective.text_normalization else "false"),
        "" if effective.pitch is None else str(effective.pitch), effective.tts_emotion, effective.tts_instruction,
    ))


def effective_config_fingerprint(effective: EffectiveGenerationConfig) -> str:
    return hashlib.sha256(canonical_effective_config_payload(effective).encode("utf-8")).hexdigest()


def cache_hash(config: FishAudioConfig, tts_text: str, settings: VoiceSynthesisSettings | None = None) -> str:
    """Compatibility helper used only when reading unversioned cache formats."""
    return legacy_cache_hash(config, tts_text) if settings is None else v1_cache_hash(config, tts_text, settings)


def _number_setting(row: dict[str, Any], field: str, default: float, minimum: float, maximum: float) -> float:
    value = str(row.get(field, "")).strip()
    if not value:
        return default
    try:
        number = float(value)
    except ValueError as exc:
        raise ValueError(f"invalid {field}: {value!r}") from exc
    if not minimum <= number <= maximum:
        raise ValueError(f"invalid {field}: must be between {minimum} and {maximum}")
    return number


def _boolean_setting(row: dict[str, Any], field: str, default: bool) -> bool:
    value = str(row.get(field, "")).strip().lower()
    if not value:
        return default
    if value == "true":
        return True
    if value == "false":
        return False
    raise ValueError(f"invalid {field}: expected true or false")


def synthesis_settings_for_row(
    row: dict[str, Any], config: FishAudioConfig, pack_locale: str = ""
) -> VoiceSynthesisSettings:
    """Resolve legacy blank fields to the no-regeneration Fish-compatible defaults."""
    return VoiceSynthesisSettings(
        speed=_number_setting(row, "speed", DEFAULT_SPEED, 0.5, 2.0),
        volume=_number_setting(row, "volume", DEFAULT_VOLUME, -20.0, 20.0),
        stability=_number_setting(row, "stability", DEFAULT_STABILITY, 0.0, 1.0),
        similarity=_number_setting(row, "similarity", DEFAULT_SIMILARITY, 0.0, 1.0),
        language=str(row.get("language_override", "")).strip() or pack_locale.strip() or str(row.get("locale", "")).strip(),
        text_normalization=_boolean_setting(row, "text_normalization", DEFAULT_TEXT_NORMALIZATION),
        pitch=_number_setting(row, "pitch", 0.0, -12.0, 12.0) if str(row.get("pitch", "")).strip() else None,
        tts_emotion=str(row.get("tts_emotion", "")).strip(),
        tts_instruction=str(row.get("tts_instruction", "")),
    )


def normalized_capability_controls(raw_controls: Any) -> dict[str, bool] | None:
    """Accept only a complete discovery snapshot; partial old data is legacy."""
    if not isinstance(raw_controls, dict):
        return None
    if not all(isinstance(raw_controls.get(name), bool) for name in CAPABILITY_CONTROL_NAMES):
        return None
    return {name: bool(raw_controls[name]) for name in CAPABILITY_CONTROL_NAMES}


def resolve_effective_generation_config(
    row: dict[str, Any], config: FishAudioConfig, pack_locale: str = ""
) -> EffectiveGenerationConfig:
    """Resolve text and all active controls exactly once for plan, hash, and Fish payload."""
    settings = synthesis_settings_for_row(row, config, pack_locale)
    controls = normalized_capability_controls(config.controls)
    # A missing capability snapshot means this is a legacy Pack: preserve the
    # pre-v3 six controls, while treating the three new controls as unset.
    def supported(control: str, *, legacy: bool = True) -> bool:
        return legacy if controls is None else controls.get(control) is True
    return EffectiveGenerationConfig(
        text=get_tts_text(row), voice_id=config.voice_id, model_id=config.model_id, audio_format=config.audio_format,
        speed=settings.speed if supported("speed") else None,
        volume=settings.volume if supported("volume") else None,
        stability=settings.stability if supported("stability") else None,
        similarity=settings.similarity if supported("similarity") else None,
        effective_language=settings.language if supported("language") else None,
        text_normalization=settings.text_normalization if supported("textNormalization") else None,
        pitch=settings.pitch if supported("pitch", legacy=False) else None,
        tts_emotion=settings.tts_emotion if settings.tts_emotion and supported("emotion", legacy=False) else "",
        tts_instruction=settings.tts_instruction if settings.tts_instruction and supported("instruction", legacy=False) else "",
    )


def recommended_key(key: str) -> str:
    """Give a stable, explicitly manual English-key recommendation for reports."""
    if key in KNOWN_KEY_RECOMMENDATIONS:
        return KNOWN_KEY_RECOMMENDATIONS[key]
    prefix = key.split(".", maxsplit=1)[0] if "." in key else "voice"
    suffix = hashlib.sha256(key.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}.replace_with_english_{suffix}"


def build_key_report(rows: Iterable[dict[str, str]]) -> dict[str, Any]:
    """List non-ASCII keys without changing the source CSV."""
    issues = [
        {
            "key": row.get("key", "").strip(),
            "suggestedKey": recommended_key(row.get("key", "").strip()),
            "note": "Key contains non-ASCII characters. Recommend using an English key.",
        }
        for row in rows
        if row.get("key", "").strip() and not row.get("key", "").strip().isascii()
    ]
    return {"nonAsciiKeys": issues}


def validate_unique_keys(rows: Iterable[dict[str, str]]) -> dict[str, str]:
    """Fail before any API call if a CSV key or its derived filename is ambiguous."""
    filenames: dict[str, str] = {}
    keys: set[str] = set()
    duplicate_keys: list[str] = []
    duplicate_filenames: list[tuple[str, str, str]] = []
    for row in rows:
        key = row.get("key", "").strip()
        if not key:
            continue
        if key in keys:
            duplicate_keys.append(key)
            continue
        keys.add(key)
        filename = filename_for_key(key)
        previous_key = filenames.get(filename)
        if previous_key is not None and previous_key != key:
            duplicate_filenames.append((filename, previous_key, key))
            continue
        filenames[filename] = key

    errors: list[str] = []
    if duplicate_keys:
        errors.append(f"Duplicate key: {', '.join(sorted(set(duplicate_keys)))}")
    for filename, first_key, second_key in duplicate_filenames:
        errors.append(f"Duplicate filename: {filename} (keys: {first_key!r}, {second_key!r})")
    if errors:
        raise ValueError("CSV uniqueness validation failed. Please modify the CSV. " + "; ".join(errors))
    return {key: filename for filename, key in filenames.items()}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json_list(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return value if isinstance(value, list) else []


def read_voice_cache(path: Path, config: FishAudioConfig) -> dict[str, dict[str, Any]]:
    """Read a key-indexed cache and migrate the prior hash-indexed format in memory."""
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return migrate_voice_cache(value, config)


def migrate_voice_cache(value: Any, config: FishAudioConfig) -> dict[str, dict[str, Any]]:
    """Normalize a parsed legacy/new cache without requiring filesystem access."""
    if not isinstance(value, dict):
        return {}
    cache: dict[str, dict[str, Any]] = {}
    for index, item in value.items():
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or index)
        if not key:
            continue
        migrated = dict(item)
        # Legacy caches stored the API input as `text`; retain it as ttsText.
        migrated.setdefault("ttsText", str(migrated.get("text", "")))
        migrated.setdefault("line", str(migrated.get("text", "")))
        # Recalculate legacy fingerprints when their stored sound parameters
        # match the active configuration. This is safe because the stored text
        # remains part of the fingerprint, and avoids paid regeneration solely
        # due to a prior cache-format/hash-serialization version.
        matches_active_config = (
            migrated.get("voiceId") == config.voice_id
            and migrated.get("modelId") == config.model_id
            and migrated.get("speed") == config.speed
            and migrated.get("format") == config.audio_format
        )
        if matches_active_config and migrated.get("fingerprintVersion") is None and all(
            field not in migrated for field in ("volume", "stability", "similarity", "language", "textNormalization")
        ):
            migrated["fingerprint"] = cache_hash(config, str(migrated.get("ttsText", "")))
        else:
            migrated.setdefault("fingerprint", str(index) if len(str(index)) == 64 else "")
        cache[key] = migrated
    return cache


def cache_entry(
    key: str, line: str, tts_text: str, filename: str, fingerprint: str, config: FishAudioConfig,
    settings: VoiceSynthesisSettings | None = None, effective: EffectiveGenerationConfig | None = None,
) -> dict[str, Any]:
    """Build the only cache representation written by new runs."""
    resolved = settings or VoiceSynthesisSettings(
        DEFAULT_SPEED, DEFAULT_VOLUME, DEFAULT_STABILITY, DEFAULT_SIMILARITY, "", DEFAULT_TEXT_NORMALIZATION
    )
    return {
        "key": key,
        "fingerprint": fingerprint,
        "fingerprintVersion": FINGERPRINT_VERSION if effective is not None else None,
        "line": line,
        "ttsText": tts_text,
        "voiceId": config.voice_id,
        "modelId": config.model_id,
        "speed": resolved.speed,
        "volume": resolved.volume,
        "stability": resolved.stability,
        "similarity": resolved.similarity,
        "language": resolved.language,
        "textNormalization": resolved.text_normalization,
        **({"pitch": resolved.pitch} if resolved.pitch is not None else {}),
        **({"ttsEmotion": resolved.tts_emotion} if resolved.tts_emotion else {}),
        **({"ttsInstruction": resolved.tts_instruction} if resolved.tts_instruction else {}),
        "format": config.audio_format,
        "file": filename,
        "createdAt": utc_now(),
    }


def build_generation_plan(
    rows: Iterable[dict[str, str]],
    filenames_by_key: dict[str, str],
    cache: dict[str, dict[str, Any]],
    output: Path,
    config: FishAudioConfig,
    force: bool,
    pack_locale: str = "",
) -> tuple[list[GenerationPlanItem], list[str]]:
    """Classify every CSV row without API calls or writes.

    A file is unchanged only when it exists and its own key-indexed cache entry
    has an identical content fingerprint. This deliberately never trusts file
    existence alone.
    """
    plan: list[GenerationPlanItem] = []
    csv_keys: set[str] = set()
    for row in rows:
        key = row.get("key", "").strip()
        line = str(row.get("line", "")).strip()
        tts_text = get_tts_text(row)
        fallback_settings = VoiceSynthesisSettings(DEFAULT_SPEED, DEFAULT_VOLUME, DEFAULT_STABILITY, DEFAULT_SIMILARITY, pack_locale, DEFAULT_TEXT_NORMALIZATION)
        fallback_effective = EffectiveGenerationConfig("", config.voice_id, config.model_id, config.audio_format, DEFAULT_SPEED, DEFAULT_VOLUME, DEFAULT_STABILITY, DEFAULT_SIMILARITY, pack_locale, DEFAULT_TEXT_NORMALIZATION)
        if not key:
            plan.append(GenerationPlanItem("", line, tts_text, "", "", "invalid", "empty key", fallback_settings, fallback_effective))
            continue
        csv_keys.add(key)
        filename = filenames_by_key[key]
        if not tts_text.strip():
            plan.append(GenerationPlanItem(key, line, tts_text, filename, "", "invalid", "empty TTS text", fallback_settings, fallback_effective))
            continue
        try:
            effective = resolve_effective_generation_config(row, config, pack_locale)
            settings = synthesis_settings_for_row(row, config, pack_locale)
        except ValueError as exc:
            plan.append(GenerationPlanItem(key, line, tts_text, filename, "", "invalid", str(exc), fallback_settings, fallback_effective))
            continue
        fingerprint = effective_config_fingerprint(effective)
        file_exists = (output / filename).is_file() and (output / filename).stat().st_size > 0
        cached = cache.get(key)
        if force:
            status, reason = "changed", "forced regeneration"
        elif cached is None:
            status, reason = "new", "no cache entry"
        elif not file_exists:
            status, reason = "missing", "cached file is missing"
        elif cached.get("fingerprintVersion") == FINGERPRINT_VERSION and cached.get("fingerprint") == fingerprint:
            status, reason = "unchanged", "file and fingerprint match"
        elif (
            all(field not in cached for field in ("volume", "stability", "similarity", "language", "textNormalization"))
            and settings.speed == DEFAULT_SPEED
            and settings.volume == DEFAULT_VOLUME
            and settings.stability == DEFAULT_STABILITY
            and settings.similarity == DEFAULT_SIMILARITY
            and settings.language == (pack_locale.strip() or str(row.get("locale", "")).strip())
            and settings.text_normalization is DEFAULT_TEXT_NORMALIZATION
            and cached.get("fingerprint") == legacy_cache_hash(config, tts_text)
        ):
            status, reason = "unchanged", "legacy default settings match"
        elif (
            cached.get("fingerprintVersion") is None
            and all(field in cached for field in ("volume", "stability", "similarity", "language", "textNormalization"))
            and cached.get("fingerprint") == v1_cache_hash(config, tts_text, settings)
        ):
            status, reason = "unchanged", "v1 effective settings match"
        else:
            status, reason = "changed", "content fingerprint changed"
        plan.append(GenerationPlanItem(key, line, tts_text, filename, fingerprint, status, reason, settings, effective))
    orphaned = sorted(set(cache).difference(csv_keys))
    return plan, orphaned


def plan_summary(plan: Iterable[GenerationPlanItem], orphaned: Iterable[str]) -> dict[str, int]:
    """Return stable dry-run and test statistics."""
    counts = {"unchanged": 0, "changed": 0, "new": 0, "missing": 0, "invalid": 0}
    for item in plan:
        counts[item.status] = counts.get(item.status, 0) + 1
    counts["orphaned"] = len(list(orphaned))
    counts["api_calls"] = counts["changed"] + counts["new"] + counts["missing"]
    return counts


def filter_generation_plan(
    plan: list[GenerationPlanItem], selected_keys: list[str], valid_keys: Iterable[str]
) -> list[GenerationPlanItem]:
    """Return only explicitly requested keys after rejecting any key not in this Pack."""
    if not selected_keys:
        return plan
    unknown = sorted(set(selected_keys).difference(valid_keys))
    if unknown:
        raise ValueError(f"Unknown CSV key(s): {', '.join(unknown)}")
    wanted = set(selected_keys)
    return [item for item in plan if item.key in wanted]


def json_plan(summary: dict[str, int], plan: Iterable[GenerationPlanItem], pack: Path) -> dict[str, Any]:
    """Expose no credentials or raw TTS text to the local Bridge client."""
    return {
        "kind": "plan",
        "plan": {
            "packId": pack.name,
            "total": sum(1 for _ in plan),
            "unchanged": summary["unchanged"],
            "changed": summary["changed"],
            "new": summary["new"],
            "missing": summary["missing"],
            "apiCalls": summary["api_calls"],
            "items": [
                {"key": item.key, "line": item.line, "file": item.filename, "status": item.status, "reason": item.reason}
                for item in plan
            ],
        },
    }


def write_json(path: Path, value: Any) -> None:
    """Write valid UTF-8 JSON atomically so an interrupted run keeps prior files usable."""
    temporary = path.with_suffix(f"{path.suffix}.part")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_api_keys(path: Path = DEFAULT_API_KEYS_FILE) -> list[str]:
    """Read one Fish Audio key per line without ever logging key material."""
    keys: list[str] = []
    # An explicitly configured shell key takes precedence over local files.
    environment_key = os.environ.get("FISHAUDIO_API_KEY", "").strip()
    if environment_key:
        keys.append(environment_key)
    if path.exists():
        try:
            lines = path.read_text(encoding="utf-8-sig").splitlines()
        except (OSError, UnicodeDecodeError) as exc:
            raise ValueError(f"Could not read API key file: {path}: {exc}") from exc
        for line in lines:
            candidate = line.strip()
            if not candidate or candidate.startswith("#"):
                continue
            if candidate.lower().startswith("fishaudio_api_key="):
                candidate = candidate.split("=", maxsplit=1)[1].strip()
            if candidate.lower().startswith("bearer "):
                candidate = candidate[7:].strip()
            if candidate and candidate not in keys:
                keys.append(candidate)
    return keys


def error_text(response: Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict):
            return str(body.get("message") or body.get("detail") or body)
    except ValueError:
        pass
    return response.text[:500].strip() or f"HTTP {response.status_code}"


def ignored_parameter_warnings(response: Response) -> list[str]:
    """Normalize Fish v3's ignored-control header into safe user diagnostics."""
    raw = response.headers.get("X-OpenAPI-Ignored-Parameters", "")
    return [name.strip() for name in raw.split(",") if name.strip()]


def synthesize(
    session: requests.Session, config: FishAudioConfig, api_key: str,
    effective: EffectiveGenerationConfig | None = None,
) -> tuple[bytes | None, int | None, str | None, list[str]]:
    """Call TTS, explicitly serializing Chinese JSON as UTF-8 bytes."""
    resolved = effective or EffectiveGenerationConfig("", config.voice_id, config.model_id, config.audio_format, DEFAULT_SPEED, DEFAULT_VOLUME, DEFAULT_STABILITY, DEFAULT_SIMILARITY, "", DEFAULT_TEXT_NORMALIZATION)
    payload = {
        "text": resolved.text, "voiceId": resolved.voice_id, "modelId": resolved.model_id, "format": resolved.audio_format,
    }
    optional_controls = {
        "speed": resolved.speed, "volume": resolved.volume, "stability": resolved.stability,
        "similarity": resolved.similarity, "language": resolved.effective_language,
        "textNormalization": resolved.text_normalization, "pitch": resolved.pitch,
        "emotion": resolved.tts_emotion or None, "instruction": resolved.tts_instruction or None,
    }
    payload.update({key: value for key, value in optional_controls.items() if value is not None})
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "audio/mpeg, application/octet-stream, application/json",
        "X-Request-Id": effective_config_fingerprint(resolved),
        "Idempotency-Key": effective_config_fingerprint(resolved),
    }

    for attempt in range(config.retries + 1):
        try:
            response = session.post(
                config.endpoint, headers=headers, data=body, timeout=config.timeout_seconds
            )
        except RequestException as exc:
            if attempt < config.retries:
                time.sleep(2**attempt)
                continue
            return None, None, f"network error: {exc}", []

        if response.ok:
            if response.content:
                return response.content, response.status_code, None, ignored_parameter_warnings(response)
            return None, response.status_code, "API returned an empty audio response", []

        message = error_text(response)
        if response.status_code in RETRYABLE_STATUS_CODES and attempt < config.retries:
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt
            time.sleep(delay)
            continue
        return None, response.status_code, message, []
    return None, None, "unreachable retry state", []


def synthesize_with_api_keys(
    session: requests.Session, config: FishAudioConfig, api_keys: Iterable[str],
    effective: EffectiveGenerationConfig | None = None,
) -> tuple[bytes | None, int | None, str | None, list[str]]:
    """Try keys in file order, rotating only for authentication/rate-limit failures."""
    last_status: int | None = None
    errors: list[str] = []
    for key_index, api_key in enumerate(api_keys, start=1):
        audio, status, error, warnings = synthesize(session, config, api_key, effective)
        if audio is not None:
            return audio, status, None, warnings
        last_status = status
        errors.append(f"key #{key_index}: HTTP {status or '-'} {error or 'generation failed'}")
        if status not in KEY_ROTATION_STATUS_CODES:
            # A validation or network error is not credential-specific.
            return None, status, errors[-1], []
    return None, last_status, "All configured API keys failed. " + "; ".join(errors), []


def make_record(
    key: str, line: str, tts_text: str, config: FishAudioConfig, filename: str | None, status: str,
    settings: VoiceSynthesisSettings | None = None,
    error: str | None = None, http_status: int | None = None, warnings: list[str] | None = None,
) -> GenerationRecord:
    resolved = settings or VoiceSynthesisSettings(DEFAULT_SPEED, DEFAULT_VOLUME, DEFAULT_STABILITY, DEFAULT_SIMILARITY, "", DEFAULT_TEXT_NORMALIZATION)
    return GenerationRecord(
        key=key,
        line=line,
        ttsText=tts_text,
        voiceId=config.voice_id,
        modelId=config.model_id,
        generatedAt=utc_now(),
        file=filename,
        status=status,
        speed=resolved.speed,
        volume=resolved.volume,
        stability=resolved.stability,
        similarity=resolved.similarity,
        language=resolved.language,
        textNormalization=resolved.text_normalization,
        error=error,
        httpStatus=http_status,
        warnings=warnings or [],
    )


def build_manifest(character: str, config: FishAudioConfig, records: Iterable[dict[str, Any]], audio_dir: Path) -> dict[str, Any]:
    voices: dict[str, dict[str, str]] = {}
    for record in records:
        filename = record.get("file")
        if record.get("status") in {"generated", "reused", "skipped"} and isinstance(filename, str) and (audio_dir / filename).is_file():
            voices[str(record["key"])] = {"file": f"audio/{filename}"}
    return {"character": character, "voiceId": config.voice_id, "voices": voices}


def build_pack_metadata(
    existing: dict[str, Any], character: str, locale: str, config: FishAudioConfig
) -> dict[str, Any]:
    """Preserve optional Pack metadata while maintaining its required identity fields."""
    metadata = dict(existing)
    metadata.update(
        {
            "id": str(metadata.get("id") or character),
            "name": str(metadata.get("name") or character),
            "locale": str(metadata.get("locale") or locale or "zh-CN"),
            "voiceId": config.voice_id,
            "modelId": config.model_id,
        }
    )
    return metadata


def migrate_pack_metadata(
    output: Path,
    audio_dir: Path,
    rows: list[dict[str, str]],
    plan: list[GenerationPlanItem],
    cache: dict[str, dict[str, Any]],
    config: FishAudioConfig,
    pack_metadata: dict[str, Any],
    character: str,
    key_report: dict[str, Any],
) -> None:
    """Safely rewrite Pack metadata after a verified all-unchanged plan.

    This deliberately has no API-key or network dependency. Existing audio is
    only referenced, never altered, and cache timestamps are retained.
    """
    refreshed_cache: dict[str, dict[str, Any]] = {}
    for item in plan:
        previous = cache[item.key]
        refreshed = cache_entry(item.key, item.line, item.tts_text, item.filename, item.fingerprint, config, item.settings, item.effective)
        refreshed["createdAt"] = previous.get("createdAt", refreshed["createdAt"])
        refreshed_cache[item.key] = refreshed

    prior_records = {str(record.get("key")): record for record in read_json_list(output / "generation_log.json")}
    records: list[dict[str, Any]] = []
    for item in plan:
        previous = dict(prior_records.get(item.key, {}))
        previous.update(
            {
                "key": item.key,
                "line": item.line,
                "ttsText": item.tts_text,
                "voiceId": config.voice_id,
                "modelId": config.model_id,
                "file": item.filename,
                "status": str(previous.get("status") or "reused"),
                "speed": item.settings.speed,
                "volume": item.settings.volume,
                "stability": item.settings.stability,
                "similarity": item.settings.similarity,
                "language": item.settings.language,
                "textNormalization": item.settings.text_normalization,
            }
        )
        previous.pop("text", None)
        records.append(previous)

    write_json(output / ".voice_cache.json", refreshed_cache)
    write_json(output / "generation_log.json", records)
    write_json(output / "failed.json", [record for record in records if record.get("status") == "failed"])
    write_json(output / "voice_key_report.json", key_report)
    locale = rows[0].get("locale", "") if rows else ""
    write_json(output / "pack.json", build_pack_metadata(pack_metadata, character, locale, config))
    write_json(output / "manifest.json", build_manifest(character, config, records, audio_dir))


def main() -> int:
    args = parse_args()
    configure_json_streams(args)
    if args.pack and args.output and resolve_path(args.pack) != resolve_path(args.output):
        return cli_failure(args, "ARGUMENT_INVALID", "--pack and --output must refer to the same Voice Pack directory.")
    output = resolve_path(args.pack or args.output) if (args.pack or args.output) else DEFAULT_PACK
    csv_path = resolve_path(args.csv) if args.csv else output / "voice_lines.csv"
    config_path = resolve_path(args.config)
    try:
        pack_metadata = load_pack_metadata(output / "pack.json")
        config = load_config(config_path, args, pack_metadata)
        rows, detected_encoding = load_lines(csv_path)
    except ValueError as exc:
        return cli_failure(args, "PACK_OR_CSV_INVALID", str(exc))

    try:
        filenames_by_key = validate_unique_keys(rows)
    except ValueError as exc:
        return cli_failure(args, "CSV_KEYS_INVALID", str(exc))

    cli_log(args, f"Loaded CSV (detected encoding: {detected_encoding}); saved as UTF-8 BOM.")
    cache_path = output / ".voice_cache.json"
    cache = read_voice_cache(cache_path, config)
    audio_dir = output / "audio"
    pack_locale = str(pack_metadata.get("locale", "")).strip()
    full_plan, orphaned = build_generation_plan(rows, filenames_by_key, cache, audio_dir, config, args.force, pack_locale)
    try:
        selected_keys = parse_key_filter(args.keys)
        plan = filter_generation_plan(full_plan, selected_keys, filenames_by_key)
    except ValueError as exc:
        return cli_failure(args, "KEY_SELECTION_INVALID", str(exc))
    if args.limit:
        plan = plan[: args.limit]
    plan_orphaned = orphaned if not selected_keys else []
    summary = plan_summary(plan, plan_orphaned)
    key_report = build_key_report(rows)
    for issue in key_report["nonAsciiKeys"]:
        print(f"Warning: {issue['key']!r}. {issue['note']} Suggested: {issue['suggestedKey']}", file=sys.stderr)

    if args.dry_run:
        if args.json:
            print(json.dumps(json_plan(summary, plan, output), ensure_ascii=False))
            return 0
        print("Voice generation plan:")
        print(f"unchanged: {summary['unchanged']}")
        print(f"changed:   {summary['changed']}")
        print(f"new:       {summary['new']}")
        print(f"missing:   {summary['missing']}")
        print(f"orphaned:  {summary['orphaned']}")
        print(f"API calls: {summary['api_calls']}")
        for key in plan_orphaned:
            print(f"Orphaned cache key (kept): {key}")
        for item in plan:
            if item.status in {"changed", "new", "missing"}:
                print(f"Will generate: {item.filename} ({item.reason})")
                if item.status == "changed":
                    print(f"CHANGED {item.key}\nline: {item.line}\ntts_text: {item.tts_text}")
            elif item.status == "invalid":
                print(f"Failed validation: {item.reason}", file=sys.stderr)
        print(f"Validated {len(rows)} CSV rows; dry run would process {len(plan)} row(s).")
        return 0

    csv_character = rows[0].get("character", "").strip() if rows else ""
    character = args.character or (output.name if csv_character in {"", "default"} else csv_character)
    if args.migrate_pack:
        non_migratable = [item for item in full_plan if item.status != "unchanged"]
        if non_migratable:
            return cli_failure(args, "MIGRATION_REFUSED", "migration refused because the Pack is not fully unchanged; use --dry-run to inspect it.")
        output.mkdir(parents=True, exist_ok=True)
        audio_dir.mkdir(parents=True, exist_ok=True)
        migrate_pack_metadata(
            output, audio_dir, rows, full_plan, cache, config, pack_metadata, character or "default", key_report
        )
        cli_log(args, f"Migrated Voice Pack metadata only; API calls: 0; output={output}")
        return 0

    output.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(parents=True, exist_ok=True)
    write_json(output / "voice_key_report.json", key_report)
    log_path = output / "generation_log.json"
    records_by_key = {str(item.get("key")): item for item in read_json_list(log_path) if item.get("key")}
    requires_api = summary["api_calls"] > 0
    api_keys: list[str] = []
    if requires_api:
        try:
            api_keys = load_api_keys()
        except ValueError as exc:
            return cli_failure(args, "API_KEY_UNAVAILABLE", "No configured Fish Audio API key is available.")
        if not api_keys:
            return cli_failure(args, "API_KEY_UNAVAILABLE", "No configured Fish Audio API key is available.")
        cli_log(args, f"Loaded {len(api_keys)} API key(s) for credential rotation.")

    generated = skipped = failed = 0
    session = requests.Session()
    for row_number, item in enumerate(plan, start=2):
        if item.status == "invalid":
            identifier = item.key or f"__row_{row_number}"
            records_by_key[identifier] = asdict(make_record(identifier, item.line, item.tts_text, config, item.filename or None, "failed", item.settings, item.reason))
            failed += 1
            continue
        if item.status == "unchanged":
            # Keep UI text current in diagnostics even when the TTS input did not change.
            cache[item.key]["line"] = item.line
            cache[item.key]["ttsText"] = item.tts_text
            records_by_key[item.key] = asdict(make_record(item.key, item.line, item.tts_text, config, item.filename, "skipped", item.settings))
            skipped += 1
            cli_log(args, f"Skip: {item.filename} ({item.reason})")
            continue

        destination = audio_dir / item.filename
        audio, http_status, error, warnings = synthesize_with_api_keys(session, config, api_keys, item.effective)
        if audio is None:
            records_by_key[item.key] = asdict(make_record(item.key, item.line, item.tts_text, config, item.filename, "failed", item.settings, error, http_status))
            failed += 1
            print(f"Failed {item.key}: HTTP {http_status or '-'} {error}", file=sys.stderr)
            continue
        temporary = destination.with_suffix(f"{destination.suffix}.part")
        temporary.write_bytes(audio)
        temporary.replace(destination)
        cache[item.key] = cache_entry(item.key, item.line, item.tts_text, item.filename, item.fingerprint, config, item.settings, item.effective)
        records_by_key[item.key] = asdict(make_record(item.key, item.line, item.tts_text, config, item.filename, "generated", item.settings, http_status=http_status, warnings=warnings))
        generated += 1
        cli_log(args, f"Generated {item.key} -> {destination.name}")

    records = list(records_by_key.values())
    write_json(cache_path, cache)
    write_json(log_path, records)
    failures = [record for record in records if record.get("status") == "failed"]
    write_json(output / "failed.json", failures)
    locale = rows[0].get("locale", "") if rows else ""
    write_json(output / "pack.json", build_pack_metadata(pack_metadata, character or "default", locale, config))
    write_json(output / "manifest.json", build_manifest(character or "default", config, records, audio_dir))
    cli_log(args, f"Complete: generated={generated}, skipped={skipped}, failed={failed}; output={output}")
    if args.json:
        result_items = []
        for item in plan:
            record = records_by_key.get(item.key, {})
            result_items.append({
                "key": item.key,
                "file": item.filename,
                "status": str(record.get("status") or item.status),
                "error": str(record.get("error")) if record.get("error") else None,
                "warnings": record.get("warnings") if isinstance(record.get("warnings"), list) else [],
            })
        print(json.dumps(json_result(
            success=failed == 0, generated=generated, failed=failed, skipped=skipped, items=result_items,
        ), ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
