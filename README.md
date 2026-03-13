# KorTrans Builder

A research prototype for English → Korean professional translation using a **sentence-by-sentence, turn-by-turn navigation metaphor**.

Instead of producing a single monolithic translation, the system splits the source text into sentences and lets the user steer each sentence's Korean expression independently — surfacing Korean-specific nuances that would be invisible in a one-shot translation.

Confirmed translations are passed as light background context for subsequent sentences — enough to maintain natural flow, but not enough to constrain the options.

The GPS / road metaphor (routes, junctions, arrival) is the UI skin for this decision flow.

---

## Workflow

1. **Input** — User pastes English text (or loads Scenario A) and optionally adds a tone note (e.g. "this is to a peer, not a senior"). Clicks **Start Translation**.

2. **Sentence split** — The source text is split into sentences by punctuation regex. No LLM call yet.

3. **Options generation (per sentence)** — For the current sentence, one LLM call is made with:
   - The full source text (overall context)
   - All confirmed Korean sentences so far (soft tone context — not a constraint)
   - The optional tone note

   The AI returns **1–3 options**:
   - **1 option** → sentence has one clear natural translation. It's auto-selected; user just clicks Proceed.
   - **2–3 options** → sentence has a meaningful Korean-specific crossroad (politeness register, directness, hierarchy). Each option has: icon, name, description (English), Korean translation, English back-translation. A `cultural_note` explains what the crossroad is.

4. **User choice** — For multi-option sentences, the map UI shows branching roads with an amber junction and a Cultural Checkpoint banner. User clicks a card to preview the Korean, then confirms. For single-option sentences, the road goes straight and Proceed is immediately available.

5. **Accumulate & advance** — The confirmed Korean sentence is added to the context pool. The next sentence's options are fetched immediately (pre-fetched while the user reads the result). Repeat from step 3.

6. **Arrival** — When all sentences are confirmed, the final Korean document is shown with back-translations. A Route Summary panel on the right lists the chosen approach per sentence — each entry is clickable to go back and revise that sentence. Copy to clipboard to finish.

---

## LLM Pipeline

One call per sentence, scoped to a single responsibility:

| Function | Input | Output |
|----------|-------|--------|
| `generateOptionsForSentence` | sentence + full source text + confirmed Korean so far + tone note | `{ options: [{icon, name, description, korean, back_translation}], cultural_note? }` |

`cultural_note` is only returned when the AI decides 2–3 options are warranted.

---

## Tech Stack

- **Frontend:** React 18, TypeScript
- **Build:** Vite + `@vitejs/plugin-react-swc`
- **AI:** OpenAI API (`gpt-5-mini-2025-08-07`)
- **Styling:** Tailwind CSS v4

## Project Structure

```
src/
├── App.tsx          Main UI — all phases and state management
├── api.ts           LLM calls, data types, sentence splitting, Scenario A
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
