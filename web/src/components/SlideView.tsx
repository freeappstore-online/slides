import { type CSSProperties, Fragment } from "react";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/bricolage-grotesque/latin-400.css";
import "@fontsource/bricolage-grotesque/latin-800.css";
import type { Font, Slide, TextSize, Theme } from "../deck";
import { parseBody, parseInline } from "../markdown";

// The first six themes are built only from the FAS brand tokens, so they follow
// the light/dark app theme. The others have fixed colours and look the same in both.
const THEME_CLASSES: Record<Theme, { slide: string; rule: string; accent: string }> = {
  paper: { slide: "bg-paper text-ink border border-line", rule: "bg-accent", accent: "text-accent" },
  contrast: { slide: "bg-ink text-paper", rule: "bg-accent", accent: "text-accent" },
  bold: { slide: "bg-accent text-paper", rule: "bg-paper", accent: "text-paper" },
  soft: { slide: "bg-accent-soft text-accent-deep", rule: "bg-accent", accent: "text-accent" },
  sky: { slide: "bg-sky-soft text-sky-deep", rule: "bg-sky", accent: "text-sky" },
  mint: { slide: "bg-mint-soft text-mint-deep", rule: "bg-mint", accent: "text-mint" },
  midnight: { slide: "bg-[#0b1026] text-[#e6e9f5]", rule: "bg-[#f5c451]", accent: "text-[#f5c451]" },
  graphite: { slide: "bg-[#1f2328] text-[#e6e6e6]", rule: "bg-[#2dd4bf]", accent: "text-[#2dd4bf]" },
  forest: { slide: "bg-[#12261c] text-[#f1ead8]", rule: "bg-[#d9a441]", accent: "text-[#e7b75a]" },
  plum: { slide: "bg-[#2a1033] text-[#f6e8fb]", rule: "bg-[#f472b6]", accent: "text-[#f9a8d4]" },
  terminal: { slide: "bg-[#050805] text-[#b7f7c3]", rule: "bg-[#22c55e]", accent: "text-[#4ade80]" },
  sunset: { slide: "bg-linear-to-br from-[#f97316] via-[#e11d48] to-[#7c3aed] text-white", rule: "bg-white", accent: "text-[#fde68a]" },
  ocean: { slide: "bg-linear-to-br from-[#0c4a6e] to-[#0f766e] text-[#ecfeff]", rule: "bg-[#5eead4]", accent: "text-[#5eead4]" },
  lemon: { slide: "bg-[#fde047] text-[#1c1917]", rule: "bg-[#1c1917]", accent: "text-[#1c1917]" },
};

export const THEME_SWATCH: Record<Theme, string> = Object.fromEntries(
  Object.entries(THEME_CLASSES).map(([theme, classes]) => [theme, classes.slide]),
) as Record<Theme, string>;

// Heading and body font stacks. Nunito and Bricolage Grotesque are bundled with
// the app (and precached), the rest are system fonts, so every pairing works offline.
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_STACKS: Record<Font, { heading: string; body: string }> = {
  classic: { heading: "var(--font-display)", body: "inherit" },
  sans: { heading: SANS, body: SANS },
  serif: {
    heading: '"Iowan Old Style", "Palatino Linotype", Palatino, Charter, "Bitstream Charter", Georgia, serif',
    body: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
  },
  rounded: { heading: '"Nunito", ui-rounded, "Arial Rounded MT", sans-serif', body: '"Nunito", ui-rounded, sans-serif' },
  mono: {
    heading: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    body: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },
  display: { heading: '"Bricolage Grotesque", Impact, sans-serif', body: `"Bricolage Grotesque", ${SANS}` },
};

const SIZE_SCALE: Record<TextSize, string> = { small: "0.8em", medium: "1em", large: "1.25em" };

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

const TITLE_SIZES = { xl: "text-[7.6cqw]", lg: "text-[6.4cqw]", md: "text-[4.4cqw]" };

function Title({ text, size, className = "" }: { text: string; size: keyof typeof TITLE_SIZES; className?: string }) {
  if (!text) return null;
  return (
    <h2 className={`leading-tight font-bold ${TITLE_SIZES[size]} ${className}`} style={{ fontFamily: "var(--slide-heading)" }}>
      <InlineText text={text} />
    </h2>
  );
}

export interface SlideViewProps {
  slide: Slide;
  theme: Theme;
  font?: Font;
  className?: string;
}

/** One slide at 16:9. All sizes are relative to the slide width, so it scales from thumbnail to fullscreen. */
export function SlideView({ slide, theme, font = "classic", className = "" }: SlideViewProps) {
  const classes = THEME_CLASSES[theme];
  const stack = FONT_STACKS[font];
  const centered = slide.align === "center";
  const align = centered ? "items-center text-center" : "";
  const bodyStyle = { fontSize: SIZE_SCALE[slide.size ?? "medium"] };
  const rule = (width: string) => <div className={`h-[0.45cqw] ${width} shrink-0 rounded-full ${classes.rule}`} />;
  const header = slide.title && (
    <div className={`flex flex-col gap-[1.4cqw] ${align}`}>
      <Title text={slide.title} size="md" />
      {rule("w-[8cqw]")}
    </div>
  );

  let content;
  switch (slide.layout) {
    case "title":
      content = (
        <div className="flex h-full flex-col items-center justify-center gap-[2.4cqw] px-[8cqw] text-center">
          <Title text={slide.title} size="lg" />
          {slide.title && rule("w-[10cqw]")}
          <Body text={slide.body} className="items-center text-[3.2cqw] opacity-85" />
        </div>
      );
      break;
    case "section":
      content = (
        <div className={`flex h-full flex-col justify-center gap-[2.4cqw] px-[8cqw] ${align}`}>
          {rule("w-[14cqw]")}
          <Title text={slide.title} size="xl" />
          {slide.body && <Body text={slide.body} className={`text-[3cqw] opacity-80 ${align}`} />}
        </div>
      );
      break;
    case "quote":
      content = (
        <div className="flex h-full flex-col items-center justify-center gap-[2.4cqw] px-[10cqw] text-center">
          <span aria-hidden="true" className={`h-[6cqw] text-[14cqw] leading-none font-bold ${classes.accent}`} style={{ fontFamily: "Georgia, serif" }}>
            “
          </span>
          <div className="text-[3.8cqw] leading-snug italic" style={{ fontFamily: "var(--slide-heading)" }}>
            <div style={bodyStyle}>
              <Body text={slide.body} className="items-center" />
            </div>
          </div>
          {slide.body2 && <p className="text-[2.4cqw] opacity-80">— {slide.body2}</p>}
          {slide.title && <p className="text-[2cqw] tracking-wide uppercase opacity-60">{slide.title}</p>}
        </div>
      );
      break;
    case "stat":
      content = (
        <div className="flex h-full flex-col items-center justify-center gap-[1.6cqw] px-[8cqw] text-center">
          <p className={`text-[16cqw] leading-none font-extrabold tracking-tight ${classes.accent}`} style={{ fontFamily: "var(--slide-heading)" }}>
            {slide.title}
          </p>
          <Body text={slide.body} className="max-w-[70cqw] items-center text-[3.2cqw]" />
        </div>
      );
      break;
    case "image-text":
      content = (
        <div className="grid h-full grid-cols-2 items-center gap-[5cqw] p-[6cqw]">
          <SlideImage slide={slide} />
          <div className={`flex min-w-0 flex-col gap-[2.4cqw] ${align}`}>
            {header}
            <div style={bodyStyle}>
              <Body text={slide.body} className={align} />
            </div>
          </div>
        </div>
      );
      break;
    default:
      content = (
        <div className="flex h-full flex-col gap-[2.4cqw] p-[6cqw] pb-[4.5cqw]">
          {header}
          {slide.layout === "content" && (
            <div style={bodyStyle}>
              <Body text={slide.body} className={align} />
            </div>
          )}
          {slide.layout === "two-column" && (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-[5cqw]" style={bodyStyle}>
              <Body text={slide.body} className={align} />
              <Body text={slide.body2} className={align} />
            </div>
          )}
          {slide.layout === "image" && (
            <>
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <SlideImage slide={slide} />
              </div>
              {slide.body && <Body text={slide.body} className="items-center text-center text-[2.2cqw] opacity-85" />}
            </>
          )}
        </div>
      );
  }

  return (
    <div
      className={`@container aspect-video w-full overflow-hidden text-left ${classes.slide} ${className}`}
      style={{ fontFamily: stack.body, "--slide-heading": stack.heading } as CSSProperties}
    >
      <div className="flex h-full w-full flex-col overflow-hidden text-[2.6cqw] leading-snug">{content}</div>
    </div>
  );
}

function SlideImage({ slide }: { slide: Slide }) {
  return slide.image ? (
    <img src={slide.image} alt={slide.body || slide.title || "Slide image"} className="h-full max-h-full w-full object-contain" />
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-current opacity-40">
      No image
    </div>
  );
}
