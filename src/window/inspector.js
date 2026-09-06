(() => {
  const STORAGE_KEY = "fontInspectorLatestInspection";
  const SAVED_FONTS_STORAGE_KEY = "fontInspectorSavedFonts";
  const THEME_STORAGE_KEY = "fontInspectorTheme";
  const MIN_WINDOW_WIDTH = 380;
  const MAX_WINDOW_WIDTH = 720;
  const SECTION_ICONS = {
    Type: "../icons/Font.svg",
    Color: "../icons/Color.svg",
    Text: "../icons/Format.svg"
  };
  const namespace = "font-inspector-window";
  const root = document.getElementById("font-inspector-window-root");
  let resizeTimer = null;
  let isClampingWindow = false;
  let resizePending = false;
  let currentTheme = "system";
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    renderStoredInspection();
  });
  window.addEventListener("resize", clampCurrentWindowWidth);
  clampCurrentWindowWidth();

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes[THEME_STORAGE_KEY]) {
      applyTheme(changes[THEME_STORAGE_KEY].newValue);
    }
  });

  async function initTheme() {
    try {
      const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
      applyTheme(result[THEME_STORAGE_KEY] || "system");
    } catch (error) {
      applyTheme("system");
    }
  }

  function applyTheme(theme) {
    currentTheme = theme || "system";
    document.body.classList.remove("theme-light", "theme-dark");

    if (currentTheme === "light") {
      document.body.classList.add("theme-light");
    } else if (currentTheme === "dark") {
      document.body.classList.add("theme-dark");
    }
  }

  async function toggleTheme() {
    let nextTheme = "dark";
    if (currentTheme === "dark") {
      nextTheme = "light";
    } else if (currentTheme === "light") {
      nextTheme = "system";
    } else {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      nextTheme = prefersDark ? "light" : "dark";
    }

    applyTheme(nextTheme);
    try {
      await chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextTheme });
    } catch (error) {
      console.warn("Font Inspector could not save theme setting.", error);
    }
    renderStoredInspection();
  }

  async function renderStoredInspection() {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    const inspection = result[STORAGE_KEY] || {
      ok: false,
      reason: "No typography inspection data was found."
    };

    render(inspection);
  }

  function render(inspection) {
    root.replaceChildren(createHeader(), createBody(inspection));
  }

  function createHeader() {
    const header = document.createElement("header");
    header.className = `${namespace}__header`;

    const titleWrap = document.createElement("div");

    const title = document.createElement("h1");
    title.textContent = "Font Inspector";

    titleWrap.append(title);
    header.append(titleWrap, createThemeToggleButton());

    return header;
  }

  function createThemeToggleButton() {
    const isDark = currentTheme === "dark" || (
      currentTheme === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );

    const iconSrc = isDark ? "../icons/light mode.svg" : "../icons/dark mode.svg";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";

    const button = createIconButton(label, iconSrc);
    button.classList.add(`${namespace}__theme-toggle`);

    button.addEventListener("click", () => {
      playButtonPress(button);
      toggleTheme();
    });

    return button;
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

    if (inspection.multipleStyles) {
      const notice = document.createElement("div");
      notice.className = `${namespace}__notice`;
      notice.textContent = "Multiple styles were detected in this selection.";
      body.append(notice);
    }

    inspection.styles.forEach((styleInfo, index) => {
      body.append(createStylePanel(styleInfo, inspection.styles.length, index, inspection.source));
    });

    return body;
  }

  function createStylePanel(styleInfo, totalStyles, index, source) {
    const panel = document.createElement("article");
    panel.className = `${namespace}__panel`;

    const panelHeader = document.createElement("div");
    panelHeader.className = `${namespace}__panel-header`;

    const titleWrap = document.createElement("div");
    titleWrap.className = `${namespace}__panel-title`;

    const titleRow = document.createElement("div");
    titleRow.className = `${namespace}__panel-title-row`;

    const title = document.createElement("h2");
    title.textContent = totalStyles > 1
      ? `Style ${index + 1}`
      : "Typography";

    titleRow.append(title);

    if (styleInfo.elementName) {
      const badge = document.createElement("span");
      badge.className = `${namespace}__tag-badge`;
      badge.textContent = styleInfo.elementName;
      titleRow.append(badge);
    }

    const sample = document.createElement("p");
    sample.textContent = totalStyles > 1 && styleInfo.sampleText ? `"${styleInfo.sampleText}"` : (styleInfo.typography.fontFamily?.split(",")[0] || styleInfo.elementName);

    titleWrap.append(titleRow, sample);

    const actions = document.createElement("div");
    actions.className = `${namespace}__panel-actions`;
    actions.append(
      createCopyCssButton(styleInfo.typography),
      createSaveButton(styleInfo, index, source)
    );

    panelHeader.append(titleWrap, actions);
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

  function createCopyCssButton(typography) {
    const button = createIconButton("Copy CSS Snippet", "../icons/code.svg");
    button.classList.add(`${namespace}__copy-css-button`);

    button.addEventListener("click", async () => {
      playButtonPress(button);
      const cssString = window.FontInspectorTypography.typographyToCss(typography || {});
      const copied = await writeClipboard(cssString);
      if (copied) {
        setTemporaryIcon(button, "../icons/Check.svg", true);
        showToast("CSS snippet copied to clipboard");
      }
    });

    return button;
  }

  function createSaveButton(styleInfo, index, source) {
    const button = createIconButton("Save Typography", "../icons/save.svg");
    button.classList.add(`${namespace}__save-button`);

    button.addEventListener("click", async () => {
      playButtonPress(button);

      const fallbackName = getDefaultSavedFontName(styleInfo, index);
      const typedName = window.prompt("Name this saved font", fallbackName);
      if (typedName === null) {
        return;
      }

      const name = typedName.trim() || fallbackName;
      const originalTitle = button.title;

      try {
        await saveFontDetails(name, styleInfo, source);
        button.title = "Saved";
        button.setAttribute("aria-label", "Saved");
        setTemporaryIcon(button, "../icons/Check.svg", true);
        showToast("Typography saved to library");
      } catch (error) {
        console.warn("Font Inspector could not save this font.", error);
        button.title = "Save failed";
        button.setAttribute("aria-label", "Save failed");
        showToast("Failed to save typography");
      }

      window.setTimeout(() => {
        button.title = originalTitle;
        button.setAttribute("aria-label", originalTitle);
      }, 1100);
    });

    return button;
  }

  function getDefaultSavedFontName(styleInfo, index) {
    const family = (styleInfo.typography.fontFamily || "Saved Font")
      .split(",")[0]
      .replace(/^["']|["']$/g, "")
      .trim();
    return family || `Saved Font ${index + 1}`;
  }

  async function saveFontDetails(name, styleInfo, source) {
    const result = await chrome.storage.local.get(SAVED_FONTS_STORAGE_KEY);
    const savedFonts = Array.isArray(result[SAVED_FONTS_STORAGE_KEY])
      ? result[SAVED_FONTS_STORAGE_KEY]
      : [];

    const savedFont = {
      id: createSavedFontId(),
      name,
      savedAt: new Date().toISOString(),
      source: source || null,
      elementName: styleInfo.elementName,
      sampleText: styleInfo.sampleText,
      typography: { ...styleInfo.typography }
    };

    await chrome.storage.local.set({
      [SAVED_FONTS_STORAGE_KEY]: [savedFont, ...savedFonts].slice(0, 80)
    });
  }

  function createSavedFontId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createPropertySection(title, properties, typography) {
    const section = document.createElement("section");
    section.className = `${namespace}__section`;

    const heading = document.createElement("h3");
    const icon = document.createElement("img");
    icon.className = `${namespace}__section-icon`;
    icon.src = SECTION_ICONS[title];
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    const headingText = document.createElement("span");
    headingText.textContent = title;

    heading.append(icon, headingText);
    section.append(heading);

    const list = document.createElement("dl");
    list.className = `${namespace}__property-list`;

    properties.forEach((property) => {
      const label = document.createElement("dt");
      const displayLabel = window.FontInspectorTypography.DISPLAY_LABELS[property];
      label.textContent = displayLabel;

      const value = document.createElement("dd");
      const valueWrap = document.createElement("span");
      valueWrap.className = `${namespace}__property-value`;

      const valueText = document.createElement("span");
      valueText.textContent = typography[property];
      valueWrap.append(valueText);

      if (property === "color" || property === "backgroundColor") {
        valueWrap.prepend(createColorSwatch(typography[property]));
      }

      value.append(
        valueWrap,
        createCopyButton(`Copy ${displayLabel}`, typography[property])
      );

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

  function createCopyButton(label, value) {
    const button = createIconButton(label, "../icons/copy.svg");
    button.classList.add(`${namespace}__copy-button`);

    button.addEventListener("click", async () => {
      playButtonPress(button);
      const copied = await writeClipboard(value);
      const originalTitle = button.title;
      button.title = copied ? `${label} copied` : `${label} failed`;

      if (copied) {
        setTemporaryIcon(button, "../icons/Check.svg", true);
        showToast(`${label.replace(/^Copy\s+/, "")} copied`);
      }

      window.setTimeout(() => {
        button.title = originalTitle;
      }, 1100);
    });

    return button;
  }

  function setTemporaryIcon(button, temporaryIconSrc, isSuccess = false) {
    const img = button.querySelector(`.${namespace}__button-icon`);
    if (!img) return;

    const originalSrc = img.src;
    img.src = temporaryIconSrc;

    if (isSuccess) {
      button.classList.add(`${namespace}__icon-button--copied`);
    }

    window.setTimeout(() => {
      img.src = originalSrc;
      button.classList.remove(`${namespace}__icon-button--copied`);
    }, 1200);
  }

  function createIconButton(label, iconSource) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${namespace}__icon-button`;
    button.title = label;
    button.setAttribute("aria-label", label);

    const icon = document.createElement("img");
    icon.className = `${namespace}__button-icon`;
    icon.src = iconSource;
    icon.alt = "";
    icon.draggable = false;
    icon.setAttribute("aria-hidden", "true");

    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = `${namespace}__sr-only`;
    accessibleLabel.textContent = label;

    button.append(icon, accessibleLabel);
    return button;
  }

  function playButtonPress(button) {
    button.classList.remove(`${namespace}__icon-button--pressed`);
    void button.offsetWidth;
    button.classList.add(`${namespace}__icon-button--pressed`);

    window.setTimeout(() => {
      button.classList.remove(`${namespace}__icon-button--pressed`);
    }, 220);
  }

  function showToast(message) {
    const existing = document.querySelector(`.${namespace}__toast`);
    if (existing) {
      existing.remove();
    }
    window.clearTimeout(toastTimer);

    const toast = document.createElement("div");
    toast.className = `${namespace}__toast`;
    toast.textContent = message;
    document.body.append(toast);

    toastTimer = window.setTimeout(() => {
      toast.remove();
    }, 1800);
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

  function clampCurrentWindowWidth() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(enforceWindowWidth, 180);
  }

  async function enforceWindowWidth() {
    if (isClampingWindow) {
      resizePending = true;
      return;
    }
    isClampingWindow = true;
    try {
      const currentWindow = await chrome.windows.getCurrent();

      if (currentWindow.type !== "popup" || currentWindow.state !== "normal" ||
          !Number.isFinite(currentWindow.width)) return;
      const maximum = Math.min(MAX_WINDOW_WIDTH, window.screen.availWidth || MAX_WINDOW_WIDTH);
      const minimum = Math.min(MIN_WINDOW_WIDTH, maximum);
      const width = Math.min(Math.max(currentWindow.width, minimum), maximum);
      if (width !== currentWindow.width) {
        await chrome.windows.update(currentWindow.id, { width });
      }
    } catch (error) {
      console.warn("Font Inspector could not adjust the window width.", error);
    } finally {
      isClampingWindow = false;
      if (resizePending) {
        resizePending = false;
        clampCurrentWindowWidth();
      }
    }
  }
})();
