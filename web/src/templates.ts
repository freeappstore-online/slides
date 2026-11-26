// Starter decks for the "New deck" gallery. Each is real structure with
// prompts to replace, not filler text.

import { createDeck, createSlide, type Deck, type Font, type Slide, type Theme } from "./deck";

type SlideFields = Partial<Omit<Slide, "id">>;

export interface Template {
  id: string;
  name: string;
  description: string;
  theme: Theme;
  font: Font;
  slides: SlideFields[];
}

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "One title slide. Start from scratch.",
    theme: "paper",
    font: "classic",
    slides: [{ layout: "title", title: "Untitled deck", body: "Subtitle" }],
  },
  {
    id: "pitch",
    name: "Pitch",
    description: "Problem, solution, market, traction and the ask.",
    theme: "midnight",
    font: "display",
    slides: [
      { layout: "title", title: "Company name", body: "One sentence that says what you do", notes: "Say who you are and why you are here in under 20 seconds." },
      { layout: "content", title: "The problem", body: "- Who has this problem?\n- What does it cost them today?\n- Why hasn't it been solved yet?" },
      { layout: "content", title: "Our solution", body: "- What you built, in plain words\n- The one thing it does better than anything else\n- How a customer uses it" },
      { layout: "stat", title: "$4.2B", body: "Market size: how many buyers × what they pay. Show your working in the notes.", notes: "Bottom-up: number of customers × annual price." },
      { layout: "two-column", title: "Traction", body: "**So far**\n- Customers or users\n- Revenue or growth rate\n- Key partnerships", body2: "**Next 12 months**\n- Milestone one\n- Milestone two\n- Milestone three" },
      { layout: "content", title: "Business model", body: "- Who pays, and how much\n- How you reach them\n- Why the numbers work at scale" },
      { layout: "content", title: "Team", body: "- **Name** — role, the relevant thing they've done before\n- **Name** — role, the relevant thing they've done before\n- **Name** — role, the relevant thing they've done before" },
      { layout: "section", title: "The ask", body: "How much you're raising and what it gets you to", align: "center" },
      { layout: "title", title: "Thank you", body: "name@example.com" },
    ],
  },
  {
    id: "project-update",
    name: "Project update",
    description: "Status, progress, risks and next steps.",
    theme: "paper",
    font: "sans",
    slides: [
      { layout: "title", title: "Project name: update", body: "Date · Your name" },
      { layout: "content", title: "Summary", body: "- **Status:** on track / at risk / off track\n- One sentence on what changed since last time\n- One decision you need from this group" },
      { layout: "two-column", title: "Progress", body: "**Done**\n- Delivered item\n- Delivered item\n- Delivered item", body2: "**In progress**\n- Item — expected date\n- Item — expected date" },
      { layout: "stat", title: "72%", body: "Of planned scope delivered — replace with the metric that matters most" },
      { layout: "content", title: "Risks and blockers", body: "- Risk — impact — what we're doing about it\n- Blocker — who can unblock it" },
      { layout: "content", title: "Next steps", body: "- Action — owner — date\n- Action — owner — date\n- Action — owner — date" },
      { layout: "title", title: "Questions?", body: "" },
    ],
  },
  {
    id: "lesson",
    name: "Lesson",
    description: "Objectives, concepts, an example and a recap.",
    theme: "sky",
    font: "system",
    slides: [
      { layout: "title", title: "Lesson title", body: "Subject · Class or year" },
      { layout: "content", title: "Today you will", body: "- Learn what … means\n- Practise …\n- Be able to explain …" },
      { layout: "section", title: "Part 1: Key idea", body: "The one thing to remember from this part" },
      { layout: "content", title: "Key idea", body: "Explain the concept in two or three short sentences.\n\n- Important detail\n- Important detail" },
      { layout: "image-text", title: "Example", body: "Walk through one worked example step by step.\n\n- Step one\n- Step two\n- Step three", notes: "Add a picture or diagram on the left." },
      { layout: "quote", title: "", body: "Ask the class a question that makes them think.", body2: "Discussion" },
      { layout: "content", title: "Your turn", body: "- Exercise one\n- Exercise two\n- Challenge: a harder question" },
      { layout: "content", title: "Recap", body: "- First thing we learned\n- Second thing we learned\n- Homework or next lesson" },
    ],
  },
  {
    id: "workshop",
    name: "Workshop",
    description: "Agenda, warm-up, activities and wrap-up.",
    theme: "sunset",
    font: "display",
    slides: [
      { layout: "title", title: "Workshop title", body: "Date · Facilitator" },
      { layout: "content", title: "Agenda", body: "- 10 min — Welcome and warm-up\n- 30 min — Activity 1\n- 10 min — Break\n- 30 min — Activity 2\n- 10 min — Wrap-up" },
      { layout: "content", title: "Ground rules", body: "- Everyone contributes\n- Ideas first, judgement later\n- Phones away" },
      { layout: "section", title: "Warm-up", body: "5 minutes" },
      { layout: "content", title: "Activity 1", body: "**Goal:** what the group should produce\n\n- Step one\n- Step two\n- Share back: 2 minutes per group", size: "large" },
      { layout: "stat", title: "15 min", body: "Time for activity 1" },
      { layout: "content", title: "Activity 2", body: "**Goal:** what the group should produce\n\n- Step one\n- Step two\n- Share back", size: "large" },
      { layout: "two-column", title: "Wrap-up", body: "**What we decided**\n- Outcome\n- Outcome", body2: "**Who does what next**\n- Action — owner\n- Action — owner" },
      { layout: "title", title: "Thank you!", body: "Feedback: link or email" },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "About you, selected work and contact.",
    theme: "graphite",
    font: "serif",
    slides: [
      { layout: "title", title: "Your name", body: "What you do, in five words" },
      { layout: "image-text", title: "About me", body: "Two sentences about your background and what you care about.\n\n- Skill\n- Skill\n- Skill" },
      { layout: "section", title: "Selected work", body: "2020 – today" },
      { layout: "image-text", title: "Project one", body: "**Client or context**\n\nWhat the challenge was, what you did, and the result." },
      { layout: "image-text", title: "Project two", body: "**Client or context**\n\nWhat the challenge was, what you did, and the result." },
      { layout: "quote", title: "", body: "A short quote from a happy client or colleague.", body2: "Name, role" },
      { layout: "title", title: "Let's work together", body: "name@example.com · website.example" },
    ],
  },
  {
    id: "weekly-report",
    name: "Weekly report",
    description: "Highlights, numbers, issues and next week.",
    theme: "mint",
    font: "sans",
    slides: [
      { layout: "title", title: "Weekly report", body: "Week of … · Team name" },
      { layout: "content", title: "Highlights", body: "- Biggest win this week\n- Something shipped\n- Something learned" },
      { layout: "two-column", title: "Numbers", body: "**This week**\n- Metric: value\n- Metric: value\n- Metric: value", body2: "**Change from last week**\n- +x%\n- −y%\n- no change" },
      { layout: "content", title: "Issues", body: "- Issue — impact — next step\n- Issue — impact — next step" },
      { layout: "content", title: "Next week", body: "- Priority one\n- Priority two\n- Priority three" },
    ],
  },
  {
    id: "talk",
    name: "Talk",
    description: "A conference or meetup talk with a clear story.",
    theme: "plum",
    font: "classic",
    slides: [
      { layout: "title", title: "Talk title", body: "Your name · Event · Date" },
      { layout: "image-text", title: "Hi, I'm …", body: "- What you do\n- Where to find you" },
      { layout: "quote", title: "", body: "Open with a question, a surprising fact or a short story.", body2: "Hook" },
      { layout: "section", title: "1. The context", body: "Why this matters now" },
      { layout: "content", title: "What most people do today", body: "- The usual approach\n- Where it breaks down", size: "large" },
      { layout: "section", title: "2. A better way", body: "The idea of this talk" },
      { layout: "content", title: "How it works", body: "- Step one\n- Step two\n- Step three" },
      { layout: "stat", title: "10×", body: "The result, as one number" },
      { layout: "section", title: "3. What you can do tomorrow", body: "" },
      { layout: "content", title: "Takeaways", body: "- One\n- Two\n- Three", size: "large" },
      { layout: "title", title: "Thank you", body: "Slides and links: website.example" },
    ],
  },
];

/** A new deck from a template, with fresh ids. The blank template keeps the plain "Untitled deck". */
export function deckFromTemplate(template: Template, now = Date.now()): Deck {
  const title = template.id === "blank" ? "Untitled deck" : template.name;
  const deck = createDeck(title, template.slides.map((fields) => createSlide(fields)), now);
  return { ...deck, theme: template.theme, font: template.font };
}
