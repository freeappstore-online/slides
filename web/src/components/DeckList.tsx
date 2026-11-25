import { type FormEvent, type RefObject, useCallback, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog, EmptyState, Modal, PageHeader, Spinner, useToast } from "@freeappstore/sdk/ui";
import type { Navigate } from "../App";
import { createDeck, duplicateDeck, parseBackup, toBackup, type Deck } from "../deck";
import { download } from "../files";
import { markdownToDeck } from "../markdown";
import { loadDecks, removeDeck, saveDecks } from "../storage";
import { SlideView } from "./SlideView";
import { Button, FOCUS, INPUT } from "./ui";

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export function DeckList({ navigate }: { navigate: Navigate }) {
  const toast = useToast();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [renaming, setRenaming] = useState<Deck | null>(null);
  const [deleting, setDeleting] = useState<Deck | null>(null);
  const markdownInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDecks(await loadDecks());
      setLoadError("");
    } catch (error) {
      setLoadError(message(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      toast.show(message(error), { variant: "error" });
    }
    await refresh();
  }

  const newDeck = () =>
    run(async () => {
      const deck = createDeck();
      await saveDecks(deck);
      navigate(`/deck/${deck.id}`);
    });

  const importMarkdown = (file: File) =>
    run(async () => {
      const deck = markdownToDeck(await file.text(), file.name.replace(/\.(md|markdown|txt)$/i, ""));
      await saveDecks(deck);
      toast.show(`Imported “${deck.title}” (${deck.slides.length} slides).`, { variant: "success" });
    });

  const restore = (file: File) =>
    run(async () => {
      const restored = parseBackup(await file.text());
      if (restored.length) await saveDecks(...restored);
      toast.show(`Restored ${restored.length} deck${restored.length === 1 ? "" : "s"}.`, { variant: "success" });
    });

  const backup = () => {
    if (!decks?.length) return;
    download(`slides-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toBackup(decks)), "application/json");
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={newDeck}>
        New deck
      </Button>
      <Button onClick={() => markdownInput.current?.click()}>Import Markdown</Button>
      <Button onClick={() => backupInput.current?.click()}>Restore backup</Button>
      <Button onClick={backup} disabled={!decks?.length}>
        Back up all
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader title="Your decks" description="Stored on this device only. Back up to move them elsewhere." actions={actions} />
      <FileInput inputRef={markdownInput} accept=".md,.markdown,.txt,text/markdown,text/plain" label="Import Markdown file" onFile={importMarkdown} />
      <FileInput inputRef={backupInput} accept=".json,application/json" label="Restore backup file" onFile={restore} />

      {loadError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-line bg-danger-soft p-4 text-ink">
          <p>{loadError}</p>
          <Button onClick={() => void refresh()}>Try again</Button>
        </div>
      ) : decks === null ? (
        <div className="flex justify-center p-10" role="status" aria-label="Loading decks">
          <Spinner />
        </div>
      ) : decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          message="Create a deck, or import a Markdown file with slides separated by ---."
          action={
            <Button variant="primary" onClick={newDeck}>
              New deck
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <li key={deck.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-panel">
              <a
                href={`/deck/${deck.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(`/deck/${deck.id}`);
                }}
                className={`block ${FOCUS}`}
                aria-label={`Open ${deck.title}`}
              >
                <SlideView slide={deck.slides[0]} theme={deck.theme} className="pointer-events-none" />
              </a>
              <div className="flex min-w-0 flex-col gap-1 p-3">
                <h2 className="truncate font-sans text-base font-bold text-ink">{deck.title}</h2>
                <p className="text-sm text-muted">
                  {deck.slides.length} slide{deck.slides.length === 1 ? "" : "s"} · edited {new Date(deck.updatedAt).toLocaleDateString()}
                </p>
                <div className="-ml-2 flex flex-wrap gap-1 pt-1">
                  <Button variant="ghost" onClick={() => setRenaming(deck)} aria-label={`Rename ${deck.title}`}>
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Duplicate ${deck.title}`}
                    onClick={() =>
                      run(async () => {
                        await saveDecks(duplicateDeck(deck));
                        toast.show("Deck duplicated.", { variant: "success" });
                      })
                    }
                  >
                    Duplicate
                  </Button>
                  <Button variant="ghost" className="text-danger" onClick={() => setDeleting(deck)} aria-label={`Delete ${deck.title}`}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {renaming && (
        <RenameDialog
          deck={renaming}
          onClose={() => setRenaming(null)}
          onSave={async (title) => {
            await saveDecks({ ...renaming, title, updatedAt: Date.now() });
            await refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete deck?"
        message={`“${deleting?.title ?? ""}” and its images will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const deck = deleting;
          setDeleting(null);
          if (deck) void run(() => removeDeck(deck.id));
        }}
      />
    </>
  );
}

function FileInput({
  inputRef,
  accept,
  label,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  label: string;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      aria-label={label}
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onFile(file);
      }}
    />
  );
}

function RenameDialog({ deck, onClose, onSave }: { deck: Deck; onClose: () => void; onSave: (title: string) => Promise<void> }) {
  const id = useId();
  const [title, setTitle] = useState(deck.title);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next) {
      setError("Enter a name.");
      return;
    }
    setPending(true);
    try {
      await onSave(next);
      onClose();
    } catch (failure) {
      setError(message(failure));
      setPending(false);
    }
  }

  return (
    <Modal open title="Rename deck" onClose={() => !pending && onClose()}>
      <form noValidate onSubmit={submit} className="flex min-w-0 flex-col gap-3">
        <label htmlFor={id} className="font-semibold text-ink">
          Name
        </label>
        <input
          id={id}
          data-autofocus
          value={title}
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            setError("");
          }}
          className={INPUT}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
