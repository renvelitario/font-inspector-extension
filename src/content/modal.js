(() => {
  const ROOT_ID = "font-inspector-extension-root";
  const namespace = "font-inspector-extension";

  function removeModal() {
    const existingRoot = document.getElementById(ROOT_ID);
    if (existingRoot) {
      existingRoot.remove();
    }

    document.removeEventListener("keydown", handleEscape, true);
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      removeModal();
    }
  }

  function showModal(inspection) {
    removeModal();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = `${namespace}__overlay`;
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        removeModal();
      }
    });

    const dialog = document.createElement("section");
    dialog.className = `${namespace}__dialog`;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", `${namespace}-title`);

    dialog.append(createHeader(), createBody(inspection));
    root.append(dialog);
    document.documentElement.append(root);

    document.addEventListener("keydown", handleEscape, true);
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
    closeButton.addEventListener("click", removeModal);

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

    const title = document.createElement("h3");
    title.textContent = totalStyles > 1
      ? `Style ${index + 1} / ${styleInfo.elementName}`
      : "Typography";

    const sample = document.createElement("p");
    sample.textContent = styleInfo.sampleText ? `"${styleInfo.sampleText}"` : styleInfo.elementName;

    panelHeader.append(title, sample);
    panel.append(panelHeader);

    const sections = [
      ["Type", ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing"]],
      ["Color", ["color", "backgroundColor"]],
      ["Text", ["textAlign", "textTransform", "textDecorationLine"]]
    ];

    sections.forEach(([sectionTitle, properties]) => {
      panel.append(createPropertySection(sectionTitle, properties, styleInfo.typography));
    });

    panel.append(createActions(styleInfo.typography));
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
    button.className = `${namespace}__button`;
    button.textContent = label;
    button.addEventListener("click", async () => {
      const copied = await writeClipboard(value);
      const originalText = button.textContent;
      button.textContent = copied ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1100);
    });

    return button;
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

  window.FontInspectorModal = {
    showModal,
    removeModal
  };
})();
