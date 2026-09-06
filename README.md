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
4. Review the separate inspector popup window.
5. Use the row copy icons for specific values, or use the save icon to name and save the full typography details.
6. Click the extension icon in Chrome to open the saved-fonts index. The same saved-fonts page is also available as the extension options page from `chrome://extensions`.

The inspector opens at 480px wide. Normal popup windows return to 380-720px after resizing stops (including the native frame, subject to screen space). Chrome does not expose native minimum/maximum resize constraints. Maximized and fullscreen windows are left alone. Content wraps during dragging and zoom, with a maximum reading width of 720px.

Selections that span multiple elements with different rendered typography are reported as multiple detected styles.

Saved fonts are stored with `chrome.storage.local`, so they remain available from the extension popup after the inspector window closes.

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
  popup/
    index.html
    index.js
    index.css
  icons/
    copy.svg
    save.svg
  utils/
    typography.js
```
