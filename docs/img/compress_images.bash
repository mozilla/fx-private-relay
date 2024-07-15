#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
TMPDIR=`mktemp -d` || exit 1
find . -maxdepth 1 -type f -name "*.png" -exec pngquant 256 --skip-if-larger --output $TMPDIR/{} -- {} \;
mv $TMPDIR/*.png .
rmdir $TMPDIR
