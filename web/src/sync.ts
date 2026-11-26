// Account sync, pure part: which decks to pull, push or delete. No storage or
// network here so it can be unit tested; cloudSync.ts carries the plan out.
//
// Each local deck that has been synced has a link to its server document,
// recording both sides' change times at the last sync. A side whose time
// moved since then has changed. When both changed, the later edit wins.

import type { Deck } from "./deck";

/** The server's per-document limit (packages/backend/src/routes/db.ts). */
export const MAX_DOC_BYTES = 64 * 1024;

export interface Link {
  remoteId: string;
  /** Server `_updatedAt` at the last sync. */
  remoteAt: number;
  /** Local `updatedAt` at the last sync. */
  localAt: number;
}

/** Local deck id → link. */
export type Links = Record<string, Link>;

/** A document as the collections API returns it. */
export type RemoteDoc = Record<string, unknown> & { id: string; _updatedAt: number };

export interface SyncPlan {
  /** Server documents to save locally under `localId`. */
  pull: { localId: string; remote: RemoteDoc }[];
  /** Local decks to create on the server (no server document yet, or it was deleted). */
  create: Deck[];
  /** Local decks to write over their server document. */
  update: { deck: Deck; remoteId: string }[];
  /** Local decks whose server document was deleted elsewhere. */
  deleteLocal: string[];
  /** Server documents whose local deck was deleted here. */
  deleteRemote: string[];
  /** Links to forget (their deck is gone on both sides, or is being re-created). */
  dropLinks: string[];
  /** Local decks over the server's size limit; they stay on this device. */
  tooLarge: string[];
}

/** What is stored on the server for a deck: everything but the local id. */
export function toDocument(deck: Deck): Record<string, unknown> {
  const { id: _id, ...rest } = deck;
  return { ...rest, font: deck.font ?? "classic" };
}

export function fitsServer(deck: Deck): boolean {
  return new TextEncoder().encode(JSON.stringify(toDocument(deck))).length <= MAX_DOC_BYTES;
}

export function planSync(local: Deck[], remote: RemoteDoc[], links: Links, fits: (deck: Deck) => boolean = fitsServer): SyncPlan {
  const plan: SyncPlan = { pull: [], create: [], update: [], deleteLocal: [], deleteRemote: [], dropLinks: [], tooLarge: [] };
  const byId = new Map(remote.map((doc) => [doc.id, doc]));
  const linked = new Set(Object.values(links).map((link) => link.remoteId));
  const localIds = new Set(local.map((deck) => deck.id));

  const push = (deck: Deck, remoteId?: string) => {
    if (!fits(deck)) plan.tooLarge.push(deck.id);
    else if (remoteId) plan.update.push({ deck, remoteId });
    else plan.create.push(deck);
  };

  for (const deck of local) {
    const link = links[deck.id];
    if (!link) {
      push(deck);
      continue;
    }
    const doc = byId.get(link.remoteId);
    const localChanged = deck.updatedAt !== link.localAt;
    if (!doc) {
      // Deleted elsewhere. Keep it only if it was edited here since.
      plan.dropLinks.push(deck.id);
      if (localChanged) push(deck);
      else plan.deleteLocal.push(deck.id);
      continue;
    }
    const remoteChanged = doc._updatedAt !== link.remoteAt;
    if (remoteChanged && (!localChanged || doc._updatedAt >= deck.updatedAt)) plan.pull.push({ localId: deck.id, remote: doc });
    else if (localChanged) push(deck, link.remoteId);
  }

  for (const [localId, link] of Object.entries(links)) {
    if (localIds.has(localId)) continue;
    // Deleted here. Delete it there too, unless it was edited there since.
    const doc = byId.get(link.remoteId);
    if (!doc) plan.dropLinks.push(localId);
    else if (doc._updatedAt === link.remoteAt) {
      plan.deleteRemote.push(link.remoteId);
      plan.dropLinks.push(localId);
    } else plan.pull.push({ localId, remote: doc });
  }

  for (const doc of remote) {
    if (!linked.has(doc.id)) plan.pull.push({ localId: doc.id, remote: doc });
  }
  return plan;
}
