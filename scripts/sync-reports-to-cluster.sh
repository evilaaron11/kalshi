#!/usr/bin/env bash
# Push locally-generated kalshi analysis reports into the in-cluster dashboard.
#
# The analysis pipeline (lib/pipeline.ts) runs on the laptop via the Claude Max CLI —
# it can't run in a pod. This copies the resulting results/*.md into the kalshi pod's
# PVC (/app/results) over the tailnet, so they show up at
# https://kalshi.tail76243f.ts.net. Re-run after each local pipeline run.
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

NS=kalshi
SRC="$(cd "$(dirname "$0")/.." && pwd)/results"

POD=$(kubectl -n "$NS" get pod -l app=kalshi -o jsonpath='{.items[0].metadata.name}')
[ -n "$POD" ] || { echo "no kalshi pod found in ns $NS" >&2; exit 1; }

echo "Syncing $SRC -> $NS/$POD:/app/results"
kubectl -n "$NS" cp "$SRC/." "$POD:/app/results"
echo "Now in the pod:"
kubectl -n "$NS" exec "$POD" -- ls -1 /app/results
