(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "FONT_INSPECTOR_INSPECT_SELECTION") {
      return;
    }

    const inspection = window.FontInspectorTypography.inspectSelection();
    sendResponse(inspection);
    return true;
  });
})();
