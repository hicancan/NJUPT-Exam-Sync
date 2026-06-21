#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 5 ]; then
  echo "::error::usage: $0 <dist-dir> <project> <environment> <area> <log-path>"
  exit 2
fi

dist_dir="$1"
project="$2"
environment="$3"
area="$4"
log_path="$5"

if [ -z "${EDGEONE_API_TOKEN:-}" ]; then
  echo "::error::EDGEONE_API_TOKEN secret is required"
  exit 1
fi

if [ ! -d "$dist_dir" ]; then
  echo "::error::EdgeOne deploy directory does not exist: $dist_dir"
  exit 1
fi

is_transient_edgeone_failure() {
  local log_file="$1"
  grep -Eiq 'ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|API request failed \(5[0-9][0-9]\)|API request failed \(522\)|API request failed \(524\)|HTTP 5[0-9][0-9]|502|503|504|522|524' "$log_file"
}

rm -f "$log_path"

for attempt in 1 2 3 4 5; do
  attempt_log="${log_path}.attempt-${attempt}"
  rm -f "$attempt_log"
  echo "EdgeOne deploy attempt ${attempt}/5 for project '${project}' in area '${area}'."

  if npx --yes edgeone@latest pages deploy "$dist_dir" -n "$project" -t "$EDGEONE_API_TOKEN" -e "$environment" -a "$area" 2>&1 | tee "$attempt_log"; then
    cp "$attempt_log" "$log_path"
    echo "EdgeOne deploy succeeded on attempt ${attempt}."
    exit 0
  fi

  cp "$attempt_log" "$log_path"
  if ! is_transient_edgeone_failure "$attempt_log"; then
    echo "::error::EdgeOne deploy failed with a non-transient error on attempt ${attempt}; not retrying."
    exit 1
  fi

  if [ "$attempt" -eq 5 ]; then
    echo "::error::EdgeOne deploy failed after 5 transient attempts."
    exit 1
  fi

  sleep_seconds=$((attempt * attempt * 10))
  echo "::warning::Transient EdgeOne deploy failure; retrying in ${sleep_seconds}s."
  sleep "$sleep_seconds"
done
