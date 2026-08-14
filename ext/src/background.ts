/** Service worker: side panel, token relay, privileged API proxy (avoids
 * YouTube-page Private Network Access blocks on localhost). */

import { getAccessToken, getStoredTokens } from "./lib/auth";

const SERVE = __SERVE_URL__;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "close-backcat-panel" }).catch(() => {});
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "get-tokens") {
    getStoredTokens().then((t) => sendResponse(t)).catch(() => sendResponse(null));
    return true;
  }
  if (msg?.type === "get-access-token") {
    getAccessToken()
      .then((token) => sendResponse({ token }))
      .catch(() => sendResponse({ token: null }));
    return true;
  }
  if (msg?.type === "open-side-panel") {
    const tabId = sender.tab?.id;
    const openFor = (id: number) => {
      // Drop the on-page Ask panel so it doesn't sit under the side panel.
      chrome.tabs.sendMessage(id, { type: "close-backcat-panel" }).catch(() => {});
      chrome.sidePanel.open({ tabId: id }).catch(() => {});
    };
    if (tabId != null) {
      openFor(tabId);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id != null) openFor(tabs[0].id);
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  // Privileged fetch — content scripts call this instead of hitting localhost
  // directly (https://youtube.com → http://localhost is often blocked).
  if (msg?.type === "api") {
    const { method, path, body } = msg as {
      method?: string;
      path: string;
      body?: unknown;
    };
    (async () => {
      try {
        const headers = await authHeaders();
        const resp = await fetch(`${SERVE}${path}`, {
          method: method || "GET",
          headers,
          body: body != null ? JSON.stringify(body) : undefined,
        });
        const text = await resp.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        sendResponse({ ok: resp.ok, status: resp.status, data });
      } catch (e: unknown) {
        sendResponse({
          ok: false,
          status: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return true;
  }

  // SSE ask proxied through the worker; events posted back to the tab.
  if (msg?.type === "ask-stream") {
    const tabId = sender.tab?.id;
    const { catalogId, question, requestId } = msg as {
      catalogId: string;
      question: string;
      requestId: string;
    };
    (async () => {
      try {
        const headers = await authHeaders();
        const resp = await fetch(`${SERVE}/api/catalogs/${catalogId}/ask`, {
          method: "POST",
          headers,
          body: JSON.stringify({ question }),
        });
        if (!resp.ok || !resp.body) {
          if (tabId != null) {
            chrome.tabs.sendMessage(tabId, {
              type: "ask-event",
              requestId,
              event: "error",
              data: { message: `request failed (${resp.status})`, code: resp.status },
            });
          }
          sendResponse({ ok: false });
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const emit = (event: string, data: unknown) => {
          if (tabId == null) return;
          chrome.tabs.sendMessage(tabId, { type: "ask-event", requestId, event, data });
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            let event = "";
            let data = "";
            for (const line of block.split("\n")) {
              if (line.startsWith("event: ")) event = line.slice(7).trim();
              else if (line.startsWith("data: ")) data += line.slice(6);
            }
            if (!event) continue;
            emit(event, data ? JSON.parse(data) : {});
          }
        }
        sendResponse({ ok: true });
      } catch (e: unknown) {
        if (tabId != null) {
          chrome.tabs.sendMessage(tabId, {
            type: "ask-event",
            requestId,
            event: "error",
            data: { message: e instanceof Error ? e.message : String(e) },
          });
        }
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  return false;
});
