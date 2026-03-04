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
- Low: displayed proactively alongside the translation
- Mid: accessible on-demand per segment

### Back-translation
- Translates the target language output back into the source language for meaning verification
- Low: always visible, full text
- Mid: on-demand, per segment

### Contextual Exploration
- Three-layer drill-down on any segment of the translation:
  - **Layer 1:** What does this mean? (explanation)
  - **Layer 2:** How else could I say this? (alternative expressions with nuance/formality differences)
  - **Layer 3:** When can I use this pattern again? (reusable grammar structures)
- Mid only — requires ability to read target language text

### Other
- **Onboarding survey** — collects study duration, self-rating, and learning goals to derive proficiency level (`low` / `mid`)
- **Dev-level toggle** — manually switch between `low` and `mid` to preview different feature sets
- **Modern UI** — onboarding wizard, split-panel translator with input area and feature panels

## Tech Stack

- **Frontend:** React 18, TypeScript
- **Build tooling:** Vite (`@vitejs/plugin-react-swc`)
- **AI API:** OpenAI (`gpt-5-mini`)
- **Styling:** Custom CSS (`src/styles.css`)

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
```
npm install
```