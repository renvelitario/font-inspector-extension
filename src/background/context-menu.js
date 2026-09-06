const MENU_ID = "font-inspector-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Font Inspector",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  inspectTabSelection(tab.id);
});

function inspectTabSelection(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "FONT_INSPECTOR_INSPECT_SELECTION" }, () => {
    if (!chrome.runtime.lastError) {
      return;
    }

    injectInspector(tabId);
  });
}

async function injectInspector(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["src/content/styles.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "src/utils/typography.js",
        "src/content/window.js",
        "src/content/inspector.js"
      ]
    });

    chrome.tabs.sendMessage(tabId, { type: "FONT_INSPECTOR_INSPECT_SELECTION" });
  } catch (error) {
    console.warn("Font Inspector could not run on this page.", error);
  }
}
