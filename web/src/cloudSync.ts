// Account sync, effectful part: runs sync.ts's plan against the private
// `decks` collection when signed in. IndexedDB stays the working copy, so the
// app works the same offline; signed out, nothing here runs.

import { useEffect, useSyncExternalStore } from "react";
import type { FreeAppStore } from "@freeappstore/sdk";
import { useAuth } from "@freeappstore/sdk/hooks";
import { normaliseDeck } from "./deck";
import { CHANGED_EVENT, loadDeck, loadDecks, loadLinks, removeDeck, saveDecks, saveLinks } from "./storage";
import { planSync, toDocument, type RemoteDoc } from "./sync";

export interface SyncStatus {
  phase: "off" | "syncing" | "synced" | "error";
  /** Local deck ids too large to sync. */
  tooLarge: string[];
  error?: string;
}

/** Fired on window after a sync changed local decks; `detail` is their ids. */
export const SYNCED_EVENT = "slides:synced";

let status: SyncStatus = { phase: "off", tooLarge: [] };
const listeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
  );
}

const PAGE = 100;

async function syncOnce(app: FreeAppStore, userId: string) {
  const decks = app.collections.collection("decks");
  const remote: RemoteDoc[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await decks.query<RemoteDoc>({ limit: PAGE, offset });
    remote.push(...page.documents);
    if (page.documents.length < PAGE || remote.length >= page.total) break;
  }
  const [local, links] = await Promise.all([loadDecks(), loadLinks(userId)]);
  const plan = planSync(local, remote, links);
  const before = new Map(local.map((deck) => [deck.id, deck.updatedAt]));
  const changed: string[] = [];
  const save = () => saveLinks(userId, links);

  writing = true;
  try {
    for (const { localId, remote: doc } of plan.pull) {
      // Edited here while this sync was listing: leave it to the next sync.
      if (before.has(localId) && (await loadDeck(localId))?.updatedAt !== before.get(localId)) continue;
      const deck = normaliseDeck(doc, localId, doc._updatedAt);
      if (!deck) continue;
      await saveDecks(deck);
      links[localId] = { remoteId: doc.id, remoteAt: doc._updatedAt, localAt: deck.updatedAt };
      changed.push(localId);
    }
    for (const id of plan.deleteLocal) {
      await removeDeck(id);
      changed.push(id);
    }
  } finally {
    writing = false;
  }
  for (const id of plan.dropLinks) delete links[id];
  await save();
  if (changed.length) window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: changed }));

  for (const remoteId of plan.deleteRemote) await decks.delete(remoteId);
  // Save each link as soon as its document exists, so an interrupted sync never re-creates it.
  for (const deck of plan.create) {
    const created = await decks.create(toDocument(deck));
    const doc = await decks.get<RemoteDoc>(created.id);
    links[deck.id] = { remoteId: created.id, remoteAt: doc?._updatedAt ?? 0, localAt: deck.updatedAt };
    await save();
  }
  for (const { deck, remoteId } of plan.update) {
    const doc = await decks.update<RemoteDoc>(remoteId, toDocument(deck));
    links[deck.id] = { remoteId, remoteAt: doc._updatedAt, localAt: deck.updatedAt };
    await save();
  }
  return plan.tooLarge;
}

let running = false;
let again = false;
// True while a sync writes local decks, so those writes don't schedule another sync.
let writing = false;

function requestSync(app: FreeAppStore) {
  const userId = app.auth.user?.id;
  if (!userId) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ ...status, phase: "syncing" });
  syncOnce(app, userId)
    .then(
      (tooLarge) => app.auth.user?.id === userId && setStatus({ phase: "synced", tooLarge }),
      (error: unknown) =>
        app.auth.user?.id === userId &&
        setStatus({
          ...status,
          phase: "error",
          error: !navigator.onLine ? "You're offline" : error instanceof Error ? error.message : "Sync failed",
        }),
    )
    .finally(() => {
      running = false;
      if (again) {
        again = false;
        requestSync(app);
      }
    });
}

/** While signed in, sync on start, on focus or return to the tab, when back online, and shortly after local edits. */
export function useCloudSync(app: FreeAppStore) {
  const { user } = useAuth(app);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setStatus({ phase: "off", tooLarge: [] });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => requestSync(app);
    const onVisible = () => document.visibilityState === "visible" && sync();
    const onChange = () => {
      if (writing) return;
      clearTimeout(timer);
      timer = setTimeout(sync, 1500);
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CHANGED_EVENT, onChange);
    };
  }, [app, userId]);
}
