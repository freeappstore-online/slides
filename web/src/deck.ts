// Deck model and pure deck operations. Everything here is free of browser
// storage so it can be unit tested; storage.ts persists the results.

export const LAYOUTS = ["title", "content", "two-column", "image", "section", "quote", "stat", "image-text"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const LAYOUT_LABELS: Record<Layout, string> = {
  title: "Title",
  content: "Title + content",
  "two-column": "Two columns",
  image: "Image",
  section: "Section header",
  quote: "Quote",
  stat: "Big number",
  "image-text": "Image + text",
};

export const THEMES = [
  "paper",
  "contrast",
  "bold",
  "soft",
  "sky",
  "mint",
  "midnight",
  "graphite",
  "forest",
  "plum",
  "terminal",
  "sunset",
  "ocean",
  "lemon",
] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  paper: "Paper",
  contrast: "Contrast",
  bold: "Bold",
  soft: "Soft",
  sky: "Sky",
  mint: "Mint",
  midnight: "Midnight (dark)",
  graphite: "Graphite (dark)",
  forest: "Forest (dark)",
  plum: "Plum (dark)",
  terminal: "Terminal (dark)",
  sunset: "Sunset",
  ocean: "Ocean",
  lemon: "Lemon",
};

/**
 * Per-deck font pairing, from the brand fonts and system stacks only (see .slide-font-* in index.css).
 * "classic" is the original look and the default for decks without a font.
 */
export const FONTS = ["classic", "sans", "serif", "mono", "display", "system"] as const;
export type Font = (typeof FONTS)[number];

export const FONT_LABELS: Record<Font, string> = {
  classic: "Classic",
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
  display: "Display",
  system: "System",
};

export const ALIGNS = ["left", "center"] as const;
export type Align = (typeof ALIGNS)[number];

export const SIZES = ["small", "medium", "large"] as const;
export type TextSize = (typeof SIZES)[number];

export interface Slide {
  id: string;
  layout: Layout;
  title: string;
  /**
   * Main text. Lines starting with "- " or "* " are bullets. Subtitle on title and section slides,
   * caption on image slides, the quote on quote slides, the label under a big number.
   */
  body: string;
  /** Right column of a two-column slide; attribution on a quote slide. */
  body2: string;
  /** Image as a data: URL (kept inside the deck so backups are self-contained) or an https URL. */
  image: string;
  notes: string;
  /** Text alignment; missing means the layout's default. */
  align?: Align;
  /** Body text size; missing means medium. */
  size?: TextSize;
}

export interface Deck {
  id: string;
  title: string;
  theme: Theme;
  /** Missing on decks made before fonts existed: they use "classic". */
  font?: Font;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function createSlide(fields: Partial<Omit<Slide, "id">> = {}): Slide {
  return { layout: "content", title: "", body: "", body2: "", image: "", notes: "", ...fields, id: newId() };
}

export function createDeck(title = "Untitled deck", slides?: Slide[], now = Date.now()): Deck {
  return {
    id: newId(),
    title,
    theme: "paper",
    slides: slides && slides.length > 0 ? slides : [createSlide({ layout: "title", title, body: "Subtitle" })],
    createdAt: now,
    updatedAt: now,
  };
}

/** A copy with fresh deck and slide ids. */
export function duplicateDeck(deck: Deck, now = Date.now()): Deck {
  return {
    ...deck,
    id: newId(),
    title: `${deck.title} (copy)`,
    slides: deck.slides.map((slide) => ({ ...slide, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Insert a new slide after `index` (or at the end) and return the new deck and the inserted index. */
export function addSlide(deck: Deck, index = deck.slides.length - 1, slide = createSlide()): [Deck, number] {
  const at = Math.min(Math.max(index + 1, 0), deck.slides.length);
  const slides = [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)];
  return [{ ...deck, slides }, at];
}

export function duplicateSlide(deck: Deck, index: number): [Deck, number] {
  const source = deck.slides[index];
  if (!source) return [deck, index];
  return addSlide(deck, index, { ...source, id: newId() });
}

/** Remove a slide. A deck always keeps at least one slide. Returns the index to select next. */
export function deleteSlide(deck: Deck, index: number): [Deck, number] {
  if (deck.slides.length <= 1 || !deck.slides[index]) return [deck, index];
  const slides = deck.slides.filter((_, i) => i !== index);
  return [{ ...deck, slides }, Math.min(index, slides.length - 1)];
}

/** Move a slide from one position to another. Returns the slide's new index. */
export function moveSlide(deck: Deck, from: number, to: number): [Deck, number] {
  if (!deck.slides[from] || to < 0 || to >= deck.slides.length || from === to) return [deck, from];
  const slides = [...deck.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  return [{ ...deck, slides }, to];
}

export function updateSlide(deck: Deck, index: number, patch: Partial<Omit<Slide, "id">>): Deck {
  return { ...deck, slides: deck.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)) };
}

// Validation for data read from IndexedDB or a backup file.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function isSlide(value: unknown): value is Slide {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    LAYOUTS.includes(value.layout as Layout) &&
    ["title", "body", "body2", "image", "notes"].every((key) => typeof value[key] === "string") &&
    (value.align === undefined || ALIGNS.includes(value.align as Align)) &&
    (value.size === undefined || SIZES.includes(value.size as TextSize))
  );
}

export function isDeck(value: unknown): value is Deck {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    THEMES.includes(value.theme as Theme) &&
    (value.font === undefined || FONTS.includes(value.font as Font)) &&
    Array.isArray(value.slides) &&
    value.slides.length > 0 &&
    value.slides.every(isSlide) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}

// Decks written elsewhere (e.g. by an AI) may be minimal: missing ids,
// timestamps, optional text fields, theme or font. They are completed with
// defaults rather than dropped.

const text = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value) // a list of lines, e.g. bullets an AI sent as an array
      ? value
          .filter((line): line is string => typeof line === "string")
          .map((line) => (/^\s*[-*+]\s/.test(line) ? line : `- ${line}`))
          .join("\n")
      : "";

function normaliseSlide(value: Record<string, unknown>, seen: Set<string>): Slide {
  const image = text(value.image);
  const layout = LAYOUTS.includes(value.layout as Layout) ? (value.layout as Layout) : image ? "image" : "content";
  let id = typeof value.id === "string" && value.id ? value.id : newId();
  if (seen.has(id)) id = newId();
  seen.add(id);
  return {
    id,
    layout,
    title: text(value.title),
    body: text(value.body),
    body2: text(value.body2),
    image,
    notes: text(value.notes),
    ...(ALIGNS.includes(value.align as Align) ? { align: value.align as Align } : {}),
    ...(SIZES.includes(value.size as TextSize) ? { size: value.size as TextSize } : {}),
  };
}

/**
 * A complete, valid deck from a stored document, keeping what is usable.
 * Returns undefined only for something that is not an object at all.
 * `id` is the local deck id; `changedAt` is when the document last changed.
 */
export function normaliseDeck(value: unknown, id: string, changedAt: number, now = Date.now()): Deck | undefined {
  if (!isRecord(value) || Array.isArray(value)) return undefined;
  const title = text(value.title).trim() || "Untitled deck";
  const seen = new Set<string>();
  const slides = (Array.isArray(value.slides) ? value.slides : []).filter(isRecord).map((slide) => normaliseSlide(slide, seen));
  const createdAt = typeof value.createdAt === "number" ? value.createdAt : typeof value._createdAt === "number" ? value._createdAt : now;
  return {
    id,
    title,
    theme: THEMES.includes(value.theme as Theme) ? (value.theme as Theme) : "paper",
    ...(FONTS.includes(value.font as Font) ? { font: value.font as Font } : {}),
    slides: slides.length > 0 ? slides : [createSlide({ layout: "title", title })],
    createdAt,
    // An edit made elsewhere may not touch `updatedAt`; `changedAt` is when it last changed.
    updatedAt: Math.max(typeof value.updatedAt === "number" ? value.updatedAt : 0, changedAt),
  };
}

// JSON backup: every deck, images included.

export interface Backup {
  app: "slides";
  version: 1;
  exportedAt: string;
  decks: Deck[];
}

export function toBackup(decks: Deck[], now = new Date()): Backup {
  return { app: "slides", version: 1, exportedAt: now.toISOString(), decks };
}

/** Parse a backup file. Throws an Error with a user-facing message when the file is not a valid backup. */
export function parseBackup(text: string): Deck[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isRecord(data) || data.app !== "slides" || !Array.isArray(data.decks)) {
    throw new Error("This file is not a Slides backup.");
  }
  if (data.version !== 1) throw new Error("This backup was made by a newer version of Slides.");
  const decks = data.decks.filter(isDeck);
  if (decks.length !== data.decks.length) throw new Error("Some decks in this backup are damaged; nothing was restored.");
  return decks;
}
