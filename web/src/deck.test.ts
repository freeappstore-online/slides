import { describe, expect, it } from "vitest";
import {
  addSlide,
  createDeck,
  createSlide,
  deleteSlide,
  duplicateDeck,
  duplicateSlide,
  isDeck,
  moveSlide,
  normaliseDeck,
  parseBackup,
  toBackup,
  updateSlide,
} from "./deck";
import { deckFromTemplate, TEMPLATES } from "./templates";

const deckWith = (...titles: string[]) => createDeck("Test", titles.map((title) => createSlide({ title })));
const titles = (deck: ReturnType<typeof createDeck>) => deck.slides.map((slide) => slide.title);

describe("deck operations", () => {
  it("creates a deck with a title slide", () => {
    const deck = createDeck("Talk");
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]).toMatchObject({ layout: "title", title: "Talk" });
    expect(isDeck(deck)).toBe(true);
  });

  it("adds a slide after the given index", () => {
    const [deck, index] = addSlide(deckWith("a", "b"), 0, createSlide({ title: "new" }));
    expect(titles(deck)).toEqual(["a", "new", "b"]);
    expect(index).toBe(1);
  });

  it("duplicates a slide with a new id", () => {
    const source = deckWith("a", "b");
    const [deck, index] = duplicateSlide(source, 1);
    expect(titles(deck)).toEqual(["a", "b", "b"]);
    expect(index).toBe(2);
    expect(deck.slides[2].id).not.toBe(deck.slides[1].id);
  });

  it("deletes a slide but never the last one", () => {
    const [deck, index] = deleteSlide(deckWith("a", "b", "c"), 2);
    expect(titles(deck)).toEqual(["a", "b"]);
    expect(index).toBe(1);
    const single = deckWith("only");
    expect(deleteSlide(single, 0)[0]).toBe(single);
  });

  it("moves slides and ignores out-of-range moves", () => {
    const source = deckWith("a", "b", "c");
    const [deck, index] = moveSlide(source, 0, 2);
    expect(titles(deck)).toEqual(["b", "c", "a"]);
    expect(index).toBe(2);
    expect(moveSlide(source, 0, -1)[0]).toBe(source);
    expect(moveSlide(source, 2, 3)[0]).toBe(source);
  });

  it("updates one slide without touching the others", () => {
    const source = deckWith("a", "b");
    const deck = updateSlide(source, 1, { notes: "hi" });
    expect(deck.slides[1].notes).toBe("hi");
    expect(deck.slides[0]).toBe(source.slides[0]);
  });

  it("duplicates a deck with fresh ids", () => {
    const source = deckWith("a", "b");
    const copy = duplicateDeck(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.title).toBe("Test (copy)");
    expect(titles(copy)).toEqual(["a", "b"]);
    copy.slides.forEach((slide, i) => expect(slide.id).not.toBe(source.slides[i].id));
  });
});

describe("validation", () => {
  // A deck as saved before themes, fonts and text styles were extended.
  const oldDeck = {
    id: "abc123",
    title: "Old",
    theme: "sky",
    slides: [{ id: "s1", layout: "image", title: "Pic", body: "", body2: "", image: "", notes: "" }],
    createdAt: 1,
    updatedAt: 2,
  };

  it("still accepts decks saved before fonts and new layouts existed", () => {
    expect(isDeck(oldDeck)).toBe(true);
    expect(parseBackup(JSON.stringify({ app: "slides", version: 1, exportedAt: "", decks: [oldDeck] }))).toEqual([oldDeck]);
  });

  it("accepts the new layouts, themes, fonts and text styles", () => {
    const slide = { ...oldDeck.slides[0], layout: "image-text", align: "center", size: "large" };
    expect(isDeck({ ...oldDeck, theme: "midnight", font: "mono", slides: [slide] })).toBe(true);
  });

  it("rejects unknown fonts, alignments and sizes", () => {
    expect(isDeck({ ...oldDeck, font: "comic" })).toBe(false);
    expect(isDeck({ ...oldDeck, slides: [{ ...oldDeck.slides[0], align: "justify" }] })).toBe(false);
    expect(isDeck({ ...oldDeck, slides: [{ ...oldDeck.slides[0], size: 3 }] })).toBe(false);
  });

  it("makes a valid deck from every template", () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual(
      expect.arrayContaining(["blank", "pitch", "project-update", "lesson", "workshop", "portfolio", "weekly-report", "talk"]),
    );
    for (const template of TEMPLATES) {
      const deck = deckFromTemplate(template);
      expect(isDeck(deck), template.id).toBe(true);
      expect(deck.slides).toHaveLength(template.slides.length);
      expect(new Set(deck.slides.map((slide) => slide.id)).size).toBe(deck.slides.length);
    }
  });
});

describe("backup", () => {
  it("round-trips decks through JSON", () => {
    const decks = [deckWith("a"), createDeck("Other")];
    expect(parseBackup(JSON.stringify(toBackup(decks)))).toEqual(decks);
  });

  it("rejects files that are not valid backups", () => {
    expect(() => parseBackup("not json")).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"notes","decks":[]}')).toThrow(/not a Slides backup/);
    expect(() => parseBackup('{"app":"slides","version":2,"decks":[]}')).toThrow(/newer version/);
    expect(() => parseBackup('{"app":"slides","version":1,"decks":[{"id":1}]}')).toThrow(/damaged/);
  });
});

describe("normaliseDeck", () => {
  it("completes a minimal document an AI might write", () => {
    const result = normaliseDeck(
      {
        title: "From AI",
        theme: "midnight",
        slides: [
          { layout: "title", title: "Hello" },
          { layout: "content", title: "Points", body: ["one", "- two"] },
          { title: "No layout", body: "text" },
          { layout: "nonsense", image: "https://example.com/a.png" },
          "not a slide",
        ],
      },
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
    const { id, ...stored } = original;
    expect(normaliseDeck(stored, id, 2)).toEqual(original);
  });

  it("rejects only things that are not objects", () => {
    expect(normaliseDeck(null, "x", 1)).toBeUndefined();
    expect(normaliseDeck([], "x", 1)).toBeUndefined();
  });
});
