(() => {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "FONT_INSPECTOR_INSPECT_SELECTION") {
      return;
    }

    const inspection = window.FontInspectorTypography.inspectSelection();
    window.FontInspectorModal.showModal(inspection);
  });
})();
