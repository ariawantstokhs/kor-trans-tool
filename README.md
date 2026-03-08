# TransLucent – Proficiency-Differentiated Translation Support Tool

TransLucent is a translation support system that differentiates its
interface based on the user's language proficiency level. Rather than
providing a one-size-fits-all translation, it offers different
verification and exploration tools depending on whether the user can
read the target language — enabling informed decisions about translation
quality at every proficiency level.

Currently implemented for English → Korean professional translation as a research prototype.

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
| **Back-translation** | Displayed individually as options to choose from per sentence | On-demand — toggle per sentence via ↩ button |
| **Follow-up Q&A** | Sentence-by-sentence version selection (Slides) | OFF |
| **Contextual Exploration** | OFF | On-demand — select any Korean text to drill down |

## User Flow

### Onboarding

A 2-step setup survey determines the user's proficiency level:

1. **TOPIK score** — if the user has one, they select their level (1–6); TOPIK 3+ → Mid, TOPIK 1–2 → Low.
2. **Self-assessed reading ability** — if no TOPIK, the user picks from 4 descriptions of their Korean reading comfort (2 map to Low, 2 to Mid).

After setup, the tool launches with the appropriate feature set. A **DEV toggle** in the header allows switching between Low and Mid at any time for testing.

### Low Mode

A **full-width slide selection flow** designed for users who cannot independently verify the translation:

**Slide sequence:**
- The English text generates a base translation in the background.
- The user is sequentially shown each original English sentence.
- For each sentence, the system provides 3 **Korean alternative translations**.
- Since the user cannot read the Korean, each alternative is paired with its English **Back-translation** and a short 1-2 sentence explanation of its nuance or tone (e.g., "more formal", "softer request").
- The user selects the version that aligns best with their intended tone, then clicks "Next".

**Pre-fetching:**
- While the user is viewing the current slide, the system asynchronously fetches the alternatives for the next slide.

**Final Review View:**
- Once all sentences are chosen, a **Final Review** screen displays the constructed Korean document on the left, alongside the chosen English back-translations on the right.
- The user can click a "Change" button next to any sentence to jump back to that specific slide and reconsider their choice.
- Clicking "Finalize Document" completes the flow and moves to the Final screen.

**Document Ready View:**
- The fully assembled Korean text is presented in a clean, selectable central card.
- A **Copy to Clipboard** button easily transfers the final output to the user's clipboard (`document_copied` interaction logged).
- A **Start Over** button clears the state and returns to the initial input.

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

1. **Call 1 — Translation** (`translateText`): Translates the full text, generates sentence segments with token-level data (romanization, meaning, part-of-speech), back-translations, communicative function labels, and original English mapping. The LLM infers communicative context (recipient type, formality level, social relationship) from the text content itself.

2. **Call 2 — Sentence Alternatives** (`generateSentenceAlternatives`, Low only): Fetched per sentence in Low mode. Receives the segment's original English, full English context, and base Korean translation. Generates 2 additional Korean variants (+ the base). Returns each variant's back-translation and a short 1-2 sentence explanation of its nuance/tone.

3. **Call 3 — Exploration** (`fetchExploration`, Mid only): Fetched on-demand when the user selects a phrase in Mid mode. Returns alternative expressions (with formality and nuance), grammar patterns (with examples), and cultural context. Receives the tapped expression, full Korean sentence, back-translation, and original English for grounding.

## Data Model

```
TranslationResult
├── koreanTranslation: string       (full Korean text)
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

SentenceOption (Low only, per slide)
├── korean: string                  (alternative or default Korean)
├── backTranslation: string         (English re-translation)
└── explanation: string             (nuance/tone context)

ExplorationResult (Mid only, on-demand)
├── alternatives: AlternativeExpression[]
│   ├── korean, english, formality, nuanceDiff
├── grammarPatterns: ReusablePattern[]
│   ├── pattern, description, examples[]
└── culturalContext: string
```

## Interaction Logging

TransLucent logs user interactions for research purposes:
- **Slide Progression (Low)** — `slide_enter` tracks exactly which sentence the user is currently reviewing.
- **Option Selection (Low)** — `option_selected` and `option_changed` tracks the user toggling between different nuance variants.
- **Review Adjustments (Low)** — `review_change_request` triggers when jumping back to a slide from the Final Review screen.
- **Document Confirmed & Copied (Low)** — logs `document_confirmed` upon finalization, and `document_copied` when copying the final text.
- **Exploration opened (Mid)** — logs when a Mid-mode user opens the exploration panel.
- All events are timestamped and stored in an in-memory interaction log, output to console upon final confirmation (`document_confirmed` or "Ready to send").

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