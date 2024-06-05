# Images for documentation

These are images for documentation purposes, taken in June 2024.

They are compressed with [pngquant](https://pngquant.org/), a lossy PNG compressor.
To generate the minimized versions in bash:

```bash
TMPDIR=`mktemp -d` || exit 1
find . -maxdepth 1 -type f -name "*.png" -exec pngquant 256 --skip-if-larger --output $TMPDIR/{} -- {} \;
mv $TMPDIR/*.png .
rmdir $TMPDIR
```
