import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Spinner, useDocumentTitle } from "@freeappstore/sdk/ui";
import type { Navigate } from "../App";
import type { Deck } from "../deck";
import { loadDeck } from "../storage";
import { SlideView } from "./SlideView";
import { Button } from "./ui";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p"]);

/**
 * Loads a deck and tracks the current slide. The index is mirrored into
 * `?slide=` and shared with other windows of the same deck (presenter view
 * and audience window) over a BroadcastChannel.
 */
function useDeckNav(deckId: string, navigate: Navigate) {
  const [deck, setDeck] = useState<Deck | null | undefined>(undefined);
  const [index, setIndex] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get("slide") ?? 1) - 1));
  const channel = useRef<BroadcastChannel | null>(null);
  const count = deck?.slides.length ?? 0;
  const current = Math.min(index, Math.max(count - 1, 0));

  useEffect(() => {
    loadDeck(deckId).then(
      (loaded) => setDeck(loaded ?? null),
      () => setDeck(null),
    );
  }, [deckId]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(`slides:${deckId}`);
    bc.onmessage = (event: MessageEvent<{ index?: unknown }>) => {
      if (typeof event.data?.index === "number") setIndex(event.data.index);
    };
    channel.current = bc;
    return () => bc.close();
  }, [deckId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(current + 1));
    window.history.replaceState(null, "", url);
  }, [current]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), Math.max(count - 1, 0));
      setIndex(clamped);
      channel.current?.postMessage({ index: clamped });
    },
    [count],
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    navigate(`/deck/${deckId}?slide=${current + 1}`);
  }, [navigate, deckId, current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      // Let Enter/Space activate a focused button instead of advancing.
      if ((event.key === " " || event.key === "Enter") && event.target instanceof HTMLButtonElement) return;
      if (NEXT_KEYS.has(event.key)) go(current + 1);
      else if (PREV_KEYS.has(event.key)) go(current - 1);
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(count - 1);
      else if (event.key === "Escape") exit();
      else if (event.key === "f") toggleFullscreen();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exit, current, count]);

  return { deck, current, count, go, exit };
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

function Missing({ deck, navigate }: { deck: null | undefined; navigate: Navigate }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper p-6 text-ink">
      {deck === undefined ? (
        <span role="status" aria-label="Loading deck">
          <Spinner />
        </span>
      ) : (
        <>
          <p role="alert">This deck was not found on this device.</p>
          <Button onClick={() => navigate("/")}>All decks</Button>
        </>
      )}
    </div>
  );
}

/** Audience view: one slide, fullscreen. Keys, tap (left third goes back) and swipe navigate. */
export function Present({ deckId, navigate }: { deckId: string; navigate: Navigate }) {
  const { deck, current, count, go, exit } = useDeckNav(deckId, navigate);
  const start = useRef<{ x: number; y: number } | null>(null);
  useDocumentTitle(deck ? `${deck.title} — Slides` : "Slides");

  if (!deck) return <Missing deck={deck} navigate={navigate} />;

  const onPointerDown = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const from = start.current;
    start.current = null;
    if (!from || (event.target instanceof Element && event.target.closest("button, a"))) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(current + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) go(current + (event.clientX < window.innerWidth / 3 ? -1 : 1));
  };

  return (
    <main
      aria-label={`Presenting ${deck.title}`}
      className="fixed inset-0 flex touch-pan-y touch-pinch-zoom items-center justify-center bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (start.current = null)}
    >
      <div className="w-[min(100vw,calc(100dvh*16/9))]" aria-live="polite">
        <SlideView slide={deck.slides[current]} theme={deck.theme} font={deck.font} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 p-3 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100 pointer-coarse:opacity-80">
        <Button onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous slide">
          ←
        </Button>
        <span className="min-w-16 rounded-lg bg-paper px-3 py-2 text-center text-sm font-semibold text-ink">
          {current + 1} / {count}
        </span>
        <Button onClick={() => go(current + 1)} disabled={current === count - 1} aria-label="Next slide">
          →
        </Button>
        <Button onClick={toggleFullscreen}>Full screen</Button>
        <Button onClick={exit}>Exit</Button>
      </div>
    </main>
  );
}

function useElapsed() {
  const [started, setStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return { text, reset: () => setStarted(Date.now()) };
}

/** Presenter view: current and next slide, speaker notes and a timer. Can drive an audience window. */
export function Presenter({ deckId, navigate }: { deckId: string; navigate: Navigate }) {
  const { deck, current, count, go, exit } = useDeckNav(deckId, navigate);
  const elapsed = useElapsed();
  useDocumentTitle(deck ? `Presenter — ${deck.title}` : "Slides");

  if (!deck) return <Missing deck={deck} navigate={navigate} />;
  const slide = deck.slides[current];
  const next = deck.slides[current + 1];

  return (
    <main aria-label={`Presenter view for ${deck.title}`} className="flex min-h-dvh flex-col gap-4 bg-paper-deep p-3 text-ink sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={exit}>Exit</Button>
        <h1 className="order-first w-full min-w-0 truncate font-display text-lg font-bold sm:order-none sm:w-auto sm:flex-1">{deck.title}</h1>
        <span className="text-sm font-semibold" aria-live="polite">
          Slide {current + 1} of {count}
        </span>
        <span className="font-mono text-lg tabular-nums" aria-label={`Elapsed time ${elapsed.text}`}>
          {elapsed.text}
        </span>
        <Button variant="ghost" onClick={elapsed.reset}>
          Reset timer
        </Button>
        <Button
          variant="primary"
          onClick={() => window.open(`/deck/${deck.id}/present?slide=${current + 1}`, `slides-audience-${deck.id}`)}
        >
          Open audience window
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Current slide" className="flex min-w-0 flex-col gap-3">
          <SlideView slide={slide} theme={deck.theme} font={deck.font} className="rounded-lg shadow-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-14 text-base" onClick={() => go(current - 1)} disabled={current === 0}>
              ← Previous
            </Button>
            <Button variant="primary" className="min-h-14 text-base" onClick={() => go(current + 1)} disabled={current === count - 1}>
              Next →
            </Button>
          </div>
        </section>
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Next slide" className="flex flex-col gap-2">
            <h2 className="font-sans text-sm font-semibold text-muted">Next</h2>
            {next ? (
              <SlideView slide={next} theme={deck.theme} font={deck.font} className="max-w-sm rounded-md opacity-90" />
            ) : (
              <p className="text-muted">End of deck</p>
            )}
          </section>
          <section aria-label="Speaker notes" className="flex min-h-0 flex-1 flex-col gap-2">
            <h2 className="font-sans text-sm font-semibold text-muted">Notes</h2>
            <div className="flex-1 overflow-y-auto rounded-lg border border-line bg-paper p-4 text-lg leading-relaxed whitespace-pre-wrap">
              {slide.notes || <span className="text-muted">No notes for this slide.</span>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
