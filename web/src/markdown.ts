// Markdown import/export and the small body-text format slides are written in.
//
// Deck file format (compatible with reveal.js/Marp-style Markdown):
//
//   ---
//   title: My deck
//   theme: paper
//   font: serif
//   ---
//
//   <!-- layout: title -->
//   # Slide title
//
//   Body text
//   - bullet
//
//   Note:
//   Speaker notes
//
//   ---
//
//   # Next slide
//
// Slides are separated by a line containing only `---`. Two-column slides split
// their columns with `<!-- column -->` (a quote slide puts its attribution after
// it); image slides carry one `![](...)` line. The layout comment may also set
// the text style: `<!-- layout: content, align: center, size: large -->`.

import {
  ALIGNS,
  createDeck,
  createSlide,
  FONTS,
  LAYOUTS,
  SIZES,
  THEMES,
  type Align,
  type Deck,
  type Font,
  type Layout,
  type Slide,
  type TextSize,
  type Theme,
} from "./deck";

// ---------------------------------------------------------------------------
// Body text → blocks (used by the slide renderer)

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: { text: string; depth: number }[] }
  | { type: "code"; text: string };

const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const FENCE = /^\s*```/;

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flush();
      const depth = Math.min(Math.floor(bullet[1].replace(/\t/g, "  ").length / 2), 3);
      const last = blocks[blocks.length - 1];
      const item = { text: bullet[2], depth };
      if (last?.type === "list") last.items.push(item);
      else blocks.push({ type: "list", items: [item] });
    } else if (line.trim() === "") {
      flush();
    } else {
      // A non-bullet line ends a list and starts (or continues) a paragraph.
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

/** Split `**bold**`, `*italic*` / `_italic_` and `` `code` `` spans. Unclosed markers stay literal. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("`")) out.push({ text: token.slice(1, -1), code: true });
    else if (token.startsWith("**")) out.push({ text: token.slice(2, -2), bold: true });
    else out.push({ text: token.slice(1, -1), italic: true });
    last = index + token.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// ---------------------------------------------------------------------------
// Export

// Body lines that would otherwise be read as structure get a leading backslash.
const STRUCTURAL = /^\\*(?:---\s*$|notes?:|#|<!--|!\[)/i;
const escapeLine = (line: string) => (STRUCTURAL.test(line) ? `\\${line}` : line);
const unescapeLine = (line: string) => (line.startsWith("\\") && STRUCTURAL.test(line.slice(1)) ? line.slice(1) : line);

function escapeText(text: string): string[] {
  let inFence = false;
  return text.split("\n").map((line) => {
    if (FENCE.test(line)) inFence = !inFence;
    return inFence || FENCE.test(line) ? line : escapeLine(line);
  });
}

function slideToMarkdown(slide: Slide): string {
  const style = [slide.align && `align: ${slide.align}`, slide.size && `size: ${slide.size}`].filter(Boolean);
  const lines: string[] = [`<!-- layout: ${[slide.layout, ...style].join(", ")} -->`];
  if (slide.title.trim()) lines.push(`# ${slide.title.trim().replace(/\s*\n\s*/g, " ")}`, "");
  if ((slide.layout === "image" || slide.layout === "image-text") && slide.image) lines.push(`![${slide.title.replace(/[[\]]/g, "")}](${slide.image})`, "");
  if (slide.body.trim()) lines.push(...escapeText(slide.body.trim()), "");
  if (slide.layout === "two-column" || slide.layout === "quote") {
    lines.push("<!-- column -->", "");
    if (slide.body2.trim()) lines.push(...escapeText(slide.body2.trim()), "");
  }
  if (slide.notes.trim()) lines.push("Note:", ...escapeText(slide.notes.trim()), "");
  while (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function deckToMarkdown(deck: Deck): string {
  const header = [
    "---",
    `title: ${deck.title.replace(/\s*\n\s*/g, " ")}`,
    `theme: ${deck.theme}`,
    ...(deck.font ? [`font: ${deck.font}`] : []),
    "---",
  ].join("\n");
  return `${header}\n\n${deck.slides.map(slideToMarkdown).join("\n\n---\n\n")}\n`;
}

// ---------------------------------------------------------------------------
// Import

const SEPARATOR = /^---\s*$/;
const LAYOUT_COMMENT = /^<!--\s*layout:\s*([\w-]+)((?:\s*[,;]\s*[\w-]+\s*:\s*[\w-]+)*)\s*[,;]?\s*-->\s*$/i;
const COLUMN_COMMENT = /^<!--\s*column\s*-->\s*$/i;
const NOTES = /^notes?:\s?(.*)$/i;
const HEADING = /^#{1,6}\s+(.*?)\s*#*\s*$/;
const IMAGE = /^!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/;

function readFrontMatter(lines: string[]): { meta: Record<string, string>; rest: string[] } {
  if (!SEPARATOR.test(lines[0] ?? "")) return { meta: {}, rest: lines };
  const end = lines.findIndex((line, i) => i > 0 && SEPARATOR.test(line));
  const inner = end > 0 ? lines.slice(1, end) : [];
  if (end < 0 || !inner.every((line) => line.trim() === "" || /^[\w-]+:/.test(line))) return { meta: {}, rest: lines };
  const meta: Record<string, string> = {};
  for (const line of inner) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { meta, rest: lines.slice(end + 1) };
}

function splitSlides(lines: string[]): string[][] {
  const chunks: string[][] = [[]];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (!inFence && SEPARATOR.test(line)) chunks.push([]);
    else chunks[chunks.length - 1].push(line);
  }
  return chunks.filter((chunk) => chunk.some((line) => line.trim() !== ""));
}

const trimBlankLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  let inFence = false;
  return lines
    .slice(start, end)
    .map((line) => {
      if (FENCE.test(line)) inFence = !inFence;
      return inFence || FENCE.test(line) ? line : unescapeLine(line);
    })
    .join("\n");
};

function parseSlide(chunk: string[]): Slide {
  let layout: Layout | undefined;
  const style: { align?: Align; size?: TextSize } = {};
  let title = "";
  let image = "";
  let notes: string[] | undefined;
  const columns: string[][] = [[]];
  let inFence = false;
  let seenContent = false;

  for (const line of chunk) {
    if (FENCE.test(line)) inFence = !inFence;
    const fenced = inFence || FENCE.test(line);
    if (notes) {
      notes.push(line);
      continue;
    }
    if (!fenced) {
      const layoutMatch = LAYOUT_COMMENT.exec(line);
      if (layoutMatch) {
        const value = layoutMatch[1].toLowerCase();
        if (LAYOUTS.includes(value as Layout)) layout = value as Layout;
        for (const [, key, raw] of layoutMatch[2].matchAll(/([\w-]+)\s*:\s*([\w-]+)/g)) {
          const option = raw.toLowerCase();
          if (key.toLowerCase() === "align" && ALIGNS.includes(option as Align)) style.align = option as Align;
          if (key.toLowerCase() === "size" && SIZES.includes(option as TextSize)) style.size = option as TextSize;
        }
        continue;
      }
      if (COLUMN_COMMENT.test(line)) {
        columns.push([]);
        continue;
      }
      const notesMatch = NOTES.exec(line);
      if (notesMatch) {
        notes = notesMatch[1] ? [notesMatch[1]] : [];
        continue;
      }
      const heading = HEADING.exec(line);
      if (heading && !seenContent && !title) {
        title = heading[1];
        seenContent = true;
        continue;
      }
      const imageMatch = IMAGE.exec(line);
      if (imageMatch && !image) {
        image = imageMatch[1];
        continue;
      }
    }
    if (line.trim() !== "") seenContent = true;
    columns[columns.length - 1].push(line);
  }

  const body = trimBlankLines(columns[0]);
  // Extra column markers beyond the first fold into the right column.
  const body2 = trimBlankLines(columns.slice(1).flatMap((column, i) => (i === 0 ? column : ["", ...column])));
  if (!layout) {
    if (columns.length > 1) layout = "two-column";
    else if (image) layout = "image";
    else if (title && !body) layout = "title";
    else layout = "content";
  }
  return createSlide({ layout, title, body, body2, image, notes: notes ? trimBlankLines(notes) : "", ...style });
}

/** Build a deck from Markdown. `fallbackTitle` (e.g. the file name) is used when the file names no title. */
export function markdownToDeck(markdown: string, fallbackTitle = "Imported deck"): Deck {
  const lines = markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const { meta, rest } = readFrontMatter(lines);
  const slides = splitSlides(rest).map(parseSlide);
  const title = meta.title || slides.find((slide) => slide.title)?.title || fallbackTitle;
  const deck = createDeck(title, slides);
  if (THEMES.includes(meta.theme as Theme)) deck.theme = meta.theme as Theme;
  if (FONTS.includes(meta.font as Font)) deck.font = meta.font as Font;
  return deck;
}
