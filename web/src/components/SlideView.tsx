import { Fragment } from "react";
import type { Slide, Theme } from "../deck";
import { parseBody, parseInline } from "../markdown";

// Slide themes are built only from the FAS brand tokens, so each one follows
// the light/dark app theme automatically.
const THEME_CLASSES: Record<Theme, { slide: string; rule: string }> = {
  paper: { slide: "bg-paper text-ink border border-line", rule: "bg-accent" },
  contrast: { slide: "bg-ink text-paper", rule: "bg-accent" },
  bold: { slide: "bg-accent text-paper", rule: "bg-paper" },
  soft: { slide: "bg-accent-soft text-accent-deep", rule: "bg-accent" },
  sky: { slide: "bg-sky-soft text-sky-deep", rule: "bg-sky" },
  mint: { slide: "bg-mint-soft text-mint-deep", rule: "bg-mint" },
};

export const THEME_SWATCH: Record<Theme, string> = Object.fromEntries(
  Object.entries(THEME_CLASSES).map(([theme, classes]) => [theme, classes.slide]),
) as Record<Theme, string>;

const DEPTH = ["", "ml-[3cqw] text-[0.9em]", "ml-[6cqw] text-[0.85em]", "ml-[9cqw] text-[0.8em]"];

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.code ? (
          <code key={i} className="rounded bg-current/10 px-[0.3em] font-mono text-[0.9em]">
            {part.text}
          </code>
        ) : part.bold ? (
          <strong key={i}>{part.text}</strong>
        ) : part.italic ? (
          <em key={i}>{part.text}</em>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function Body({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-[1.4cqw] ${className}`}>
      {parseBody(text).map((block, i) =>
        block.type === "list" ? (
          <ul key={i} className="flex list-disc flex-col gap-[0.8cqw] pl-[1.2em]">
            {block.items.map((item, j) => (
              <li key={j} className={DEPTH[item.depth]}>
                <InlineText text={item.text} />
              </li>
            ))}
          </ul>
        ) : block.type === "code" ? (
          <pre key={i} className="overflow-hidden rounded-[0.6cqw] bg-current/10 p-[1.2cqw] font-mono text-[0.75em] whitespace-pre-wrap">
            {block.text}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-line">
            <InlineText text={block.text} />
          </p>
        ),
      )}
    </div>
  );
}

function Title({ text, size }: { text: string; size: "lg" | "md" }) {
  if (!text) return null;
  return (
    <h2 className={`font-display leading-tight font-bold ${size === "lg" ? "text-[6.4cqw]" : "text-[4.4cqw]"}`}>
      <InlineText text={text} />
    </h2>
  );
}

export interface SlideViewProps {
  slide: Slide;
  theme: Theme;
  className?: string;
}

/** One slide at 16:9. All sizes are relative to the slide width, so it scales from thumbnail to fullscreen. */
export function SlideView({ slide, theme, className = "" }: SlideViewProps) {
  const classes = THEME_CLASSES[theme];
  return (
    <div className={`@container aspect-video w-full overflow-hidden text-left ${classes.slide} ${className}`}>
      <div className="flex h-full w-full flex-col overflow-hidden text-[2.6cqw] leading-snug">
        {slide.layout === "title" ? (
          <div className="flex h-full flex-col items-center justify-center gap-[2.4cqw] px-[8cqw] text-center">
            <Title text={slide.title} size="lg" />
            {slide.title && <div className={`h-[0.5cqw] w-[10cqw] rounded-full ${classes.rule}`} />}
            <Body text={slide.body} className="items-center text-[3.2cqw] opacity-85" />
          </div>
        ) : (
          <div className="flex h-full flex-col gap-[2.4cqw] p-[6cqw] pb-[4.5cqw]">
            {slide.title && (
              <div className="flex flex-col gap-[1.4cqw]">
                <Title text={slide.title} size="md" />
                <div className={`h-[0.45cqw] w-[8cqw] rounded-full ${classes.rule}`} />
              </div>
            )}
            {slide.layout === "content" && <Body text={slide.body} />}
            {slide.layout === "two-column" && (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-[5cqw]">
                <Body text={slide.body} />
                <Body text={slide.body2} />
              </div>
            )}
            {slide.layout === "image" && (
              <>
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  {slide.image ? (
                    <img src={slide.image} alt={slide.body || slide.title || "Slide image"} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-current opacity-40">
                      No image
                    </div>
                  )}
                </div>
                {slide.body && <Body text={slide.body} className="items-center text-center text-[2.2cqw] opacity-85" />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
