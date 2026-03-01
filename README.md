## KoreanBridge – Korean Translation & Tutoring Tool

KoreanBridge is a React + Vite frontend that helps learners translate English into Korean while teaching them about nuance, politeness, and vocabulary usage. It starts with a short survey to estimate the learner’s proficiency, then tailors the translation experience with different feature sets.

### Features

- **Onboarding survey**  
  - Collects name, study duration, self‑rating (1–10), and learning goals.  
  - Derives a **proficiency level** (`low`, `mid`, `high`) from the answers.

- **Adaptive translation engine**  
  - Uses OpenAI (`gpt-4o-mini`) to translate English → Korean.  
  - Adjusts feature intensity based on proficiency level via a `ProficiencyEngine`.

- **Interactive Korean output**  
  - Splits Korean text into clickable tokens.  
  - **Word exploration**: tap a word to see romanization, meaning, usage context, and a grammar note (when enabled).

- **Cultural context flags**  
  - Highlights politeness and cultural nuances (e.g. formality, register) as inline “flags”.  
  - Severity levels: **note** or **caution**, with optional detailed explanations.

- **Alternative expressions**  
  - Shows multiple Korean rewrites with different **formality levels** (formal / neutral / casual).  
  - Each variant can include a short **nuance** explanation.

- **Dev-level toggle**  
  - In the top bar you can manually switch between `low`, `mid`, `high` proficiency to preview different feature combinations.

- **Modern UI**  
  - Onboarding wizard with vertical stepper and responsive layout.  
  - Split‑panel translator UI with an input area on the left and feature panels on the right.

### Tech Stack

- **Frontend**: React 18, TypeScript
- **Build tooling**: Vite (with `@vitejs/plugin-react-swc`)
- **AI API**: OpenAI Node SDK (`openai`), using `gpt-4o-mini`
- **Styling**: Custom CSS (`src/styles.css`)

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended)
- **npm** (bundled with Node)

### Installation

npm install
