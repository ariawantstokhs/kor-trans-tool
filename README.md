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
| **Situation Briefing** | Always visible — communicative norms for the situation displayed in English | On-demand — tap to see social/cultural context for a specific segment |
| **Back-translation** | Always visible — full sentence-by-sentence English back-translation | On-demand — tap uncertain segments to see back-translation |
| **Contextual Exploration** | OFF | On-demand drill-down: meaning → alternatives → reusable patterns |

### How Features Work Together

**Low users (Briefing + Back-translation):** The briefing provides criteria ("here's what's expected in this situation"), back-translation provides evidence ("here's what your translation actually conveys"). The user cross-references these two to assess appropriateness. The system never evaluates the translation — it gives the user two independent information sources and lets them draw their own conclusion.

**Mid users (Back-translation + Exploration, Briefing available):** Back-translation serves as a quick spot-check for uncertain segments. Contextual Exploration lets users dig into specific expressions — why this word was chosen, what alternatives exist, and when the pattern can be reused. Situation Briefing is available on-demand for cultural context.

## Features

### Situation Briefing
- Provides cultural and communicative norms expected for the given context (formality conventions, honorific norms, greeting structures) without judging the translation itself
- Norms are **specific and actionable** — they reference concrete Korean expressions used in the translation (e.g. verb endings like ~드리겠습니다, honorific markers) rather than generic advice like "use polite language"
- Low: displayed proactively in the **right panel** alongside the translation
- Mid: accessible on-demand per segment

### Back-translation
- Translates the target language output back into the source language for meaning verification
- Low: always visible in a **side-by-side two-column layout** (Korean | Back-translation)
- Mid: on-demand, per segment

### Contextual Exploration
- Three-layer drill-down on any segment of the translation:
  - **Layer 1:** What does this mean? (back-translation + token breakdown)
  - **Layer 2:** How else could I say this? (alternative expressions with nuance/formality differences, with "Use this" swap button)
  - **Layer 3:** When can I use this pattern again? (reusable grammar structures with examples)
- Mid only — requires ability to read target language text

## UI Architecture

### LLM Pipeline

Two-call architecture with split responsibilities:

1. **Call 1 (Translation):** Translates the full email, generates sentence segments with token-level data, back-translations, and situation briefing norms. The LLM infers communicative context (recipient type, formality level, social relationship) from the email content itself to calibrate honorifics and register. Uses `gpt-5-mini-2025-08-07`.
2. **Call 2 (Exploration, Mid only):** Fetched on-demand when user taps a segment. Returns alternative expressions, grammar patterns, and cultural context. Receives the original English email as background context so that alternatives and cultural notes are grounded in the actual communicative situation, not just the Korean surface text.

## Tech Stack

- **Frontend:** React 18, TypeScript
- **Build tooling:** Vite (`@vitejs/plugin-react-swc`)
- **AI API:** OpenAI (`gpt-5-mini-2025-08-07`)
- **Styling:** Custom CSS (`src/styles.css`)

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