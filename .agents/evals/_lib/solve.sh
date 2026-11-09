#!/bin/bash
# solve.sh: the oracle's run. Applies a case's reference fix, so its tests can prove themselves.
set -euo pipefail
cd "${DEST:-/app}"
git apply --whitespace=nowarn /solution/solution.patch
