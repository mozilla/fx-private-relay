#!/usr/bin/env bash
set -euo pipefail

# Minimal smoke test for fx-private-relay container
#
# This script verifies that a built fx-private-relay Docker image can start
# successfully. The container is configured with minimal settings sufficient 
# to start the server and respond to the __lbheartbeat__ endpoint.
#
# Usage: ./smoketest.sh [image_name]

readonly IMAGE_NAME="${1:-fx-private-relay}"
readonly PORT=8000
readonly MAX_RETRIES=30
readonly RETRY_DELAY=1

CONTAINER_ID=""

# Cleanup function to ensure container is removed on exit
cleanup() {
  if [[ -n "$CONTAINER_ID" ]]; then
    echo "Cleaning up container..."
    docker stop "$CONTAINER_ID" >/dev/null 2>&1 || true
    docker rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Starting fx-private-relay container from image: $IMAGE_NAME"

CONTAINER_ID=$(docker run --detach --quiet \
  -e PORT=$PORT \
  -p "$PORT:$PORT" \
  "$IMAGE_NAME")

echo "Container started with ID: $CONTAINER_ID"

# Wait for container to be ready with retry logic
echo "Waiting for health check endpoint to respond..."
for i in $(seq 1 "$MAX_RETRIES"); do
  if curl --fail --silent --show-error "http://localhost:$PORT/__lbheartbeat__" >/dev/null 2>&1; then
    echo "Health check passed after $i attempt(s)!"
    exit 0
  fi
  sleep "$RETRY_DELAY"
done

echo "Health check failed after $MAX_RETRIES attempts!"
echo ""
echo "Container logs:"
docker logs "$CONTAINER_ID"
exit 1
