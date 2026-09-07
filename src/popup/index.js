(() => {
  const STORAGE_KEY = "fontInspectorSavedFonts";
  const INSPECTION_STORAGE_KEY = "fontInspectorLatestInspection";
  const THEME_STORAGE_KEY = "fontInspectorTheme";
  const namespace = "font-inspector-popup";
  const root = document.getElementById("font-inspector-popup-root");
  let currentSavedFonts = [];
  let currentSearchQuery = "";
  let currentTheme = "system";
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    renderLoading();
    renderSavedFonts();
  });

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes[STORAGE_KEY]) {
        renderSavedFonts();
      }
      if (changes[THEME_STORAGE_KEY]) {
        applyTheme(changes[THEME_STORAGE_KEY].newValue);
      }
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
    document.documentElement.classList.remove("theme-light", "theme-dark");

    if (currentTheme === "light") {
      document.body.classList.add("theme-light");
      document.documentElement.classList.add("theme-light");
    } else if (currentTheme === "dark") {
      document.body.classList.add("theme-dark");
      document.documentElement.classList.add("theme-dark");
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
    render();
  }

  async function renderSavedFonts() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      currentSavedFonts = normalizeSavedFonts(result[STORAGE_KEY]);
      render();
    } catch (error) {
      console.warn("Font Inspector could not load saved fonts.", error);
      renderError();
    }
  }

  function renderLoading() {
    root.replaceChildren(createHeader(0, 0), createMessageBody("Loading saved fonts."), createFooter());
  }

  function renderError() {
    root.replaceChildren(createHeader(0, 0), createMessageBody("Saved fonts could not be loaded."), createFooter());
  }

  function render() {
    const filteredFonts = filterSavedFonts(currentSavedFonts, currentSearchQuery);
    root.replaceChildren(
      createHeader(filteredFonts.length, currentSavedFonts.length),
      createBody(filteredFonts),
      createFooter()
    );
  }

  function filterSavedFonts(fonts, query) {
    if (!query || !query.trim()) {
      return fonts;
    }

    const q = query.trim().toLowerCase();
    return fonts.filter((font) => {
      const nameMatch = font.name && font.name.toLowerCase().includes(q);
      const familyMatch = font.typography?.fontFamily && font.typography.fontFamily.toLowerCase().includes(q);
      const sourceMatch = font.source && (
        (font.source.title && font.source.title.toLowerCase().includes(q)) ||
        (font.source.url && font.source.url.toLowerCase().includes(q))
      );
      const sampleMatch = font.sampleText && font.sampleText.toLowerCase().includes(q);
      const elementMatch = font.elementName && font.elementName.toLowerCase().includes(q);
      return nameMatch || familyMatch || sourceMatch || sampleMatch || elementMatch;
    });
  }

  function normalizeSavedFonts(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((savedFont) =>
      savedFont && typeof savedFont === "object" &&
      savedFont.typography && typeof savedFont.typography === "object"
    );
  }

  function createHeader(count, totalCount) {
    const header = document.createElement("header");
    header.className = `${namespace}__header`;

    const top = document.createElement("div");
    top.className = `${namespace}__header-top`;

    const titleWrap = document.createElement("div");
    titleWrap.className = `${namespace}__header-title-wrap`;

    const logo = document.createElement("img");
    logo.className = `${namespace}__logo`;
    logo.src = "../logo/Logo.png";
    logo.alt = "";
    logo.draggable = false;
    logo.setAttribute("aria-hidden", "true");

    const titleText = document.createElement("div");
    titleText.className = `${namespace}__header-title-text`;

    const title = document.createElement("h1");
    title.textContent = "Font Inspector";

    const version = document.createElement("p");
    version.className = `${namespace}__version`;
    version.textContent = `Version ${getExtensionVersion()}`;

    titleText.append(title, version);
    titleWrap.append(logo, titleText);
    top.append(titleWrap, createThemeToggleButton());
    header.append(top, createHeaderDivider(), createSavedFontsHeader(count, totalCount));

    if (totalCount > 0) {
      const searchWrap = document.createElement("div");
      searchWrap.className = `${namespace}__search-wrap`;

      const searchIcon = document.createElement("img");
      searchIcon.className = `${namespace}__search-icon`;
      searchIcon.src = "../icons/search.svg";
      searchIcon.alt = "";
      searchIcon.setAttribute("aria-hidden", "true");

      const searchInput = document.createElement("input");
      searchInput.type = "search";
      searchInput.className = `${namespace}__search-input`;
      searchInput.placeholder = "Search saved fonts...";
      searchInput.value = currentSearchQuery;
      searchInput.setAttribute("aria-label", "Search saved fonts");

      searchInput.addEventListener("input", (e) => {
        currentSearchQuery = e.target.value;
        render();
        const nextInput = root.querySelector(`.${namespace}__search-input`);
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(currentSearchQuery.length, currentSearchQuery.length);
        }
      });

      searchWrap.append(searchIcon, searchInput);
      header.append(searchWrap);
    }

    return header;
  }

  function createFooter() {
    const footer = document.createElement("footer");
    footer.className = `${namespace}__footer`;
    footer.append(createInspectButton());
    return footer;
  }

  function getExtensionVersion() {
    return chrome.runtime?.getManifest?.().version || "1.0.0";
  }

  function createSavedFontsHeader(count, totalCount) {
    const sectionHeader = document.createElement("div");
    sectionHeader.className = `${namespace}__saved-header`;

    const titleWrap = document.createElement("div");
    titleWrap.className = `${namespace}__saved-header-title`;

    const heading = document.createElement("h2");
    heading.textContent = "Saved Fonts";

    const countText = document.createElement("p");
    if (currentSearchQuery.trim()) {
      countText.textContent = `${count} of ${totalCount}`;
    } else {
      countText.textContent = totalCount === 1 ? "1 font" : `${totalCount} fonts`;
    }

    titleWrap.append(heading, countText);
    sectionHeader.append(titleWrap);

    if (totalCount > 0) {
      sectionHeader.append(createClearSavedFontsButton());
    }

    return sectionHeader;
  }

  function createClearSavedFontsButton() {
    const button = createIconButton("Clear all saved fonts", "../icons/Clear.svg");
    button.classList.add(`${namespace}__clear-button`);

    button.addEventListener("click", async () => {
      playButtonPress(button);
      const confirmed = window.confirm("Clear all saved fonts? This cannot be undone.");
      if (!confirmed) {
        return;
      }

      await clearSavedFonts();
      showToast("Saved fonts cleared");
    });

    return button;
  }

  function createHeaderDivider() {
    const divider = document.createElement("div");
    divider.className = `${namespace}__header-divider`;
    divider.setAttribute("aria-hidden", "true");
    return divider;
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

  function createInspectButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${namespace}__primary-button ${namespace}__inspect-button`;
    button.title = "Inspect text on page";
    button.setAttribute("aria-label", "Inspect text on page");

    const icon = document.createElement("img");
    icon.className = `${namespace}__primary-button-icon`;
    icon.src = "../icons/Inspect.svg";
    icon.alt = "";
    icon.draggable = false;
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = "Inspect Text";

    button.append(icon, label);

    button.addEventListener("click", async () => {
      playButtonPress(button);
      const started = await startElementPicker();
      if (started) {
        window.close();
      } else {
        showToast("Could not start inspector");
      }
    });

    return button;
  }

  async function startElementPicker() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return false;
    }

    try {
      await sendStartPickerMessage(tab.id);
      return true;
    } catch (error) {
      return injectInspector(tab.id);
    }
  }

  async function injectInspector(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "src/utils/typography.js",
          "src/content/inspector.js"
        ]
      });

      await sendStartPickerMessage(tabId);
      return true;
    } catch (error) {
      console.warn("Font Inspector could not start element picker.", error);
      return false;
    }
  }

  function sendStartPickerMessage(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: "FONT_INSPECTOR_START_PICKER" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        response?.ok ? resolve(response) : reject(new Error("Element picker did not start."));
      });
    });
  }

  function createBody(savedFonts) {
    const body = document.createElement("div");
    body.className = `${namespace}__body`;

    if (currentSavedFonts.length === 0) {
      body.append(createMessage("No saved fonts yet."));
      return body;
    }

    if (savedFonts.length === 0) {
      body.append(createMessage("No saved fonts match your search."));
      return body;
    }

    savedFonts.forEach((savedFont, index) => {
      body.append(createSavedFontCard(savedFont, index));
    });

    return body;
  }

  function createMessage(text) {
    const message = document.createElement("p");
    message.className = `${namespace}__empty`;
    message.textContent = text;
    return message;
  }

  function createMessageBody(text) {
    const body = document.createElement("div");
    body.className = `${namespace}__body`;
    body.append(createMessage(text));
    return body;
  }

  function createSavedFontCard(savedFont, index) {
    const card = document.createElement("article");
    card.className = `${namespace}__card`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${savedFont.name || `Saved Font ${index + 1}`} details`);

    card.addEventListener("click", () => {
      openSavedFontWindow(savedFont, index);
    });

    card.addEventListener("keydown", (event) => {
      if (event.target !== card) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSavedFontWindow(savedFont, index);
      }
    });

    const header = document.createElement("div");
    header.className = `${namespace}__card-header`;

    const titleWrap = document.createElement("div");
    titleWrap.className = `${namespace}__card-title`;

    const titleRow = document.createElement("div");
    titleRow.className = `${namespace}__card-title-row`;

    const title = document.createElement("h2");
    title.textContent = savedFont.name || `Saved Font ${index + 1}`;

    titleRow.append(title);

    if (savedFont.elementName) {
      const badge = document.createElement("span");
      badge.className = `${namespace}__tag-badge`;
      badge.textContent = savedFont.elementName;
      titleRow.append(badge);
    }

    const meta = document.createElement("p");
    meta.textContent = getSavedFontMeta(savedFont);

    titleWrap.append(titleRow, meta);

    const actions = document.createElement("div");
    actions.className = `${namespace}__card-actions`;
    actions.append(
      createCopyCssButton(savedFont.typography),
      createDeleteButton(savedFont.id)
    );

    header.append(titleWrap, actions);
    card.append(header);

    card.append(createSavedFontSummary(savedFont));
    return card;
  }

  function createSavedFontSummary(savedFont) {
    const summary = document.createElement("div");
    summary.className = `${namespace}__summary`;

    if (savedFont.sampleText) {
      const preview = document.createElement("p");
      preview.className = `${namespace}__summary-sample`;
      preview.textContent = savedFont.sampleText;
      if (savedFont.typography?.fontFamily) {
        preview.style.fontFamily = savedFont.typography.fontFamily;
      }
      summary.append(preview);
    }

    const facts = document.createElement("div");
    facts.className = `${namespace}__summary-facts`;

    [
      savedFont.typography?.fontSize,
      savedFont.typography?.fontWeight && `Weight ${savedFont.typography.fontWeight}`,
      savedFont.typography?.lineHeight && `Line ${savedFont.typography.lineHeight}`
    ].filter(Boolean).forEach((fact) => {
      const chip = document.createElement("span");
      chip.textContent = fact;
      facts.append(chip);
    });

    if (savedFont.typography?.color) {
      const colorChip = document.createElement("span");
      colorChip.className = `${namespace}__summary-color`;
      colorChip.append(createColorSwatch(savedFont.typography.color), document.createTextNode(savedFont.typography.color));
      facts.append(colorChip);
    }

    if (facts.childElementCount > 0) {
      summary.append(facts);
    }

    return summary;
  }

  function getSavedFontMeta(savedFont) {
    const parts = [];

    if (savedFont.typography?.fontFamily) {
      parts.push(savedFont.typography.fontFamily.split(",")[0]);
    }

    if (savedFont.source) {
      const source = getSourceLabel(savedFont.source);
      if (source) parts.push(source);
    }

    if (savedFont.savedAt) {
      parts.push(formatDate(savedFont.savedAt));
    }

    return parts.join(" / ");
  }

  function getSourceLabel(source) {
    try {
      const url = new URL(source.url);
      return url.hostname;
    } catch (error) {
      return source.title || source.url || "";
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function createColorSwatch(color) {
    const swatch = document.createElement("span");
    swatch.className = `${namespace}__swatch`;
    swatch.style.backgroundColor = color;
    return swatch;
  }

  function createCopyCssButton(typography) {
    const button = createIconButton("Copy CSS Snippet", "../icons/code.svg");
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      playButtonPress(button);
      const cssString = window.FontInspectorTypography.typographyToCss(typography || {});
      const copied = await writeClipboard(cssString);
      if (copied) {
        setTemporaryIcon(button, "../icons/Check.svg", true);
        showToast("CSS copied to clipboard");
      }
    });
    return button;
  }

  function createDeleteButton(id) {
    const button = createIconButton("Delete saved font", "../icons/Delete.svg");
    button.classList.add(`${namespace}__delete-button`);

    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      playButtonPress(button);
      await deleteSavedFont(id);
      showToast("Font deleted");
    });

    return button;
  }

  async function openSavedFontWindow(savedFont, index) {
    const inspection = {
      ok: true,
      selectedText: savedFont.sampleText || savedFont.name || `Saved Font ${index + 1}`,
      source: savedFont.source || null,
      multipleStyles: false,
      styles: [{
        savedFontId: savedFont.id,
        elementName: savedFont.elementName,
        sampleText: savedFont.sampleText,
        typography: { ...(savedFont.typography || {}) }
      }]
    };

    try {
      await chrome.storage.session.set({ [INSPECTION_STORAGE_KEY]: inspection });
      await chrome.windows.create({
        url: chrome.runtime.getURL("src/window/inspector.html"),
        type: "popup",
        width: 480,
        height: 640,
        focused: true
      });
    } catch (error) {
      console.warn("Font Inspector could not open this saved font.", error);
      showToast("Could not open font details");
    }
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

    button.append(icon);
    return button;
  }

  async function deleteSavedFont(id) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const savedFonts = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const nextSavedFonts = id
      ? savedFonts.filter((savedFont) => savedFont.id !== id)
      : savedFonts.slice(1);

    await chrome.storage.local.set({ [STORAGE_KEY]: nextSavedFonts });
    currentSavedFonts = nextSavedFonts;
    render();
  }

  async function clearSavedFonts() {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    currentSavedFonts = [];
    currentSearchQuery = "";
    render();
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
})();
