#!/usr/bin/env python3
"""
Image Generator — Opensquad Skill
Generates images via Google Gemini API.

Usage:
  # Single image
  python3 generate.py --prompt "description" --output "path/to/image.jpg" --mode test

  # Single image with reference (logo/mascot)
  python3 generate.py --prompt "description" --output "path/to/image.jpg" --reference "path/to/logo.png" --mode production

  # Batch (JSON file with list of {prompt, output} objects)
  python3 generate.py --batch "path/to/batch.json" --mode production
"""

import argparse
import base64
import json
import os
import random
import sys
import time
import urllib.request
import urllib.error

# Gemini models per mode
MODELS = {
    "test": "gemini-2.5-flash-image",
    "production": "gemini-3.1-flash-image-preview",
}

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def load_api_key():
    """Load GEMINI_API_KEY from environment or .env file."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        env_candidates = [
            os.path.join(os.getcwd(), ".env"),
            os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
        ]
        for env_path in env_candidates:
            env_path = os.path.abspath(env_path)
            if os.path.exists(env_path):
                with open(env_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("GEMINI_API_KEY=") and not line.startswith("#"):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
                if key:
                    break
    if not key:
        print("ERROR: GEMINI_API_KEY not found in environment or .env file", file=sys.stderr)
        sys.exit(1)
    return key


def generate_image(prompt, output_path, mode, api_key, reference_image=None, seed=None):
    """Generate a single image via Gemini API and save to output_path."""
    model = MODELS.get(mode, MODELS["test"])

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Ensure 4K quality on every request
    if not prompt.lower().startswith("4k"):
        prompt = "4K ultra high definition, ultra detailed, " + prompt

    # Append variation seed to force a unique generation each call
    variation = seed if seed is not None else random.randint(10000, 99999)
    prompt = f"{prompt} [v{variation}]"

    parts = []
    if reference_image and os.path.exists(reference_image):
        ext = os.path.splitext(reference_image)[1].lower()
        mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
        mime = mime_map.get(ext, "image/png")
        with open(reference_image, "rb") as img_f:
            img_b64 = base64.b64encode(img_f.read()).decode("utf-8")
        parts.append({"inlineData": {"mimeType": mime, "data": img_b64}})
        parts.append({"text": f"Using the reference image above as style reference. Generate a 4K ultra high resolution image: {prompt}. Only output the image."})
    else:
        parts.append({"text": f"Generate a 4K ultra high resolution image: {prompt}. Only output the image, no text."})

    payload = json.dumps({
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    }).encode("utf-8")

    url = f"{GEMINI_BASE_URL}/{model}:generateContent?key={api_key}"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"  API error [{e.code}]: {error_body[:400]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"  Request error: {e}", file=sys.stderr)
        return False

    # Extract image from Gemini response (inlineData in parts)
    img_data = None
    candidates = data.get("candidates", [])
    if candidates:
        for part in candidates[0].get("content", {}).get("parts", []):
            inline = part.get("inlineData", {})
            if inline.get("data"):
                img_data = inline["data"]
                break

    if not img_data:
        print(f"  No image returned by model {model}. Response: {json.dumps(data)[:300]}", file=sys.stderr)
        return False

    with open(output_path, "wb") as f:
        f.write(base64.b64decode(img_data))

    size_kb = os.path.getsize(output_path) / 1024
    print(f"  OK: {output_path} ({size_kb:.0f} KB)")
    return True


def main():
    parser = argparse.ArgumentParser(description="Generate images via Google Gemini API")
    parser.add_argument("--prompt", help="Text prompt for single image generation")
    parser.add_argument("--output", help="Output file path for single image")
    parser.add_argument("--batch", help="Path to JSON batch file")
    parser.add_argument("--mode", choices=["test", "production"], default="test",
                        help="Generation mode: test or production")
    parser.add_argument("--reference", help="Path to reference image to include in the prompt")
    parser.add_argument("--seed", type=int, default=None,
                        help="Variation seed (random if omitted — guarantees a different image each call)")
    args = parser.parse_args()

    if not args.prompt and not args.batch:
        parser.error("Either --prompt or --batch is required")

    api_key = load_api_key()
    model = MODELS[args.mode]
    print(f"Image Generator — Mode: {args.mode} | Model: {model}")

    if args.batch:
        with open(args.batch, "r") as f:
            items = json.load(f)
        print(f"Generating {len(items)} images...\n")
        success = 0
        for i, item in enumerate(items, 1):
            prompt = item["prompt"]
            output = item["output"]
            ref = item.get("reference")
            print(f"[{i}/{len(items)}] {os.path.basename(output)}...")
            if generate_image(prompt, output, args.mode, api_key, reference_image=ref, seed=args.seed):
                success += 1
            if i < len(items):
                time.sleep(1)
        print(f"\nDone: {success}/{len(items)} images generated.")
        sys.exit(0 if success == len(items) else 1)
    else:
        if not args.output:
            parser.error("--output is required for single image generation")
        print(f"Generating: {os.path.basename(args.output)}...")
        ok = generate_image(args.prompt, args.output, args.mode, api_key, reference_image=args.reference, seed=args.seed)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
