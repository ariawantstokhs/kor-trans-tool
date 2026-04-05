# KorTrans Builder

A research prototype for English → Korean professional translation using a **dynamic, turn-by-turn navigation metaphor**.

Instead of producing a single monolithic translation, the system decomposes the source text into individual sentences and allows the user to steer the Korean expression for each "turn"—surfacing cultural nuances, politeness registers, and pragmatic choices that are often flattened in standard AI translations.

## The Navigation Metaphor (GPS UI)

The core interaction is modeled after a **GPS / Driving experience**:
- **Routes & Junctions**: When a sentence has multiple valid Korean expressions based on social context (e.g., deference vs. directness), the UI presents a "junction" where the user chooses their path.
- **The Car**: A blue puck icon represents your current progress through the source text.
- **Cultural Checkpoints**: When a meaningful cultural shift is detected (like changing a subject/object marker or choosing a specific honorific), an amber alert banner explains the "obstacle" encountered.
- **Pragmatic Intent**: Each sentence is labeled with its core "Route" (e.g., *Action-oriented Inquiry*, *Deference-first Request*) to help non-Korean speakers understand the underlying social impact of their choice.

## Features

- **Sequential Generation**: LLM calls are made sentence-by-sentence. Each new turn is aware of previously confirmed Korean sentences to maintain logical flow and consistent tone.
- **Scenario Testing**: Load built-in scenarios (Scenario A: Professional Budget Follow-up) or provide custom English text and tone notes.
- **Dynamic Decision Cards**: Each option includes:
    - **Strategy Label**: The social approach (e.g., "Warm & Personal", "Formal & Precise").
    - **Back-translation**: A literal English translation to verify the meaning change.
    - **Social Impact Description**: English explanation of *why* this choice matters in Korean society.
- **Arrival & Route Summary**: Once the destination is reached, the user receives a final combined output. A "Route Summary" side-panel allows users to "rewind" to any sentence to re-navigate that specific turn.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS v4
- **Build**: Vite
- **AI Engine**: OpenAI API (`gpt-5-mini-2025-08-07`)
- **Icons**: Lucide-React

## LLM Pipeline

The system uses a focused `generateOptionsForSentence` function:

| Component | Responsibility |
|-----------|----------------|
| **Input Context** | Target sentence, full source text, user's global tone note, and all previously confirmed Korean sentences. |
| **Analysis** | Identifies "Pragmatic Intent" and determines if cultural nuances warrant multiple options. |
| **Output** | A structured JSON containing 1–3 options with icons, strategy names, back-translations, and cultural notes. |

## Getting Started

1. **Environment Setup**:
   ```bash
   # Add your OpenAI API key to .env
   echo "VITE_OPENAI_API_KEY=sk-your-key-here" > .env
   ```

2. **Installation**:
   ```bash
   npm install
   ```

3. **Development Build**:
   ```bash
   npm run dev
   ```

---
*Created for research exploring "Low UI" and interactive transparency in AI-assisted translation.*
