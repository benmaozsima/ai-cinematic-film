#!/usr/bin/env python3
"""Deterministic pre-review gate for generated video clips.

This does not replace human review: it catches container/format failures and
forces an explicit checklist for temporal, identity and prop inspection.
"""
import argparse, hashlib, json, pathlib, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video", type=pathlib.Path)
    ap.add_argument("--expected-width", type=int, default=720)
    ap.add_argument("--expected-height", type=int, default=1280)
    ap.add_argument("--expected-duration", type=float, default=4.0)
    args = ap.parse_args()
    if not args.video.exists():
        print(json.dumps({"status": "FAIL", "error": "file_missing"})); return 2
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,codec_type,width,height,pix_fmt,r_frame_rate",
        "-of", "json", str(args.video)
    ], capture_output=True, text=True)
    if probe.returncode:
        print(json.dumps({"status": "FAIL", "error": "decode_probe_failed", "stderr": probe.stderr})); return 2
    payload = json.loads(probe.stdout)
    streams = payload.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    duration = float(payload.get("format", {}).get("duration", 0) or 0)
    decode = subprocess.run(["ffmpeg", "-v", "error", "-i", str(args.video), "-f", "null", "-"], capture_output=True, text=True)
    checks = {
        "decodes": decode.returncode == 0,
        "codec_h264": video.get("codec_name") == "h264",
        "dimensions": [video.get("width"), video.get("height")] == [args.expected_width, args.expected_height],
        "duration_near_expected": abs(duration - args.expected_duration) <= 0.25,
        "no_audio_for_silent_pass": not audio,
        "pixel_format_yuv420p": video.get("pix_fmt") == "yuv420p",
    }
    result = {
        "status": "TECHNICAL_PASS_HUMAN_REVIEW_REQUIRED" if all(checks.values()) else "REVISE",
        "file": str(args.video),
        "sha256": hashlib.sha256(args.video.read_bytes()).hexdigest(),
        "ffprobe": payload,
        "checks": checks,
        "human_review_required": [
            "sample dense frames for identity/age/gender and duplicate people",
            "verify prop orientation and ownership (phone display must face camera)",
            "verify blocking and threshold/doorway rules across the final second",
            "verify first/last frame handoff to adjacent shot",
        ],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "TECHNICAL_PASS_HUMAN_REVIEW_REQUIRED" else 1

if __name__ == "__main__":
    sys.exit(main())
