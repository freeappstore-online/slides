import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog, EmptyState, Spinner, useDocumentTitle, useToast } from "@freeappstore/sdk/ui";
import type { Navigate } from "../App";
import {
  addSlide,
  ALIGNS,
  deleteSlide,
  duplicateSlide,
  FONT_LABELS,
  FONTS,
  LAYOUT_LABELS,
  LAYOUTS,
  moveSlide,
  SIZES,
  THEME_LABELS,
  THEMES,
  toBackup,
  updateSlide,
  type Align,
  type Deck,
  type Font,
  type Layout,
  type Slide,
  type TextSize,
  type Theme,
} from "../deck";
import { download, fileStem, imageToDataUrl } from "../files";
import { deckToMarkdown } from "../markdown";
import { pwa } from "../pwa";
import { loadDeck, saveDecks } from "../storage";
import { SlideView } from "./SlideView";
import { Button, FOCUS, Field, INPUT, SELECT } from "./ui";

type SaveState = "saved" | "saving" | "error";

/** Debounced autosave. Unsaved changes block PWA updates and are flushed when the editor closes. */
function useAutosave(onError: (message: string) => void) {
  const pending = useRef<Deck | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = useState<SaveState>("saved");

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const deck = pending.current;
    if (!deck) return;
    pending.current = null;
    saveDecks(deck).then(
      () => setState((current) => (pending.current ? current : "saved")),
      (error: unknown) => {
        setState("error");
        onError(error instanceof Error ? error.message : "Could not save.");
      },
    );
  }, [onError]);

  const schedule = useCallback(
    (deck: Deck) => {
      pending.current = deck;
      setState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 400);
    },
    [flush],
  );

  useEffect(() => {
    const removeGuard = pwa.addBusyGuard(() => pending.current !== null);
    window.addEventListener("pagehide", flush);
    return () => {
      removeGuard();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { state, schedule, flush };
}

export function Editor({ deckId, navigate }: { deckId: string; navigate: Navigate }) {
  const toast = useToast();
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [index, setIndex] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get("slide") ?? 1) - 1));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showError = useCallback((text: string) => toast.show(text, { variant: "error" }), [toast]);
  const save = useAutosave(showError);
  const ids = useId();
  // Latest deck and selection, for async work (image import) that finishes after later edits.
  const latest = useRef({ deck, index });
  latest.current = { deck, index };
  useDocumentTitle(deck ? `${deck.title} — Slides` : "Slides");

  useEffect(() => {
    loadDeck(deckId).then(
      (loaded) => setDeck(loaded ?? null),
      (error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not open this deck."),
    );
  }, [deckId]);

  if (loadError) return <Centered><p role="alert" className="text-danger">{loadError}</p></Centered>;
  if (deck === undefined)
    return (
      <Centered>
        <span role="status" aria-label="Loading deck">
          <Spinner />
        </span>
      </Centered>
    );
  if (deck === null)
    return (
      <Centered>
        <EmptyState
          title="Deck not found"
          message="It may have been deleted, or it was made on another device."
          action={<Button onClick={() => navigate("/")}>All decks</Button>}
        />
      </Centered>
    );

  const current = Math.min(index, deck.slides.length - 1);
  const slide = deck.slides[current];

  const change = (next: Deck, nextIndex = current) => {
    const stamped = { ...next, updatedAt: Date.now() };
    setDeck(stamped);
    setIndex(nextIndex);
    save.schedule(stamped);
  };
  const apply = ([next, nextIndex]: [Deck, number]) => change(next, nextIndex);
  const edit = (patch: Partial<Omit<Slide, "id">>) => change(updateSlide(deck, current, patch));

  const present = (mode: "present" | "presenter") => {
    save.flush();
    if (mode === "present") document.documentElement.requestFullscreen?.().catch(() => undefined);
    navigate(`/deck/${deck.id}/${mode}?slide=${current + 1}`);
  };

  const pickImage = async (file: File) => {
    const slideId = slide.id;
    try {
      const image = await imageToDataUrl(file);
      const { deck: now, index: nowIndex } = latest.current;
      const at = now?.slides.findIndex((item) => item.id === slideId) ?? -1;
      if (now && at >= 0) change(updateSlide(now, at, { image }), nowIndex);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not add this image.");
    }
  };

  const bodyLabel: Record<Layout, string> = {
    title: "Subtitle",
    content: "Content",
    "two-column": "Left column",
    image: "Caption",
    section: "Subtitle",
    quote: "Quote",
    stat: "What the number means",
    "image-text": "Text",
  };
  const titleLabel: Partial<Record<Layout, string>> = { stat: "Number", quote: "Heading (optional)" };
  const shortBody = ["title", "image", "section", "quote", "stat"].includes(slide.layout);
  // Alignment and text size only where the layout does not fix them.
  const styled = ["content", "two-column", "section", "image-text"].includes(slide.layout);
  const hasImage = slide.layout === "image" || slide.layout === "image-text";

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 p-3 sm:p-6">
      {/* Deck toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          className={`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-accent ${FOCUS}`}
        >
          ← All decks
        </a>
        <div className="min-w-48 flex-1">
          <label htmlFor={`${ids}-title`} className="sr-only">
            Deck title
          </label>
          <input
            id={`${ids}-title`}
            value={deck.title}
            onChange={(event) => change({ ...deck, title: event.target.value })}
            onBlur={() => !deck.title.trim() && change({ ...deck, title: "Untitled deck" })}
            className={`${INPUT} font-display text-xl font-bold`}
          />
        </div>
        <p role="status" className="min-h-11 content-center text-sm text-muted">
          {save.state === "saving" ? "Saving…" : save.state === "error" ? <span className="text-danger">Not saved</span> : "Saved on this device"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => present("present")}>
          ▶ Present
        </Button>
        <Button onClick={() => present("presenter")}>Presenter view</Button>
        <label htmlFor={`${ids}-theme`} className="ml-auto text-sm font-semibold text-ink">
          Theme
        </label>
        <select
          id={`${ids}-theme`}
          value={deck.theme}
          onChange={(event) => change({ ...deck, theme: event.target.value as Theme })}
          className={SELECT}
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </option>
          ))}
        </select>
        <label htmlFor={`${ids}-font`} className="text-sm font-semibold text-ink">
          Font
        </label>
        <select
          id={`${ids}-font`}
          value={deck.font ?? "classic"}
          onChange={(event) => change({ ...deck, font: event.target.value as Font })}
          className={SELECT}
        >
          {FONTS.map((font) => (
            <option key={font} value={font}>
              {FONT_LABELS[font]}
            </option>
          ))}
        </select>
        <Button onClick={() => download(`${fileStem(deck.title)}.md`, deckToMarkdown(deck), "text/markdown")}>Export Markdown</Button>
        <Button onClick={() => download(`${fileStem(deck.title)}.json`, JSON.stringify(toBackup([deck])), "application/json")}>
          Export JSON
        </Button>
        <Button onClick={() => window.print()}>Print / PDF</Button>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Slide list: a horizontal strip on phones, a column on wide screens */}
        <nav aria-label="Slides" className="min-w-0">
          <ol className="flex gap-2 overflow-x-auto pb-2 lg:max-h-[calc(100dvh-12rem)] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pr-1">
            {deck.slides.map((item, i) => (
              <li key={item.id} className="flex shrink-0 items-start gap-1.5">
                <span className="w-5 pt-1 text-right text-xs text-muted" aria-hidden="true">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === current ? "true" : undefined}
                  aria-label={`Slide ${i + 1}${item.title ? `: ${item.title}` : ""}`}
                  className={`w-32 overflow-hidden rounded-md lg:w-full ${FOCUS} ${i === current ? "ring-2 ring-accent ring-offset-2 ring-offset-paper" : "opacity-90 hover:opacity-100"}`}
                >
                  <SlideView slide={item} theme={deck.theme} font={deck.font} className="pointer-events-none" />
                </button>
              </li>
            ))}
          </ol>
          <Button className="mt-2 w-full" onClick={() => apply(addSlide(deck, current))}>
            + Add slide
          </Button>
        </nav>

        {/* Current slide */}
        <section aria-label={`Slide ${current + 1} of ${deck.slides.length}`} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${ids}-layout`} className="text-sm font-semibold text-ink">
              Layout
            </label>
            <select
              id={`${ids}-layout`}
              value={slide.layout}
              onChange={(event) => edit({ layout: event.target.value as Layout })}
              className={SELECT}
            >
              {LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>
                  {LAYOUT_LABELS[layout]}
                </option>
              ))}
            </select>
            {styled && (
              <>
                <label htmlFor={`${ids}-align`} className="text-sm font-semibold text-ink">
                  Align
                </label>
                <select
                  id={`${ids}-align`}
                  value={slide.align ?? "left"}
                  onChange={(event) => edit({ align: event.target.value as Align })}
                  className={SELECT}
                >
                  {ALIGNS.map((align) => (
                    <option key={align} value={align}>
                      {align === "left" ? "Left" : "Centre"}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${ids}-size`} className="text-sm font-semibold text-ink">
                  Text size
                </label>
                <select
                  id={`${ids}-size`}
                  value={slide.size ?? "medium"}
                  onChange={(event) => edit({ size: event.target.value as TextSize })}
                  className={SELECT}
                >
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size[0].toUpperCase() + size.slice(1)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="flex flex-wrap gap-1 sm:ml-auto">
              <Button variant="ghost" disabled={current === 0} onClick={() => apply(moveSlide(deck, current, current - 1))} aria-label="Move slide up">
                ↑ Up
              </Button>
              <Button
                variant="ghost"
                disabled={current === deck.slides.length - 1}
                onClick={() => apply(moveSlide(deck, current, current + 1))}
                aria-label="Move slide down"
              >
                ↓ Down
              </Button>
              <Button variant="ghost" onClick={() => apply(duplicateSlide(deck, current))}>
                Duplicate
              </Button>
              <Button variant="ghost" className="text-danger" disabled={deck.slides.length === 1} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </div>
          </div>

          <SlideView slide={slide} theme={deck.theme} font={deck.font} className="mx-auto max-w-3xl rounded-lg shadow-sm" />

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <Field label={titleLabel[slide.layout] ?? "Title"} htmlFor={`${ids}-slide-title`}>
                <input id={`${ids}-slide-title`} value={slide.title} onChange={(event) => edit({ title: event.target.value })} className={INPUT} />
              </Field>
              <Field
                label={bodyLabel[slide.layout]}
                htmlFor={`${ids}-body`}
                hint={slide.layout === "image" || slide.layout === "stat" ? undefined : "Start a line with - for a bullet; indent two spaces to nest. **bold**, *italic*, `code`."}
              >
                <textarea
                  id={`${ids}-body`}
                  value={slide.body}
                  rows={shortBody ? 3 : 7}
                  onChange={(event) => edit({ body: event.target.value })}
                  className={`${INPUT} font-mono text-sm`}
                />
              </Field>
              {slide.layout === "two-column" && (
                <Field label="Right column" htmlFor={`${ids}-body2`}>
                  <textarea
                    id={`${ids}-body2`}
                    value={slide.body2}
                    rows={7}
                    onChange={(event) => edit({ body2: event.target.value })}
                    className={`${INPUT} font-mono text-sm`}
                  />
                </Field>
              )}
              {slide.layout === "quote" && (
                <Field label="Attribution" htmlFor={`${ids}-body2`}>
                  <input id={`${ids}-body2`} value={slide.body2} onChange={(event) => edit({ body2: event.target.value })} className={INPUT} />
                </Field>
              )}
              {hasImage && <ImagePicker hasImage={Boolean(slide.image)} onPick={pickImage} onRemove={() => edit({ image: "" })} />}
            </div>
            <Field label="Speaker notes" htmlFor={`${ids}-notes`} hint="Shown in the presenter view, never on the slide.">
              <textarea
                id={`${ids}-notes`}
                value={slide.notes}
                rows={8}
                onChange={(event) => edit({ notes: event.target.value })}
                className={`${INPUT} text-sm`}
              />
            </Field>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete slide?"
        message={`Slide ${current + 1}${slide.title ? ` (“${slide.title}”)` : ""} will be removed.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          apply(deleteSlide(deck, current));
        }}
      />
      <PrintDeck deck={deck} />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-10">{children}</div>;
}

function ImagePicker({ hasImage, onPick, onRemove }: { hasImage: boolean; onPick: (file: File) => void; onRemove: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="Slide image file"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
      <Button onClick={() => input.current?.click()}>{hasImage ? "Replace image" : "Choose image"}</Button>
      {hasImage && (
        <Button variant="ghost" className="text-danger" onClick={onRemove}>
          Remove image
        </Button>
      )}
      <p className="w-full text-xs text-muted">Images are kept on this device, inside the deck.</p>
    </div>
  );
}

/** Every slide, one per printed page. Hidden on screen; the app itself is hidden when printing. */
function PrintDeck({ deck }: { deck: Deck }) {
  return createPortal(
    <div className="hidden print:block">
      {deck.slides.map((slide) => (
        <div key={slide.id} className="break-after-page">
          <SlideView slide={slide} theme={deck.theme} font={deck.font} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
