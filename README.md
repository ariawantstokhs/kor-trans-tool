# KorTrans Builder

A research prototype for English → Korean professional translation using a **communicative-move-based, turn-by-turn navigation metaphor**.

Instead of producing a single monolithic translation, the system decomposes the source text into discrete communicative moves (e.g., Opening, Main Request, Closing) and lets the user steer each move's tone independently — surfacing Korean-specific nuances that would be invisible in a one-shot translation.

## Core Concept

Standard translation tools collapse all decisions into one opaque output. This tool makes those decisions explicit by:

1. Analyzing the source text's communicative structure and inferring tone/purpose.
2. Presenting each move as a "crossroads" — 2–3 Korean translation options that differ in **Korean-specific** nuance (not just English-level variation).
3. Assembling the final document from the user's choices, with a back-translation for each move so users can verify intent.

The GPS / road metaphor (routes, junctions, arrival) is the UI skin for this decision flow.

## User Flow

### Phase 1 — Input
User pastes English text (or loads Scenario A). Optionally adjusts tone context.

### Phase 2 — Context Analysis
System calls the LLM to infer tone, purpose, and a list of 3–5 communicative moves from the source text. The first move's options are pre-fetched immediately.

### Phase 3 — Navigation (move-by-move)
For each move:
- A map-style UI shows 2–3 option cards positioned as branching roads.
- Each card shows: option name, description (why it matters in Korean), Korean preview, and back-translation.
- User selects an option (or types a custom instruction). A confirm overlay shows the full Korean sentence before committing.
- On confirm, the system translates that move and immediately pre-fetches options for the next. A `recommended_index` is returned for moves after the first, suggesting the option that best continues the established tone.

### Phase 4 — Arrival
Final Korean document assembled from all move choices, shown alongside back-translations. A route summary on the right shows the chosen approach per move — each is clickable to go back and revise. Copy to clipboard to finish.

## LLM Pipeline

Three sequential calls, each scoped to a single responsibility:

| Call | Function | Input | Output |
|------|----------|-------|--------|
| 1 | `analyzeContext` | Full source text + optional tone override | `{ context: { tone, purpose }, moves: [{ label, original_text }] }` |
| 2 | `generateOptionsForMove` | Single move + context + route history so far | `{ options: [{ icon, name, description, korean, back_translation }], recommended_index? }` |
| 3 | `translateMove` | Single move + chosen option or custom instruction | `{ korean, back_translation, explanation }` |

Call 2 is triggered per-move (pre-fetched one step ahead). Call 3 is triggered on user confirmation.

## Tech Stack

- **Frontend:** React 18, TypeScript
- **Build:** Vite + `@vitejs/plugin-react-swc`
- **AI:** OpenAI API (`gpt-4o-mini`)
- **Styling:** Tailwind CSS v4

## Project Structure

```
src/
├── App.tsx          Main UI — all phases and state management
├── api.ts           LLM calls, data types, Scenario A mock data
├── RoadMap.tsx      Progress indicator (top nav nodes)
├── utils.ts         cx() classname utility
└── main.tsx         React entry point
```

## Setup

```
# Prerequisites: Node 18+, OpenAI API key
echo "VITE_OPENAI_API_KEY=sk-..." > .env

npm install
npm run dev
```
