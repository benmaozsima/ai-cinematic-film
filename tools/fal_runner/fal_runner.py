#!/usr/bin/env python3
"""Cost-guarded Fal request planner.

Default behavior is dry-run only. Paid generation requires both:
  --execute
  budget.dry_run=false in the shot request JSON
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class RunnerError(Exception):
    pass


@dataclass(frozen=True)
class PlannedRequest:
    model_key: str
    model_id: str
    fal_input: dict[str, Any]
    estimated_cost_usd: float | None
    warnings: list[str]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RunnerError(message)


def estimate_cost(model: dict[str, Any], shot: dict[str, Any], duration_seconds: int) -> float | None:
    audio_key = (
        "estimated_cost_per_second_usd_with_audio"
        if bool(shot.get("generate_audio", False))
        else "estimated_cost_per_second_usd_without_audio"
    )
    cost_per_second = model.get(audio_key, model.get("estimated_cost_per_second_usd"))
    if cost_per_second is None:
        return None
    return round(float(cost_per_second) * duration_seconds, 4)


def normalize_duration(model_key: str, duration_seconds: int) -> str | int:
    if model_key.startswith("veo_"):
        return f"{duration_seconds}s"
    return duration_seconds


def plan_request(models_config: dict[str, Any], shot: dict[str, Any]) -> PlannedRequest:
    models = models_config["models"]
    model_key = shot["model_key"]
    require(model_key in models, f"Unknown model_key: {model_key}")
    model = models[model_key]

    mode = shot["mode"]
    require(mode in model["modes"], f"Model {model_key} does not support mode {mode}")

    duration_seconds = int(shot["duration_seconds"])
    require(
        duration_seconds in model["durations_seconds"],
        f"Duration {duration_seconds}s is not supported by {model_key}",
    )

    resolution = shot.get("resolution", "720p")
    require(resolution in model["resolutions"], f"Resolution {resolution} is not supported by {model_key}")

    budget = shot.get("budget", {})
    max_cost = budget.get("max_cost_usd")
    estimated_cost = estimate_cost(model, shot, duration_seconds)

    warnings: list[str] = []
    if estimated_cost is None:
        warnings.append("No price configured for this model; external account/dashboard estimate required.")
    elif max_cost is not None and estimated_cost > float(max_cost):
        raise RunnerError(
            f"Estimated cost ${estimated_cost} exceeds shot budget ${float(max_cost):.2f}"
        )

    refs = shot.get("references", {})
    schema = model["schema"]
    fal_input: dict[str, Any] = {
        schema["prompt"]: shot["prompt"],
        schema["resolution"]: resolution,
        schema["duration"]: normalize_duration(model_key, duration_seconds),
    }

    if "aspect_ratio" in schema and shot.get("aspect_ratio") is not None:
        fal_input[schema["aspect_ratio"]] = shot["aspect_ratio"]

    if "generate_audio" in schema:
        fal_input[schema["generate_audio"]] = bool(shot.get("generate_audio", False))

    if "bitrate_mode" in schema and shot.get("bitrate_mode") is not None:
        fal_input[schema["bitrate_mode"]] = shot["bitrate_mode"]

    if model.get("supports_negative_prompt") and shot.get("negative_prompt"):
        fal_input[schema["negative_prompt"]] = shot["negative_prompt"]

    if "seed" in schema and shot.get("seed") is not None:
        fal_input[schema["seed"]] = int(shot["seed"])

    if "camera_fixed" in schema and shot.get("camera_fixed") is not None:
        fal_input[schema["camera_fixed"]] = bool(shot["camera_fixed"])

    if "auto_fix" in schema and shot.get("auto_fix") is not None:
        fal_input[schema["auto_fix"]] = bool(shot["auto_fix"])

    if "safety_tolerance" in schema and shot.get("safety_tolerance") is not None:
        fal_input[schema["safety_tolerance"]] = str(shot["safety_tolerance"])

    if mode == "image_to_video":
        start = refs.get("start_frame_url")
        require(bool(start), "image_to_video requires references.start_frame_url")
        fal_input[schema["start_frame_url"]] = start
        end = refs.get("end_frame_url")
        if end and "end_frame_url" in schema:
            fal_input[schema["end_frame_url"]] = end
    elif mode == "first_last_frame":
        start = refs.get("start_frame_url")
        end = refs.get("end_frame_url")
        require(bool(start), "first_last_frame requires references.start_frame_url")
        require(bool(end), "first_last_frame requires references.end_frame_url")
        if "first_frame_url" in schema:
            fal_input[schema["first_frame_url"]] = start
            fal_input[schema["last_frame_url"]] = end
        else:
            fal_input[schema["start_frame_url"]] = start
            fal_input[schema["end_frame_url"]] = end
    elif mode == "reference_to_video":
        image_urls = refs.get("reference_image_urls") or []
        require(bool(image_urls), "reference_to_video requires references.reference_image_urls")
        fal_input[schema["image_urls"]] = image_urls

    return PlannedRequest(
        model_key=model_key,
        model_id=model["model_id"],
        fal_input=fal_input,
        estimated_cost_usd=estimated_cost,
        warnings=warnings,
    )


def execute_request(plan: PlannedRequest) -> dict[str, Any]:
    try:
        import fal_client  # type: ignore
    except ImportError as exc:
        raise RunnerError("fal-client is not installed. Install with: pip install fal-client") from exc

    require(bool(os.environ.get("FAL_KEY")), "FAL_KEY environment variable is required for execution")
    handler = fal_client.submit(plan.model_id, arguments=plan.fal_input)
    return {
        "request_id": handler.request_id,
        "model_id": plan.model_id,
        "status": "submitted",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan or submit a guarded Fal video request.")
    parser.add_argument("--models", required=True, type=Path, help="Path to fal_models.json")
    parser.add_argument("--shot", required=True, type=Path, help="Path to shot request JSON")
    parser.add_argument("--execute", action="store_true", help="Actually submit to Fal. Requires dry_run=false.")
    args = parser.parse_args()

    try:
        models_config = load_json(args.models)
        shot = load_json(args.shot)
        plan = plan_request(models_config, shot)

        dry_run = bool(shot.get("budget", {}).get("dry_run", True))
        response: dict[str, Any] = {
            "shot_id": shot.get("shot_id"),
            "scene_id": shot.get("scene_id"),
            "version": shot.get("version"),
            "quality_tier": shot.get("quality_tier"),
            "mode": shot.get("mode"),
            "model_key": plan.model_key,
            "model_id": plan.model_id,
            "estimated_cost_usd": plan.estimated_cost_usd,
            "warnings": plan.warnings,
            "fal_input": plan.fal_input,
            "dry_run": dry_run,
            "would_execute": bool(args.execute),
        }

        if args.execute:
            require(not dry_run, "Refusing to execute: budget.dry_run must be false.")
            response["execution"] = execute_request(plan)
        else:
            response["execution"] = None

        print(json.dumps(response, indent=2, ensure_ascii=False))
        return 0
    except RunnerError as exc:
        print(json.dumps({"error": str(exc)}, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
