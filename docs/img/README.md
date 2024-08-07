# Images for documentation

These are images for documentation purposes.

- The PNG images prefixed with `website-` are for the website (aka dashboard),
  and were taken in June 2024
- The PNG images prefixed with `extension-` are for the extension (aka add-on), and
  were taken in July 2024.

Some tips for new screenshots:

- When possible, take high-resolution screenshots on a high DPI screen, such as
  a MacBook screen (144 DPI). When displaying in the document, set the image
  width to 1/3 of the width in pixels for large images. This prevents the images
  from dominating the document. Link to the full-sized image.
- Use a new Relay account on the free plan to capture on-boarding steps and
  UI changes when at the email mask limit. For the website, use the inspector
  to change real emails to `@example.com` emails. Use real Relay masks, which
  can be set to block or can be deleted.
- Take screenshots on a local development environment to capture UI elements like
  surveys that are targeted at a subset of users and require database changes.
- Use [extension debugging techniques][] to help take screenshots of the extension.
  Delete the Extension Storage to see sign up menus. Disable popup auto-hide to make
  it easier to capture screenshots and to use the debugger. Use the debugger to change
  data to get UI elements targeted at a subset of users.

The screenshot size is minimized with [pngquant][], a lossy PNG compressor. To
generate the minimized versions, run [compress_images.bash][]. This runs on all PNG
files in the folder. You may want to revert changes to re-compress a compressed PNG.

[compress_images.bash]: ./compress_images.bash
[extension debugging techniques]: https://extensionworkshop.com/documentation/develop/debugging/
[pngquant]: https://pngquant.org/
