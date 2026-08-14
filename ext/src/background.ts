/** Service worker: open the side panel on toolbar click; relay seek messages. */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "get-tokens") {
    chrome.storage.local.get("backcat_tokens").then((data) => {
      sendResponse(data.backcat_tokens ?? null);
    });
    return true;
  }
  if (msg?.type === "open-side-panel") {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
