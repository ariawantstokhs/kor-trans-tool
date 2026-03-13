import OpenAI from 'openai';

const openai = new OpenAI({
  // @ts-ignore
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'gpt-5-mini-2025-08-07';

export interface SentenceOption {
  icon: string;
  name: string;
  description: string;
  korean: string;
  back_translation: string;
}

export interface SentenceOptionsResponse {
  options: SentenceOption[];
  cultural_note?: string;
  pragmatic_intent?: string;
}

export const SCENARIOS = {
  scenarioA: {
    source: `I hope this message finds you well. I wanted to follow up on the budget proposal I submitted last week and check whether there have been any updates. I understand your schedule has been quite hectic, so I truly appreciate you taking the time to look into this. If any revisions are needed, I would be happy to make adjustments at your convenience. Thank you again for your continued support and guidance.`,
  }
};

export function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  // Simple approach suitable for research use with controlled input
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export async function generateOptionsForSentence(
  sentence: string,
  fullText: string,
  confirmedKorean: string[],
  toneAdjustment?: string
): Promise<SentenceOptionsResponse> {
  const confirmedSection = confirmedKorean.length > 0
    ? `\n[Context: Previously Confirmed Korean Sentences]\n${confirmedKorean.join('\n')}\n`
    : '';

  const toneSection = toneAdjustment ? `\n[User's Global Tone Preference]: "${toneAdjustment}"\n` : '';

  const prompt = `
[Overall Context (Source Text)]
"""
${fullText}
"""
${toneSection}
This is list of sentences that user has confirmed to use Confirmed senteces: ${confirmedSection}

[Target Sentence to Decompose]
"${sentence}"

### Task Instructions:
1. **Identify the Route (Pragmatic Intent):** Analyze what this sentence is trying to ACHIEVE in the given professional context. Express this as a short English phrase (5–10 words max).
2. **Generate Options:**
   - If it sounds appropirate in korean with direct translation, provide exactly 1 option.
   - If the translation was not directly translated because of cultural adjustment, provide along with alternatives to consider. max 1-2"
   - make sure that suggestion makes sense when it comes after the confirmed section.
   - Do NOT generate multiple options just for variety — only offer real choices that matter in Korean.

### JSON Format Requirements:
Return ONLY a JSON object with these fields don't use any korean here:
- "pragmatic_intent": (String) 1 short English phrase — what this sentence is trying to DO (the "Route").
- "cultural_note": (String) 1–2 short sentences max. Explaining why direct translation of the english sentence won't make sense here. No examples. Omit if only 1 option.
- "options": An array of objects, each containing:
    - "icon": A symbolic emoji for the strategy.
    - "name": A strategy-level label (e.g., "Deference-first Inquiry", "Action-oriented Directness").
    - "description": Explain the social impact of this choice for a non-Korean speaker.
    - "korean": The Korean translation.
    - "back_translation": Literal English back-translation.

{
  "pragmatic_intent": "...",
  "cultural_note": "...",
  "options": [
    {
      "icon": "...",
      "name": "...",
      "description": "...",
      "korean": "...",
      "back_translation": "..."
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error("No content returned");
  return JSON.parse(content) as SentenceOptionsResponse;
}
