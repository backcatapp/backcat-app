/** Persist Ask chat turns in chrome.storage.local. */

import type { Source } from "./ask";

export type ChatTurn = {
  id: string;
  q: string;
  a: string;
  sources: Source[];
  at: number;
};

const MAX_TURNS = 40;

function key(scope: string): string {
  return `backcat_chat_${scope}`;
}

export async function loadChat(scope: string): Promise<ChatTurn[]> {
  const k = key(scope);
  const data = await chrome.storage.local.get(k);
  const turns = data[k];
  return Array.isArray(turns) ? turns : [];
}

export async function saveChat(scope: string, turns: ChatTurn[]): Promise<void> {
  await chrome.storage.local.set({ [key(scope)]: turns.slice(-MAX_TURNS) });
}

export async function appendChat(scope: string, turn: ChatTurn): Promise<ChatTurn[]> {
  const prev = await loadChat(scope);
  const next = [...prev, turn].slice(-MAX_TURNS);
  await saveChat(scope, next);
  return next;
}

export async function clearChat(scope: string): Promise<void> {
  await chrome.storage.local.remove(key(scope));
}
