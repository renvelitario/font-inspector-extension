const MENU_ID = "font-inspector-selection";
const INSPECTION_STORAGE_KEY = "fontInspectorLatestInspection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Font Inspector",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const inspection = await inspectTabSelection(tab.id);
  if (inspection) {
    await openInspectorWindow({
      ...inspection,
      source: {
        title: tab.title || "",
        url: tab.url || ""
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FONT_INSPECTOR_OPEN_INSPECTION") {
    return;
  }

  openInspectorWindow(message.inspection)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.warn("Font Inspector could not open the inspection window.", error);
      sendResponse({ ok: false });
    });

  return true;
});

async function inspectTabSelection(tabId) {
  try {
    return await sendInspectionMessage(tabId);
  } catch (error) {
    return injectInspector(tabId);
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

    return await sendInspectionMessage(tabId);
  } catch (error) {
    console.warn("Font Inspector could not run on this page.", error);
    return {
      ok: false,
      reason: "Font Inspector could not run on this page."
    };
  }
}

function sendInspectionMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "FONT_INSPECTOR_INSPECT_SELECTION" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      resolve(response);
    });
  });
}

async function openInspectorWindow(inspection) {
  await chrome.storage.session.set({
    [INSPECTION_STORAGE_KEY]: inspection
  });

  await chrome.windows.create({
    url: chrome.runtime.getURL("src/window/inspector.html"),
    type: "popup",
    width: 480,
    height: 640,
    focused: true
  });
}
