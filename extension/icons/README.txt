Icon files required:
  icon-16.png   (16x16)
  icon-48.png   (48x48)
  icon-128.png  (128x128)

Source: Use the favicon assets from the ai-grija.ro website.

Quick generation from a source PNG (requires ImageMagick):
  convert source.png -resize 16x16  icon-16.png
  convert source.png -resize 48x48  icon-48.png
  convert source.png -resize 128x128 icon-128.png

Alternatively, download from:
  https://ai-grija.ro/favicon-96x96.png
and resize with any image editor.

For development/testing, Chrome will show a placeholder if the icon files
are missing — the extension will still function correctly.
