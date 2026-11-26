import { describe, expect, it } from "vitest";
import { createDeck, createSlide, isDeck, normaliseDeck, type Deck } from "./deck";
import { fitsServer, planSync, toDocument, type Links, type RemoteDoc } from "./sync";

const deck = (id: string, updatedAt: number): Deck => ({ ...createDeck(id), id, updatedAt });
const doc = (id: string, updatedAt: number, fields: Record<string, unknown> = {}): RemoteDoc => ({
  title: id,
  slides: [{ layout: "title", title: id }],
  ...fields,
  id,
  _updatedAt: updatedAt,
});
const link = (remoteId: string, remoteAt: number, localAt: number) => ({ remoteId, remoteAt, localAt });
const ids = (decks: Deck[]) => decks.map((d) => d.id);

describe("planSync", () => {
  it("creates unsynced local decks and pulls unknown server documents", () => {
    const plan = planSync([deck("a", 1)], [doc("r1", 5)], {});
    expect(ids(plan.create)).toEqual(["a"]);
    expect(plan.pull).toEqual([{ localId: "r1", remote: doc("r1", 5) }]);
  });

  it("does nothing when neither side changed", () => {
    const plan = planSync([deck("a", 1)], [doc("r1", 5)], { a: link("r1", 5, 1) });
    expect(plan).toEqual({ pull: [], create: [], update: [], deleteLocal: [], deleteRemote: [], dropLinks: [], tooLarge: [] });
  });

  it("pushes a local edit and pulls a remote edit", () => {
    const links: Links = { a: link("r1", 5, 1), b: link("r2", 5, 1) };
    const plan = planSync([deck("a", 2), deck("b", 1)], [doc("r1", 5), doc("r2", 9)], links);
    expect(plan.update.map((u) => [u.deck.id, u.remoteId])).toEqual([["a", "r1"]]);
    expect(plan.pull.map((p) => p.localId)).toEqual(["b"]);
  });

  it("lets the later edit win when both sides changed", () => {
    const links: Links = { a: link("r1", 5, 1), b: link("r2", 5, 1) };
    const plan = planSync([deck("a", 20), deck("b", 7)], [doc("r1", 10), doc("r2", 10)], links);
    expect(plan.update.map((u) => u.deck.id)).toEqual(["a"]);
    expect(plan.pull.map((p) => p.localId)).toEqual(["b"]);
  });

  it("follows deletions on either side unless the other side edited since", () => {
    const links: Links = {
      gone: link("r1", 5, 1), // deleted on the server, unchanged here → delete here
      kept: link("r2", 5, 1), // deleted on the server, edited here → re-create
      mine: link("r3", 5, 1), // deleted here, unchanged there → delete there
      back: link("r4", 5, 1), // deleted here, edited there → restore
      both: link("r5", 5, 1), // deleted on both → forget
    };
    const plan = planSync([deck("gone", 1), deck("kept", 3)], [doc("r3", 5), doc("r4", 8)], links);
    expect(plan.deleteLocal).toEqual(["gone"]);
    expect(ids(plan.create)).toEqual(["kept"]);
    expect(plan.deleteRemote).toEqual(["r3"]);
    expect(plan.pull.map((p) => [p.localId, p.remote.id])).toEqual([["back", "r4"]]);
    expect(plan.dropLinks.sort()).toEqual(["both", "gone", "kept", "mine"]);
  });

  it("keeps decks over the size limit local", () => {
    const plan = planSync([deck("big", 2), deck("bigLinked", 2)], [doc("r1", 5)], { bigLinked: link("r1", 5, 1) }, () => false);
    expect(plan.tooLarge).toEqual(["big", "bigLinked"]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
  });
});

describe("toDocument and fitsServer", () => {
  it("stores everything but the local id, with the font filled in", () => {
    const d = deck("a", 1);
    const stored = toDocument(d);
    expect(stored).not.toHaveProperty("id");
    expect(stored).toMatchObject({ title: "a", theme: "paper", font: "classic", slides: d.slides });
  });

  it("measures the 64 KB limit in UTF-8 bytes", () => {
    const small = deck("a", 1);
    const big = { ...small, slides: [createSlide({ layout: "image", image: `data:image/png;base64,${"A".repeat(70_000)}` })] };
    expect(fitsServer(small)).toBe(true);
    expect(fitsServer(big)).toBe(false);
  });
});

describe("normaliseDeck", () => {
  it("completes a minimal document an AI might write", () => {
    const result = normaliseDeck(
      doc("r1", 1000, {
        title: "From AI",
        theme: "midnight",
        slides: [
          { layout: "title", title: "Hello" },
          { layout: "content", title: "Points", body: ["one", "- two"] },
          { title: "No layout", body: "text" },
          { layout: "nonsense", image: "https://example.com/a.png" },
          "not a slide",
        ],
      }),
      "r1",
      1000,
      50,
    );
    expect(isDeck(result)).toBe(true);
    expect(result).toMatchObject({ id: "r1", title: "From AI", theme: "midnight", createdAt: 50, updatedAt: 1000 });
    expect(result?.font).toBeUndefined();
    expect(result?.slides.map((s) => s.layout)).toEqual(["title", "content", "content", "image"]);
    expect(result?.slides[1].body).toBe("- one\n- two");
    expect(result?.slides[0]).toMatchObject({ body: "", body2: "", image: "", notes: "" });
  });

  it("fills defaults for missing or invalid deck fields and gives duplicate slide ids new ones", () => {
    const result = normaliseDeck(
      { title: 7, theme: "nope", font: "comic", slides: [{ id: "x", layout: "quote" }, { id: "x", layout: "stat", align: "justify" }] },
      "local",
      9,
    );
    expect(isDeck(result)).toBe(true);
    expect(result).toMatchObject({ title: "Untitled deck", theme: "paper" });
    expect(result?.font).toBeUndefined();
    expect(new Set(result?.slides.map((s) => s.id)).size).toBe(2);
    expect(result?.slides[1].align).toBeUndefined();
  });

  it("gives a deck without slides a title slide, keeps the app's own fields and takes the later time", () => {
    expect(normaliseDeck({ title: "Empty" }, "e", 5)?.slides).toMatchObject([{ layout: "title", title: "Empty" }]);
    const original = { ...createDeck("Round trip"), font: "serif" as const, updatedAt: 3 };
    const back = normaliseDeck({ ...toDocument(original), id: "server-id", _updatedAt: 2 }, original.id, 2);
    expect(back).toEqual(original);
  });

  it("rejects only things that are not objects", () => {
    expect(normaliseDeck(null, "x", 1)).toBeUndefined();
    expect(normaliseDeck([], "x", 1)).toBeUndefined();
  });
});

describe("mcp.json", () => {
  it("offers exactly the layouts, themes, fonts and styles the app accepts", async () => {
    const { readFileSync } = await import("node:fs");
    const { ALIGNS, FONTS, LAYOUTS, SIZES, THEMES } = await import("./deck");
    const manifest = JSON.parse(readFileSync(new URL("../public/mcp.json", import.meta.url), "utf8"));
    const schema = manifest.collections.decks.schema;
    const slide = schema.properties.slides.items;
    expect(manifest.version).toBe(1);
    expect(schema.required).toEqual(["title", "slides"]);
    expect(slide.required).toEqual(["layout", "title"]);
    expect(slide.properties.layout.enum).toEqual([...LAYOUTS]);
    expect(schema.properties.theme.enum).toEqual([...THEMES]);
    expect(schema.properties.font.enum).toEqual([...FONTS]);
    expect(slide.properties.align.enum).toEqual([...ALIGNS]);
    expect(slide.properties.size.enum).toEqual([...SIZES]);
  });
});
