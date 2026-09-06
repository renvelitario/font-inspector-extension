(() => {
  const ROOT_ID = "font-inspector-extension-root";
  const namespace = "font-inspector-extension";
  let outsideClickHandler = null;

  function removeWindow() {
    const existingRoot = document.getElementById(ROOT_ID);
    if (existingRoot) {
      existingRoot.remove();
    }

    document.removeEventListener("keydown", handleEscape, true);
    if (outsideClickHandler) {
      document.removeEventListener("pointerdown", outsideClickHandler, true);
      outsideClickHandler = null;
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      removeWindow();
    }
  }

  function showWindow(inspection) {
    removeWindow();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = `${namespace}__overlay`;

    const inspectorWindow = document.createElement("section");
    inspectorWindow.className = `${namespace}__window`;
    inspectorWindow.setAttribute("role", "dialog");
    inspectorWindow.setAttribute("aria-labelledby", `${namespace}-title`);

    inspectorWindow.append(createHeader(), createBody(inspection));
    root.append(inspectorWindow);
    document.documentElement.append(root);

    makeDraggable(inspectorWindow, inspectorWindow.querySelector(`.${namespace}__header`));
    outsideClickHandler = (event) => {
      if (!inspectorWindow.contains(event.target)) {
        removeWindow();
      }
    };

    document.addEventListener("keydown", handleEscape, true);
    window.setTimeout(() => {
      document.addEventListener("pointerdown", outsideClickHandler, true);
    }, 0);
  }

  function createHeader() {
    const header = document.createElement("header");
    header.className = `${namespace}__header`;

    const titleWrap = document.createElement("div");

    const eyebrow = document.createElement("p");
    eyebrow.className = `${namespace}__eyebrow`;
    eyebrow.textContent = "Font Inspector";

    const title = document.createElement("h2");
    title.id = `${namespace}-title`;
    title.textContent = "Rendered typography";

    titleWrap.append(eyebrow, title);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = `${namespace}__icon-button`;
    closeButton.setAttribute("aria-label", "Close Font Inspector");
    closeButton.textContent = "x";
    closeButton.addEventListener("click", removeWindow);

    header.append(titleWrap, closeButton);
    return header;
  }

  function createBody(inspection) {
    const body = document.createElement("div");
    body.className = `${namespace}__body`;

    if (!inspection.ok) {
      const message = document.createElement("p");
      message.className = `${namespace}__empty`;
      message.textContent = inspection.reason;
      body.append(message);
      return body;
    }

    const preview = document.createElement("blockquote");
    preview.className = `${namespace}__preview`;
    preview.textContent = `"${inspection.selectedText}"`;
    body.append(preview);

    if (inspection.multipleStyles) {
      const notice = document.createElement("div");
      notice.className = `${namespace}__notice`;
      notice.textContent = "Multiple styles were detected in this selection.";
      body.append(notice);
    }

    inspection.styles.forEach((styleInfo, index) => {
      body.append(createStylePanel(styleInfo, inspection.styles.length, index));
    });

    return body;
  }

  function createStylePanel(styleInfo, totalStyles, index) {
    const panel = document.createElement("article");
    panel.className = `${namespace}__panel`;

    const panelHeader = document.createElement("div");
    panelHeader.className = `${namespace}__panel-header`;

    const titleWrap = document.createElement("div");
    titleWrap.className = `${namespace}__panel-title`;

    const title = document.createElement("h3");
    title.textContent = totalStyles > 1
      ? `Style ${index + 1} / ${styleInfo.elementName}`
      : "Typography";

    const sample = document.createElement("p");
    sample.textContent = styleInfo.sampleText ? `"${styleInfo.sampleText}"` : styleInfo.elementName;

    titleWrap.append(title, sample);
    panelHeader.append(titleWrap, createActions(styleInfo.typography));
    panel.append(panelHeader);

    const sections = [
      ["Type", ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing"]],
      ["Color", ["color", "backgroundColor"]],
      ["Text", ["textAlign", "textTransform", "textDecorationLine"]]
    ];

    sections.forEach(([sectionTitle, properties]) => {
      panel.append(createPropertySection(sectionTitle, properties, styleInfo.typography));
    });

    return panel;
  }

  function createPropertySection(title, properties, typography) {
    const section = document.createElement("section");
    section.className = `${namespace}__section`;

    const heading = document.createElement("h4");
    heading.textContent = title;
    section.append(heading);

    const list = document.createElement("dl");
    list.className = `${namespace}__property-list`;

    properties.forEach((property) => {
      const label = document.createElement("dt");
      label.textContent = window.FontInspectorTypography.DISPLAY_LABELS[property];

      const value = document.createElement("dd");
      value.textContent = typography[property];

      if (property === "color" || property === "backgroundColor") {
        value.prepend(createColorSwatch(typography[property]));
      }

      list.append(label, value);
    });

    section.append(list);
    return section;
  }

  function createColorSwatch(color) {
    const swatch = document.createElement("span");
    swatch.className = `${namespace}__swatch`;
    swatch.style.backgroundColor = color;
    return swatch;
  }

  function createActions(typography) {
    const actions = document.createElement("div");
    actions.className = `${namespace}__actions`;

    actions.append(
      createCopyButton("Copy Font", typography.fontFamily),
      createCopyButton("Copy Color", typography.color),
      createCopyButton("Copy CSS", window.FontInspectorTypography.typographyToCss(typography))
    );

    return actions;
  }

  function createCopyButton(label, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${namespace}__button ${namespace}__copy-button`;
    button.title = label;
    button.setAttribute("aria-label", label);

    const icon = document.createElement("span");
    icon.className = `${namespace}__copy-icon`;
    icon.style.setProperty("--font-inspector-copy-icon", `url("${chrome.runtime.getURL("src/icons/copy.svg")}")`);
    icon.setAttribute("aria-hidden", "true");

    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = `${namespace}__sr-only`;
    accessibleLabel.textContent = label;

    button.append(icon, accessibleLabel);
    button.addEventListener("click", async () => {
      const copied = await writeClipboard(value);
      const originalTitle = button.title;
      button.title = copied ? `${label} copied` : `${label} failed`;
      button.classList.toggle(`${namespace}__copy-button--copied`, copied);
      button.classList.toggle(`${namespace}__copy-button--failed`, !copied);

      window.setTimeout(() => {
        button.title = originalTitle;
        button.classList.remove(`${namespace}__copy-button--copied`, `${namespace}__copy-button--failed`);
      }, 1100);
    });

    return button;
  }

  function makeDraggable(inspectorWindow, handle) {
    let dragState = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) {
        return;
      }

      const rect = inspectorWindow.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };

      inspectorWindow.classList.add(`${namespace}__window--dragging`);
      inspectorWindow.style.left = `${rect.left}px`;
      inspectorWindow.style.top = `${rect.top}px`;
      inspectorWindow.style.right = "auto";
      inspectorWindow.style.bottom = "auto";
      inspectorWindow.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    inspectorWindow.addEventListener("pointermove", (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const rect = inspectorWindow.getBoundingClientRect();
      const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      const nextLeft = clamp(event.clientX - dragState.offsetX, 8, maxLeft);
      const nextTop = clamp(event.clientY - dragState.offsetY, 8, maxTop);

      inspectorWindow.style.left = `${nextLeft}px`;
      inspectorWindow.style.top = `${nextTop}px`;
    });

    inspectorWindow.addEventListener("pointerup", endDrag);
    inspectorWindow.addEventListener("pointercancel", endDrag);

    function endDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      inspectorWindow.classList.remove(`${namespace}__window--dragging`);
      inspectorWindow.releasePointerCapture(event.pointerId);
      dragState = null;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  async function writeClipboard(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      return writeClipboardFallback(value);
    }
  }

  function writeClipboardFallback(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.documentElement.append(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }

  window.FontInspectorWindow = {
    showWindow,
    removeWindow
  };
})();
