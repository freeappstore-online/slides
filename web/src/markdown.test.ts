import { describe, expect, it } from "vitest";
import { createDeck, createSlide } from "./deck";
import { deckToMarkdown, markdownToDeck, parseBody, parseInline } from "./markdown";

const strip = ({ id: _id, ...rest }: { id: string }) => rest;

describe("markdownToDeck", () => {
  it("splits slides on --- and reads front matter, titles, bullets and notes", () => {
    const deck = markdownToDeck(
      [
        "---",
        "title: Quarterly review: Q3",
        "theme: sky",
        "---",
        "",
        "# Welcome",
        "",
        "---",
        "",
        "## Agenda",
        "- Results",
        "- Plans",
        "",
        "Note: Keep this short.",
        "Second line of notes.",
      ].join("\n"),
    );
    expect(deck.title).toBe("Quarterly review: Q3");
    expect(deck.theme).toBe("sky");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]).toMatchObject({ layout: "title", title: "Welcome", body: "" });
    expect(deck.slides[1]).toMatchObject({
      layout: "content",
      title: "Agenda",
      body: "- Results\n- Plans",
      notes: "Keep this short.\nSecond line of notes.",
    });
  });

  it("infers two-column and image layouts and honours explicit layout comments", () => {
    const deck = markdownToDeck(
      [
        "# Compare",
        "Left",
        "<!-- column -->",
        "Right",
        "---",
        "# Photo",
        "![alt](data:image/png;base64,AAAA)",
        "Caption",
        "---",
        "<!-- layout: content -->",
        "# Only a title",
      ].join("\n"),
    );
    expect(deck.slides.map((slide) => slide.layout)).toEqual(["two-column", "image", "content"]);
    expect(deck.slides[0]).toMatchObject({ body: "Left", body2: "Right" });
    expect(deck.slides[1]).toMatchObject({ image: "data:image/png;base64,AAAA", body: "Caption" });
  });

  it("does not split on --- inside a code fence and falls back to the file name", () => {
    const deck = markdownToDeck("Intro text\n\n```\n---\n```\n", "talk");
    expect(deck.title).toBe("talk");
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0].body).toBe("Intro text\n\n```\n---\n```");
  });

  it("returns one slide for an empty file", () => {
    expect(markdownToDeck("", "empty").slides).toHaveLength(1);
  });
});

describe("deckToMarkdown", () => {
  it("round-trips every layout, notes and structural-looking body lines", () => {
    const deck = createDeck("Round trip", [
      createSlide({ layout: "title", title: "Hello", body: "A subtitle" }),
      createSlide({ layout: "content", title: "Points", body: "- one\n  - nested\n---\n# not a title\nNote: not notes", notes: "Say hi" }),
      createSlide({ layout: "two-column", title: "Cols", body: "Left side", body2: "- right" }),
      createSlide({ layout: "image", title: "Pic", image: "data:image/webp;base64,UklG", body: "Caption" }),
      createSlide({ layout: "content", title: "", body: "No title here" }),
    ]);
    deck.theme = "mint";
    const markdown = deckToMarkdown(deck);
    expect(markdown.split("\n---\n").length).toBeGreaterThanOrEqual(5);
    const back = markdownToDeck(markdown);
    expect(back.title).toBe("Round trip");
    expect(back.theme).toBe("mint");
    expect(back.slides.map(strip)).toEqual(deck.slides.map(strip));
  });
});

describe("parseBody", () => {
  it("groups bullets into lists with depth and keeps paragraphs and code", () => {
    expect(parseBody("Intro\nmore\n\n- a\n  - b\n* c\n\n```\ncode\n```")).toEqual([
      { type: "paragraph", text: "Intro\nmore" },
      { type: "list", items: [{ text: "a", depth: 0 }, { text: "b", depth: 1 }, { text: "c", depth: 0 }] },
      { type: "code", text: "code" },
    ]);
  });
});

describe("parseInline", () => {
  it("parses bold, italic and code and leaves unclosed markers", () => {
    expect(parseInline("a **b** _c_ `d` 2 * 3")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", italic: true },
      { text: " " },
      { text: "d", code: true },
      { text: " 2 * 3" },
    ]);
  });
});
