#!/usr/bin/env python3
"""Pre-download MLC models into ./models/ for offline live-demo.html.

After downloading, run:
  python3 -m http.server 8000
then open: http://localhost:8000/live-demo.html

Examples:
  ./fetch-models.py                                 # default tiny pair
  ./fetch-models.py --all                           # every catalog model
  ./fetch-models.py Llama-3.2-1B-Instruct-q4f16_1-MLC Qwen3-0.6B-q4f16_1-MLC
  ./fetch-models.py --list

Pure-Python, stdlib only. No git, no git-lfs, no jq required.
Resumable — already-downloaded files are skipped on re-run.
"""

import argparse
import concurrent.futures
import json
import shutil
import sys
import urllib.error
import urllib.request
from pathlib import Path

HF_BASE = "https://huggingface.co/mlc-ai"
HERE = Path(__file__).resolve().parent
DEST = HERE / "models"
USER_AGENT = "fetch-models.py (live-demo offline pre-fetch)"
TIMEOUT = 60

# Keep in sync with the MODELS array in live-demo.js.
ALL_MODELS = [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "Qwen3-0.6B-q4f16_1-MLC",
    "Qwen3-1.7B-q4f16_1-MLC",
    "Qwen3-4B-q4f16_1-MLC",
    "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
]

# Lightest pair — useful as a fallback when bandwidth/time is tight.
DEFAULT_MODELS = [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Qwen3-0.6B-q4f16_1-MLC",
]

# Required: load fails without these. Optional: model may not have them.
REQUIRED_FILES = ["mlc-chat-config.json", "ndarray-cache.json"]
OPTIONAL_FILES = [
    "tokenizer.json",
    "tokenizer_config.json",
    "tokenizer.model",
    "vocab.json",
    "merges.txt",
]


def http_get(url: str, out_path: Path, required: bool = True) -> str:
    """Atomic GET with resume-on-rerun. Returns 'skip', 'ok', or 'missing'."""
    if out_path.exists() and out_path.stat().st_size > 0:
        return "skip"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(out_path.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp, open(tmp, "wb") as f:
            shutil.copyfileobj(resp, f, length=1024 * 1024)
        tmp.replace(out_path)
        return "ok"
    except urllib.error.HTTPError as e:
        if tmp.exists():
            tmp.unlink()
        if not required and e.code == 404:
            return "missing"
        raise
    except BaseException:
        if tmp.exists():
            tmp.unlink()
        raise


def ensure_resolve_link(model_dir: Path) -> None:
    """Mirror the HuggingFace `<repo>/resolve/main/<file>` URL pattern via a
    symlink, so a plain `python3 -m http.server` serves files at the path
    WebLLM internally requests."""
    link = model_dir / "resolve" / "main"
    link.parent.mkdir(parents=True, exist_ok=True)
    if link.is_symlink() or link.exists():
        return
    link.symlink_to("../", target_is_directory=True)


def download_model(model_id: str, workers: int = 4) -> bool:
    base_url = f"{HF_BASE}/{model_id}/resolve/main"
    target = DEST / model_id
    target.mkdir(parents=True, exist_ok=True)

    print(f"\n▸ {model_id}")
    print(f"  → {target}")

    # 1. Required manifests — fail loud if missing.
    for fname in REQUIRED_FILES:
        try:
            status = http_get(f"{base_url}/{fname}", target / fname, required=True)
        except Exception as e:
            print(f"  ✗ {fname} failed: {e}")
            return False
        if status == "ok":
            print(f"  ⬇ {fname}")
        elif status == "skip":
            print(f"  ✓ {fname} (cached)")

    # 2. Optional tokenizer/vocab — best-effort.
    for fname in OPTIONAL_FILES:
        try:
            http_get(f"{base_url}/{fname}", target / fname, required=False)
        except Exception:
            pass

    # 3. Enumerate shards from ndarray-cache.json.
    try:
        with (target / "ndarray-cache.json").open() as f:
            manifest = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"  ✗ Could not read ndarray-cache.json: {e}")
        return False
    shards = sorted({rec["dataPath"] for rec in manifest.get("records", []) if "dataPath" in rec})
    if not shards:
        print("  ✗ No shards listed in ndarray-cache.json")
        return False

    # 4. Concurrent shard download. Each task is independent.
    print(f"  ⬇ {len(shards)} shard(s) (workers={workers})")
    done = 0
    skipped = 0
    failed: list[tuple[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {
            ex.submit(http_get, f"{base_url}/{s}", target / s, True): s
            for s in shards
        }
        try:
            for fut in concurrent.futures.as_completed(futures):
                shard = futures[fut]
                try:
                    status = fut.result()
                except Exception as e:
                    failed.append((shard, str(e)))
                    continue
                if status == "skip":
                    skipped += 1
                else:
                    done += 1
                total_complete = done + skipped
                print(
                    f"  [{total_complete}/{len(shards)}] {shard}"
                    f"{' (cached)' if status == 'skip' else ''}",
                    flush=True,
                )
        except KeyboardInterrupt:
            for f in futures:
                f.cancel()
            raise

    if failed:
        print(f"  ✗ {len(failed)} shard(s) failed:")
        for s, err in failed[:5]:
            print(f"     {s}: {err}")
        if len(failed) > 5:
            print(f"     … and {len(failed) - 5} more")
        return False

    # 5. Symlink for local HTTP serving.
    ensure_resolve_link(target)
    print(f"  ✓ {model_id} — {done} downloaded, {skipped} cached")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("models", nargs="*", help="Model IDs to download")
    ap.add_argument("--all", action="store_true", help="Download every catalog model")
    ap.add_argument("--list", action="store_true", help="Print catalog and exit")
    ap.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Concurrent shard downloads per model (default 4)",
    )
    args = ap.parse_args()

    if args.list:
        for m in ALL_MODELS:
            print(m)
        return 0

    if args.all:
        targets = ALL_MODELS
    elif args.models:
        unknown = [m for m in args.models if m not in ALL_MODELS]
        if unknown:
            print(f"Unknown model(s): {unknown}", file=sys.stderr)
            print("Use --list to see available IDs.", file=sys.stderr)
            return 2
        targets = args.models
    else:
        targets = DEFAULT_MODELS

    DEST.mkdir(parents=True, exist_ok=True)
    print(f"Destination: {DEST}")
    print(f"Targets ({len(targets)}): {', '.join(targets)}")

    failures: list[str] = []
    try:
        for m in targets:
            if not download_model(m, workers=args.workers):
                failures.append(m)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        return 130

    print()
    if failures:
        print(f"Done with errors: {len(failures)} model(s) failed: {failures}")
        return 1
    print("Done. Serve over HTTP (file:// breaks WebGPU in Chrome):")
    print(f"  cd {HERE} && python3 -m http.server 8000")
    print("Then open: http://localhost:8000/live-demo.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
