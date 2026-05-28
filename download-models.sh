#!/usr/bin/env bash
# Pre-download MLC models into ./models/ so live-demo.html can serve them
# fully offline. Run this once before the talk on a fast network.
#
# Usage:
#   ./download-models.sh              # downloads the recommended small set
#   ./download-models.sh all          # downloads every model in MODELS
#   ./download-models.sh <id> [<id>]  # downloads only the given ids
#
# Requires: bash, curl, python3, and enough disk space for multi-GB weights.
# Pages must be served over http(s) — Chrome blocks fetch from file://.
# After download, run:  python3 -m http.server 8000
# then open: http://localhost:8000/live-demo.html

set -euo pipefail

HF_BASE="https://huggingface.co/mlc-ai"
WEBLLM_LIB_BASE="https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_48"
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
  "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC"
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

file_size() {
  if stat -f%z "$1" >/dev/null 2>&1; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

is_lfs_pointer() {
  local path="$1"
  [ -f "$path" ] || return 1
  head -n 1 "$path" 2>/dev/null | grep -q '^version https://git-lfs.github.com/spec/v1$'
}

needs_file() {
  local path="$1"
  local expected_bytes="${2:-}"

  [ -f "$path" ] || return 0
  is_lfs_pointer "$path" && return 0
  [ "$(file_size "$path")" != "0" ] || return 0

  if [ -n "$expected_bytes" ] && [ "$expected_bytes" != "0" ]; then
    [ "$(file_size "$path")" = "$expected_bytes" ] || return 0
  fi

  return 1
}

download_file() {
  local url="$1"
  local dest="$2"
  local label="$3"
  local tmp="$dest.tmp.$$"

  echo "  ⬇ $label"
  rm -f "$tmp"
  if ! curl -fsSL --retry 5 --retry-delay 2 "$url" -o "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$dest"
}

model_lib_filename() {
  case "$1" in
    Llama-3.2-1B-Instruct-q4f16_1-MLC) echo "Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Llama-3.2-3B-Instruct-q4f16_1-MLC) echo "Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Qwen3-0.6B-q4f16_1-MLC) echo "Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Qwen3-1.7B-q4f16_1-MLC) echo "Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Qwen3-4B-q4f16_1-MLC) echo "Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Qwen2.5-0.5B-Instruct-q4f16_1-MLC) echo "Qwen2-0.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    Qwen2.5-1.5B-Instruct-q4f16_1-MLC) echo "Qwen2-1.5B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
    DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC) echo "Qwen2-7B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm" ;;
  esac
}

list_shards() {
  python3 - "$1" <<'PY'
import json
import sys

with open(sys.argv[1]) as f:
    cache = json.load(f)

records = cache.get("records", [])
if isinstance(records, dict):
    records = records.values()

for record in records:
    if not isinstance(record, dict) or "dataPath" not in record:
        continue
    print("{}\t{}".format(
        record["dataPath"],
        int(record.get("nbytes") or 0),
    ))
PY
}

download_one() {
  local model_id="$1"
  local target_dir="$DEST_DIR/$model_id"
  local repo_url="$HF_BASE/$model_id"

  echo ""
  echo "▸ $model_id"
  echo "  → $target_dir"

  mkdir -p "$target_dir"
  download_via_curl "$model_id" "$target_dir" "$repo_url" || return 1

  # Make sure the resolve/main symlink exists.
  ensure_resolve_link "$target_dir"
}

download_via_curl() {
  local model_id="$1"
  local target_dir="$2"
  local repo_url="$3"
  local raw_url="$repo_url/resolve/main"
  local lib_name
  lib_name="$(model_lib_filename "$model_id")"

  # Manifest first: tells us which weight shards to fetch.
  if needs_file "$target_dir/mlc-chat-config.json"; then
    download_file "$raw_url/mlc-chat-config.json" "$target_dir/mlc-chat-config.json" "mlc-chat-config.json" || return 1
  else
    echo "  ✓ mlc-chat-config.json"
  fi

  if needs_file "$target_dir/ndarray-cache.json"; then
    download_file "$raw_url/ndarray-cache.json" "$target_dir/ndarray-cache.json" "ndarray-cache.json" || return 1
  else
    echo "  ✓ ndarray-cache.json"
  fi

  if needs_file "$target_dir/tokenizer.json"; then
    download_file "$raw_url/tokenizer.json" "$target_dir/tokenizer.json" "tokenizer.json" || return 1
  else
    echo "  ✓ tokenizer.json"
  fi

  # Some models also have these — best-effort.
  for opt in tokenizer_config.json tokenizer.model vocab.json merges.txt; do
    if needs_file "$target_dir/$opt"; then
      curl -fL --retry 3 "$raw_url/$opt" -o "$target_dir/$opt" 2>/dev/null || true
    fi
  done

  local count=0
  local downloaded=0
  local shard=""
  local nbytes=""
  while IFS=$'\t' read -r shard nbytes; do
    [ -n "$shard" ] || continue
    count=$((count + 1))
    if ! needs_file "$target_dir/$shard" "$nbytes"; then
      echo "  ✓ shard $count: $shard"
      continue
    fi
    downloaded=$((downloaded + 1))
    download_file "$raw_url/$shard" "$target_dir/$shard" "shard $count: $shard" || return 1
    if needs_file "$target_dir/$shard" "$nbytes"; then
      echo "  ✗ shard $count still has the wrong size after download"
      return 1
    fi
  done < <(list_shards "$target_dir/ndarray-cache.json")

  if [ -n "$lib_name" ]; then
    if needs_file "$target_dir/$lib_name"; then
      download_file "$WEBLLM_LIB_BASE/$lib_name" "$target_dir/$lib_name" "WebLLM model lib: $lib_name" || return 1
    else
      echo "  ✓ WebLLM model lib: $lib_name"
    fi
  else
    echo "  ! no known WebLLM model lib mapping; local weights may still need CDN/cache for kernels"
  fi

  echo "  ✓ $count shard(s) verified, $downloaded downloaded"

  ensure_resolve_link "$target_dir"
}

echo "MLC model downloader → $DEST_DIR"
echo "Targets: ${TARGETS[*]}"

for m in "${TARGETS[@]}"; do
  if ! download_one "$m"; then
    echo "  ✗ $m had errors but continuing"
  fi
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
