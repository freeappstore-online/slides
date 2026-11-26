// Device-local deck storage (IndexedDB via the persistence capability).
// This is always the working copy. When signed in, cloudSync.ts also syncs it
// with the account; signed out, decks stay on the device.

import type { LocalStore } from "@freeappstore/sdk/persist";
import { openStore, withTransaction } from "../../fas-capabilities/persistence";
import { isDeck, type Deck } from "./deck";
import type { Links } from "./sync";

const INDEX = "index";
const deckKey = (id: string) => `deck:${id}`;
const linksKey = (userId: string) => `sync:${userId}`;
/** Fired on window after every local save or delete, so a sync can follow. */
export const CHANGED_EVENT = "slides:changed";
const changed = () => window.dispatchEvent(new Event(CHANGED_EVENT));
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string");

let opening: Promise<LocalStore> | undefined;
// The latest version of each deck written in this tab. A deck saved on leaving
// the editor is readable here at once, before its IndexedDB write commits.
const latest = new Map<string, Deck>();

function store(): Promise<LocalStore> {
  opening ??= openStore({ namespace: "slides", version: 1 }).then((result) => {
    if (!result.ok) {
      opening = undefined;
      throw new Error(`Storage is unavailable on this device (${result.reason}).`);
    }
    return result.value;
  });
  return opening;
}

function fail(reason: string): never {
  throw new Error(reason === "quota" ? "This device is out of storage space." : `Could not save (${reason}).`);
}

/** All decks, most recently edited first. Damaged records are skipped, not deleted. */
export async function loadDecks(): Promise<Deck[]> {
  const db = await store();
  const result = await withTransaction(db, "readonly", async (tx) => {
    const ids = await tx.get(INDEX);
    if (!isIdList(ids)) return [];
    const decks = await Promise.all(ids.map((id) => tx.get(deckKey(id))));
    return decks.filter(isDeck);
  });
  if (!result.ok) throw new Error(`Could not read your decks (${result.reason}).`);
  return result.value.map((deck) => latest.get(deck.id) ?? deck).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDeck(id: string): Promise<Deck | undefined> {
  const cached = latest.get(id);
  if (cached) return cached;
  const result = await withTransaction(await store(), "readonly", (tx) => tx.get(deckKey(id)));
  if (!result.ok) throw new Error(`Could not read this deck (${result.reason}).`);
  return isDeck(result.value) ? result.value : undefined;
}

/** Save decks and add them to the index. Resolves only after the write commits. */
export async function saveDecks(...decks: Deck[]): Promise<void> {
  for (const deck of decks) latest.set(deck.id, deck);
  const result = await withTransaction(await store(), "readwrite", async (tx) => {
    const current = await tx.get(INDEX);
    const ids = new Set(isIdList(current) ? current : []);
    for (const deck of decks) {
      await tx.put(deckKey(deck.id), deck);
      ids.add(deck.id);
    }
    await tx.put(INDEX, [...ids]);
  });
  if (!result.ok) fail(result.reason);
  changed();
}

export async function removeDeck(id: string): Promise<void> {
  latest.delete(id);
  const result = await withTransaction(await store(), "readwrite", async (tx) => {
    const current = await tx.get(INDEX);
    await tx.put(INDEX, (isIdList(current) ? current : []).filter((other) => other !== id));
    await tx.delete(deckKey(id));
  });
  if (!result.ok) fail(result.reason);
  changed();
}

/** Sync links for one account (see sync.ts). */
export async function loadLinks(userId: string): Promise<Links> {
  const result = await withTransaction(await store(), "readonly", (tx) => tx.get(linksKey(userId)));
  if (!result.ok) throw new Error(`Could not read sync state (${result.reason}).`);
  return typeof result.value === "object" && result.value !== null ? (result.value as Links) : {};
}

export async function saveLinks(userId: string, links: Links): Promise<void> {
  const result = await withTransaction(await store(), "readwrite", (tx) => tx.put(linksKey(userId), links));
  if (!result.ok) fail(result.reason);
}
