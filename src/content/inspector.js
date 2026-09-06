(() => {
  let pickerState = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "FONT_INSPECTOR_INSPECT_SELECTION") {
      const inspection = window.FontInspectorTypography.inspectSelection();
      sendResponse(inspection);
      return true;
    }

    if (message?.type === "FONT_INSPECTOR_START_PICKER") {
      startElementPicker();
      sendResponse({ ok: true });
      return true;
    }
  });

  function startElementPicker() {
    stopElementPicker();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "2147483646";
    overlay.style.pointerEvents = "none";
    overlay.style.cursor = "crosshair";

    const outline = document.createElement("div");
    outline.style.position = "fixed";
    outline.style.zIndex = "2147483647";
    outline.style.pointerEvents = "none";
    outline.style.border = "2px dashed #35c8f6";
    outline.style.borderRadius = "6px";
    outline.style.boxShadow = "0 0 0 9999px rgb(15 23 42 / 12%), 0 0 0 4px rgb(53 200 246 / 20%)";
    outline.style.display = "none";

    const label = document.createElement("div");
    label.style.position = "fixed";
    label.style.zIndex = "2147483647";
    label.style.pointerEvents = "none";
    label.style.padding = "5px 8px";
    label.style.border = "1px solid rgb(53 200 246 / 60%)";
    label.style.borderRadius = "6px";
    label.style.background = "#0f172a";
    label.style.color = "#f8fafc";
    label.style.font = "12px Helvetica, Arial, sans-serif";
    label.style.lineHeight = "1.2";
    label.style.display = "none";

    document.documentElement.append(overlay, outline, label);

    pickerState = {
      overlay,
      outline,
      label,
      currentElement: null,
      previousCursor: document.documentElement.style.cursor
    };

    document.documentElement.style.cursor = "crosshair";
    window.addEventListener("mousemove", handlePickerMove, true);
    window.addEventListener("click", handlePickerClick, true);
    window.addEventListener("keydown", handlePickerKeydown, true);
  }

  function stopElementPicker() {
    if (!pickerState) {
      return;
    }

    window.removeEventListener("mousemove", handlePickerMove, true);
    window.removeEventListener("click", handlePickerClick, true);
    window.removeEventListener("keydown", handlePickerKeydown, true);

    document.documentElement.style.cursor = pickerState.previousCursor || "";
    pickerState.overlay.remove();
    pickerState.outline.remove();
    pickerState.label.remove();
    pickerState = null;
  }

  function handlePickerMove(event) {
    if (!pickerState) return;

    const target = getInspectableTarget(event.target);
    if (!target) {
      pickerState.outline.style.display = "none";
      pickerState.label.style.display = "none";
      pickerState.currentElement = null;
      return;
    }

    pickerState.currentElement = target;
    positionPickerOverlay(target);
  }

  function handlePickerClick(event) {
    if (!pickerState) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const target = pickerState.currentElement || getInspectableTarget(event.target);
    if (!target) {
      stopElementPicker();
      return;
    }

    const inspection = {
      ...window.FontInspectorTypography.inspectElement(target),
      source: {
        title: document.title || "",
        url: location.href
      }
    };

    stopElementPicker();
    chrome.runtime.sendMessage({
      type: "FONT_INSPECTOR_OPEN_INSPECTION",
      inspection
    });
  }

  function handlePickerKeydown(event) {
    if (!pickerState || event.key !== "Escape") return;

    event.preventDefault();
    event.stopPropagation();
    stopElementPicker();
  }

  function getInspectableTarget(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    if (pickerState && (
      target === pickerState.overlay ||
      target === pickerState.outline ||
      target === pickerState.label
    )) {
      return null;
    }

    return target.closest?.("body *") || null;
  }

  function positionPickerOverlay(element) {
    const rect = element.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));

    if (visibleWidth === 0 || visibleHeight === 0) {
      pickerState.outline.style.display = "none";
      pickerState.label.style.display = "none";
      return;
    }

    pickerState.outline.style.display = "block";
    pickerState.outline.style.left = `${Math.max(rect.left, 0)}px`;
    pickerState.outline.style.top = `${Math.max(rect.top, 0)}px`;
    pickerState.outline.style.width = `${visibleWidth}px`;
    pickerState.outline.style.height = `${visibleHeight}px`;

    const tagName = element.tagName.toLowerCase();
    const fontFamily = window.getComputedStyle(element).fontFamily.split(",")[0].replace(/^["']|["']$/g, "");
    pickerState.label.textContent = fontFamily ? `${tagName} / ${fontFamily}` : tagName;
    pickerState.label.style.display = "block";
    pickerState.label.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 160))}px`;
    pickerState.label.style.top = `${Math.max(8, rect.top - 30)}px`;
  }
})();
