#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${SLACK_WEBHOOK_URL:?Set SLACK_WEBHOOK_URL in .env}"
SHELLY_HOST="${SHELLY_HOST:-192.168.0.67}"
SCRIPT_NAME="${SCRIPT_NAME:-popcorn-alert}"
SCRIPT_FILE="${SCRIPT_FILE:-popcorn-alert.js}"
CHUNK_SIZE=1024

rpc() {
  local method="$1" params="$2" response
  response=$(curl -sS --fail -m 10 -X POST "http://$SHELLY_HOST/rpc" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg m "$method" --argjson p "$params" '{id: 1, method: $m, params: $p}')")
  if [[ "$(jq -r 'has("error")' <<<"$response")" == "true" ]]; then
    echo "$method failed: $(jq -c .error <<<"$response")" >&2
    exit 1
  fi
  jq -c .result <<<"$response"
}

echo "Storing Slack webhook in KVS"
rpc KVS.Set "$(jq -nc --arg v "$SLACK_WEBHOOK_URL" '{key: "slack_webhook", value: $v}')" >/dev/null

script_id=$(rpc Script.List '{}' | jq -r --arg n "$SCRIPT_NAME" '.scripts[] | select(.name == $n) | .id' | head -n 1)
if [[ -z "$script_id" ]]; then
  echo "Creating script $SCRIPT_NAME"
  script_id=$(rpc Script.Create "$(jq -nc --arg n "$SCRIPT_NAME" '{name: $n}')" | jq -r .id)
else
  echo "Stopping existing script $SCRIPT_NAME (id $script_id)"
  rpc Script.Stop "{\"id\":$script_id}" >/dev/null
fi

code=$(cat "$SCRIPT_FILE")
length=${#code}
offset=0
append=false
while ((offset < length)); do
  chunk="${code:offset:CHUNK_SIZE}"
  rpc Script.PutCode "$(jq -nc --argjson id "$script_id" --arg c "$chunk" --argjson a "$append" '{id: $id, code: $c, append: $a}')" >/dev/null
  offset=$((offset + CHUNK_SIZE))
  append=true
done
echo "Uploaded $length bytes to script id $script_id"

rpc Script.SetConfig "{\"id\":$script_id,\"config\":{\"enable\":true}}" >/dev/null
rpc Script.Start "{\"id\":$script_id}" >/dev/null
echo "Script enabled on boot and started"

rpc Switch.SetConfig '{"id":0,"config":{"initial_state":"on"}}' >/dev/null
echo "Switch set to power on after outages"

rpc Script.GetStatus "{\"id\":$script_id}"
