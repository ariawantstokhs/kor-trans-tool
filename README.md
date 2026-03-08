# TransLucent – Proficiency-Differentiated Translation Support Tool

TransLucent is a translation support system that differentiates its
interface based on the user's language proficiency level. Rather than
providing a one-size-fits-all translation, it offers different
verification and exploration tools depending on whether the user can
read the target language — enabling informed decisions about translation
quality at every proficiency level.

Currently implemented for English → Korean professional email
translation as a research prototype.

## Core Concept

Existing translation tools provide **output without support** — users
get a translation but no help evaluating whether it's appropriate.
TransLucent addresses this by offering proficiency-differentiated tools
that let users verify translations themselves, without relying on the
AI to judge its own output.

### Proficiency Levels

| Level | Definition | Agency Model |
|-------|-----------|--------------| 
| **Low** | Cannot independently read or verify target language text | System provides reference frames; user cross-checks |
| **Mid**  | Partially understands target text, can sense issues but can't resolve them | User leads; system responds on demand |

### Feature Matrix (2 × 3)

| Feature | Low | Mid |
|---------|-----|-----|
| **Back-translation** | Always visible — inline per sentence with Korean | On-demand — toggle per sentence via ↩ button |
| **Norm Alignment** | Inline per sentence — explains Korean conventions used | Same data available |
| **Follow-up Q&A** | On-demand — tap a sentence, ask free-text questions in right panel | OFF |
| **Contextual Exploration** | OFF | On-demand — select any Korean text to drill down |

## User Flow

### Onboarding

A 2-step setup survey determines the user's proficiency level:

1. **TOPIK score** — if the user has one, they select their level (1–6); TOPIK 3+ → Mid, TOPIK 1–2 → Low.
2. **Self-assessed reading ability** — if no TOPIK, the user picks from 4 descriptions of their Korean reading comfort (2 map to Low, 2 to Mid).

After setup, the tool launches with the appropriate feature set. A **DEV toggle** in the header allows switching between Low and Mid at any time for testing.

### Low Mode

A **split-panel layout** designed for users who cannot read Korean:

**Left panel — Translation output:**
- Each sentence is displayed as a tappable row containing:
  - **Korean text** (the translated sentence)
  - **Back-translation** (English re-translation, always visible)
  - **Norm alignment** (optional inline note explaining the Korean convention used)
- A **review checkbox** beside each sentence lets the user mark segments as reviewed
- A **readiness bar** at the bottom tracks progress (e.g. "Reviewed 3 of 5 segments") and shows a "Ready to send" button once all segments are checked

**Right panel — Follow-up Q&A:**
- Tapping a sentence on the left selects it and opens the right panel
- A header shows "Asking about" + the back-translation of the selected sentence, giving context
- The user types free-text questions (e.g. "Is this too formal?", "Would a Korean reader find this rude?")
- The LLM answers in 2–3 sentences based on the segment's context (Call 2), without judging the translation
- Multiple Q&A pairs accumulate, most recent first

### Mid Mode

A **split-panel layout** designed for users who can partially read Korean:

**Left panel — Korean translation:**
- Each sentence is displayed with the Korean text and a **↩ toggle button** to reveal/hide its back-translation on demand
- The Korean text is **selectable** — the user highlights any word or phrase, and a floating "Explore ▸" popup appears
- Review checkboxes and readiness bar work the same as Low mode

**Right panel — Contextual Exploration:**
- When the user selects a phrase and clicks "Explore ▸", the right panel opens with a 3-layer drill-down:
  - **Back-translation** (always shown) — the full sentence back-translation for context
  - **See alternatives** (expandable) — 2–3 alternative expressions with formality level, nuance differences, and a "Use this ↵" button to swap the phrase into the translation
  - **See grammar pattern** (expandable) — reusable grammar patterns extracted from the expression, with descriptions and examples
  - **See cultural context** (expandable) — expression-specific cultural/social norms
- The selected phrase is highlighted in the left panel for visual reference
- Exploration data is fetched on-demand (Call 3) only when first expanded

## LLM Pipeline

Three-call architecture with split responsibilities:

1. **Call 1 — Translation** (`translateText`): Translates the full email, generates sentence segments with token-level data (romanization, meaning, part-of-speech), back-translations, communicative function labels, norm alignment notes, and original English mapping. The LLM infers communicative context (recipient type, formality level, social relationship) from the email content itself.

2. **Call 2 — Low Follow-Up Q&A** (`fetchLowFollowUp`): Fetched on-demand when the Low-mode user asks a question about a specific sentence. Receives the segment's original English, Korean, back-translation, and norm alignment as context. Returns a 2–3 sentence answer in plain English without evaluating the translation.

3. **Call 3 — Exploration** (`fetchExploration`, Mid only): Fetched on-demand when the user selects a phrase in Mid mode. Returns alternative expressions (with formality and nuance), grammar patterns (with examples), and cultural context. Receives the tapped expression, full Korean sentence, back-translation, and original English for grounding.

## Data Model

```
TranslationResult
├── koreanTranslation: string       (full Korean email)
└── segments: SentenceSegment[]
    ├── korean: string              (one Korean sentence)
    ├── backTranslation: string     (English back-translation)
    ├── originalEnglish: string     (mapped portion of input)
    ├── tokens: TokenData[]
    │   ├── text: string            (Korean word/morpheme)
    │   ├── romanization: string
    │   ├── meaning: string
    │   └── pos: string             (part of speech)
    ├── communicativeFunction: string (e.g. "Greeting", "Request")
    └── normAlignment?: string       (optional Korean convention note)

ExplorationResult (Mid only, on-demand)
├── alternatives: AlternativeExpression[]
│   ├── korean, english, formality, nuanceDiff
├── grammarPatterns: ReusablePattern[]
│   ├── pattern, description, examples[]
└── culturalContext: string
```

## Interaction Logging

TransLucent logs user interactions for research purposes:
- **Segment review** — tracks when each segment is checked/unchecked as reviewed
- **Follow-up questions** — logs when a Low-mode user asks a question
- **Exploration opened** — logs when a Mid-mode user opens the exploration panel
- All events are timestamped and stored in an in-memory interaction log, output to console when the user clicks "Ready to send"

## Tech Stack

- **Frontend:** React 18, TypeScript
- **Build tooling:** Vite (`@vitejs/plugin-react-swc`)
- **AI API:** OpenAI (`gpt-5-mini-2025-08-07`)
- **Styling:** Custom CSS (`src/styles.css`)

## Project Structure

```
src/
├── App.tsx               Onboarding survey + proficiency routing
├── TranslationTool.tsx   Main translation UI (both Low and Mid modes)
├── proficiencyEngine.ts  Proficiency level logic + feature matrix
├── styles.css            All styling (onboarding + translation tool)
└── main.tsx              React entry point
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- OpenAI API key (set as `VITE_OPEN_AI_KEY` in `.env`)

### Installation
```
npm install
```

### Running
```
npm run dev
```