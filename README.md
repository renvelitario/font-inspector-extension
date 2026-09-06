# Font Inspector

Font Inspector is a local Chrome Extension using Manifest V3. It inspects the rendered typography of selected webpage text with the Selection API and `window.getComputedStyle()`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose **Load unpacked**.
4. Select this project folder.

## Use

1. Highlight text on any regular webpage.
2. Right-click the selection.
3. Choose **Font Inspector**.
4. Review the separate inspector popup window and use the copy icons for font, color, or CSS.

Selections that span multiple elements with different rendered typography are reported as multiple detected styles.

## Structure

```text
manifest.json
src/
  background/
    context-menu.js
  content/
    inspector.js
  window/
    inspector.html
    inspector.js
    inspector.css
  icons/
    copy.svg
  utils/
    typography.js
```
