#!/usr/bin/env bash
# Pre-download MLC models into ./models/ so live-demo.html can serve them
# fully offline. Run this once before the talk on a fast network.
#
# Usage:
#   ./download-models.sh              # downloads the recommended small set
#   ./download-models.sh all          # downloads every model in MODELS
#   ./download-models.sh <id> [<id>]  # downloads only the given ids
#
# Requires: bash, curl, and either git-lfs OR enough patience for raw HTTP.
# Pages must be served over http(s) — Chrome blocks fetch from file://.
# After download, run:  python3 -m http.server 8000
# then open: http://localhost:8000/live-demo.html

set -euo pipefail

HF_BASE="https://huggingface.co/mlc-ai"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)/models"
mkdir -p "$DEST_DIR"

# Same model set as MODELS array in live-demo.js. Keep in sync.
ALL_MODELS=(
  "Llama-3.2-1B-Instruct-q4f16_1-MLC"
  "Llama-3.2-3B-Instruct-q4f16_1-MLC"
  "Qwen3-0.6B-q4f16_1-MLC"
  "Qwen3-1.7B-q4f16_1-MLC"
  "Qwen3-4B-q4f16_1-MLC"
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
)

# Default = the lightest two (good for a talk where you only need fallbacks).
DEFAULT_MODELS=(
  "Llama-3.2-1B-Instruct-q4f16_1-MLC"
  "Qwen3-0.6B-q4f16_1-MLC"
)

if [ "$#" -eq 0 ]; then
  TARGETS=("${DEFAULT_MODELS[@]}")
elif [ "$1" = "all" ]; then
  TARGETS=("${ALL_MODELS[@]}")
else
  TARGETS=("$@")
fi

ensure_resolve_link() {
  # WebLLM fetches model files via the HuggingFace URL template:
  #   <model>/resolve/main/<file>
  # Mirror that locally with a symlink so a plain http.server can serve it.
  local target_dir="$1"
  mkdir -p "$target_dir/resolve"
  ln -sfn "../" "$target_dir/resolve/main"
}

download_one() {
  local model_id="$1"
  local target_dir="$DEST_DIR/$model_id"
  local repo_url="$HF_BASE/$model_id"

  echo ""
  echo "▸ $model_id"
  echo "  → $target_dir"

  if [ -f "$target_dir/mlc-chat-config.json" ]; then
    echo "  ✓ already present, skipping (delete folder to re-download)"
    ensure_resolve_link "$target_dir"
    return
  fi

  mkdir -p "$target_dir"

  # Prefer git-lfs clone for atomicity. Fall back to per-file curl.
  if command -v git >/dev/null 2>&1 && command -v git-lfs >/dev/null 2>&1; then
    echo "  ⬇ cloning via git-lfs…"
    git -C "$DEST_DIR" clone --depth 1 "$repo_url" "$model_id" || {
      echo "  ✗ git clone failed; falling back to curl"
      download_via_curl "$model_id" "$target_dir" "$repo_url"
    }
  else
    download_via_curl "$model_id" "$target_dir" "$repo_url"
  fi

  # Both paths land here; make sure the resolve/main symlink exists.
  ensure_resolve_link "$target_dir"
}

download_via_curl() {
  local model_id="$1"
  local target_dir="$2"
  local repo_url="$3"
  local raw_url="$repo_url/resolve/main"

  # Manifest first: tells us which weight shards to fetch.
  echo "  ⬇ mlc-chat-config.json"
  curl -fsSL "$raw_url/mlc-chat-config.json" -o "$target_dir/mlc-chat-config.json"

  echo "  ⬇ ndarray-cache.json"
  curl -fsSL "$raw_url/ndarray-cache.json" -o "$target_dir/ndarray-cache.json"

  echo "  ⬇ tokenizer.json"
  curl -fsSL "$raw_url/tokenizer.json" -o "$target_dir/tokenizer.json" || true

  # Some models also have these — best-effort.
  for opt in tokenizer_config.json tokenizer.model vocab.json merges.txt; do
    curl -fsSL "$raw_url/$opt" -o "$target_dir/$opt" 2>/dev/null || true
  done

  # Parse the ndarray-cache to enumerate shards.
  if command -v python3 >/dev/null 2>&1; then
    SHARDS=$(python3 -c "
import json, sys
with open('$target_dir/ndarray-cache.json') as f:
    cache = json.load(f)
records = cache.get('records', [])
for r in records:
    print(r['dataPath'])
")
  else
    # Crude fallback: grep dataPath from the JSON.
    SHARDS=$(grep -oE '"dataPath"[[:space:]]*:[[:space:]]*"[^"]+"' "$target_dir/ndarray-cache.json" | sed -E 's/.*"([^"]+)"$/\1/')
  fi

  local count=0
  for shard in $SHARDS; do
    count=$((count + 1))
    if [ -f "$target_dir/$shard" ]; then
      continue
    fi
    echo "  ⬇ shard $count: $shard"
    curl -fsSL --retry 3 "$raw_url/$shard" -o "$target_dir/$shard"
  done

  echo "  ✓ $count shard(s) downloaded"

  ensure_resolve_link "$target_dir"
}

echo "MLC model downloader → $DEST_DIR"
echo "Targets: ${TARGETS[*]}"

for m in "${TARGETS[@]}"; do
  download_one "$m" || echo "  ✗ $m had errors but continuing"
done

# Belt-and-braces: walk every model dir and ensure the resolve/main symlink
# exists, even if a download was interrupted partway through.
for d in "$DEST_DIR"/*/; do
  [ -f "$d/mlc-chat-config.json" ] && ensure_resolve_link "${d%/}"
done

echo ""
echo "Done. Now serve over http (file:// breaks fetch in Chrome):"
echo "  cd \"$(dirname "$DEST_DIR")\" && python3 -m http.server 8000"
echo "Then open: http://localhost:8000/live-demo.html"
