import { useEffect, useState } from "react";
import { initApp } from "@freeappstore/sdk";
import { useTheme } from "@freeappstore/sdk/hooks";
import { type NavItem, PageHeader, Shell } from "@freeappstore/sdk/ui";
import { useCloudSync } from "./cloudSync";
import { DeckList } from "./components/DeckList";
import { Editor } from "./components/Editor";
import { Present, Presenter } from "./components/Present";

// "slides" is replaced by the CLI scaffold or deployment flow with this app's id.
export const fas = initApp({ appId: "slides" });

const NAV: NavItem[] = [
  { label: "Decks", href: "/", title: "Slides" },
  { label: "About", href: "/about", title: "About — Slides" },
];

export type Navigate = (href: string, options?: { replace?: boolean }) => void;

type Route =
  | { screen: "list" }
  | { screen: "about" }
  | { screen: "edit" | "present" | "presenter"; deckId: string };

function parseRoute(path: string): Route {
  const match = /^\/deck\/([\w-]+)(?:\/(present|presenter))?\/?$/.exec(path);
  if (match) return { screen: match[2] === "present" ? "present" : match[2] === "presenter" ? "presenter" : "edit", deckId: match[1] };
  return path === "/about" ? { screen: "about" } : { screen: "list" };
}

export default function App() {
  useTheme(); // applies the shared light/dark preference on every screen, including present mode
  useCloudSync(fas); // signed in: decks sync with the account; signed out: device only
  const [path, setPath] = useState(() => window.location.pathname);

  // Keep the screen in step with the browser's back and forward buttons.
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate: Navigate = (href, options) => {
    if (options?.replace) window.history.replaceState(null, "", href);
    else window.history.pushState(null, "", href);
    setPath(window.location.pathname);
  };

  const route = parseRoute(path);

  // Presenting takes the whole screen, outside the app frame.
  if (route.screen === "present") return <Present deckId={route.deckId} navigate={navigate} />;
  if (route.screen === "presenter") return <Presenter deckId={route.deckId} navigate={navigate} />;

  return (
    <Shell app={fas} appName="Slides" nav={NAV} onNavigate={navigate}>
      {route.screen === "edit" ? (
        <Editor key={route.deckId} deckId={route.deckId} navigate={navigate} />
      ) : (
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">{route.screen === "about" ? <About /> : <DeckList navigate={navigate} />}</div>
      )}
    </Shell>
  );
}

function About() {
  return (
    <>
      <PageHeader title="About" />
      <div className="flex max-w-2xl flex-col gap-3 text-ink">
        <p>
          Slides is a free slide deck editor and presenter. Your decks are stored on this device, and the app works offline once it
          has loaded. Sign in to sync them to your account: they then also appear on your other devices, and an AI assistant connected
          to the FreeAppStore MCP server can make and edit decks for you. Decks with large embedded images are too big to sync and stay
          on the device.
        </p>
        <p>
          Write slides as Markdown (one slide per <code>---</code>), present them full screen, and use the presenter view for speaker
          notes and the next slide. Make a JSON backup to move decks to another device.
        </p>
        <p className="text-muted">
          Slides is a free app on <a className="text-accent underline" href="https://freeappstore.online">FreeAppStore</a>.
        </p>
      </div>
    </>
  );
}
