import OpenAI from 'openai';

const openai = new OpenAI({
  // @ts-ignore
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'gpt-4o-mini';

export interface AnalysisContext {
  tone: string;
  purpose: string;
}

export interface MoveOption {
  icon: string;
  name: string;
  description: string;
  korean: string;
  back_translation: string;
}

export interface CommunicativeMove {
  label: string;
  original_text: string;
  adjustments?: Adjustment[];
  options?: MoveOption[];
  recommended_index?: number;
}

export interface RouteHistory {
  name: string;
  description: string;
}

export interface Adjustment {
  source_phrase: string;
  scope: 'move' | 'phrase';
  why: string;
  impact: 'adapted' | 'direct';
}

export interface ContextAnalysisResponse {
  context: AnalysisContext;
  moves: CommunicativeMove[];
}

export interface MoveTranslationResponse {
  korean: string;
  back_translation: string;
  explanation: string;
}

export const SCENARIOS = {
  scenarioA: {
    source: `I hope this message finds you well. I wanted to follow up on the budget proposal I submitted last week and check whether there have been any updates. I understand your schedule has been quite hectic, so I truly appreciate you taking the time to look into this. If any revisions are needed, I would be happy to make adjustments at your convenience. Thank you again for your continued support and guidance.`,
    mockAnalysis: {
      "context": {
        "tone": "formal, writing to a senior colleague or manager",
        "purpose": "follow up on a budget proposal submitted the previous week"
      },
      "moves": [
        {
          "label": "Opening",
          "original_text": "I hope this message finds you well.",
          "adjustments": [
            {
              "source_phrase": "I hope this message finds you well.",
              "scope": "move",
              "why": "Korean professional emails don't use wellness-check openers. The convention is to open with a formal greeting using the recipient's name and honorific title.",
              "impact": "adapted"
            }
          ],
          "options": [
            {
              "icon": "☀️",
              "name": "Wellbeing check",
              "description": "Asking how they're doing — adapted to the Korean convention of using name + honorific",
              "korean": "안녕하세요, 잘 지내고 계신지요?",
              "back_translation": "Hello, are you doing well?"
            },
            {
              "icon": "☕",
              "name": "Soft formal",
              "description": "A warmer greeting referencing recent wellbeing without a direct question",
              "korean": "안녕하세요, 그간 평안하셨는지요?",
              "back_translation": "Hello, have you been well lately?"
            },
            {
              "icon": "🎯",
              "name": "Standard formal",
              "description": "A minimal, professional greeting that gets straight to business",
              "korean": "안녕하세요,",
              "back_translation": "Hello,"
            }
          ]
        },
        {
          "label": "Follow-up Request",
          "original_text": "I wanted to follow up on the budget proposal I submitted last week and check whether there have been any updates.",
          "adjustments": [
            {
              "source_phrase": "I wanted to follow up",
              "scope": "phrase",
              "why": "'Follow up' has no natural Korean equivalent and can feel like pressure when directed at a senior. Korean professional communication frames this as a humble inquiry rather than a follow-up action.",
              "impact": "adapted"
            }
          ],
          "options": [
            {
              "icon": "🙏",
              "name": "Humble inquiry",
              "description": "Frames the follow-up as a tentative question, deferring to the senior's judgment",
              "korean": "지난주에 제출해 드린 예산안과 관련하여 진행 상황을 여쭤봐도 될까 하여 연락드립니다.",
              "back_translation": "I am reaching out to ask, if I may, about the progress on the budget proposal I submitted last week."
            },
            {
              "icon": "📋",
              "name": "Direct & respectful",
              "description": "States the purpose clearly while maintaining formality — appropriate if the relationship is established",
              "korean": "지난주 제출해 드린 예산안의 검토 현황을 확인하고 싶어 연락드렸습니다.",
              "back_translation": "I am reaching out to check on the review status of the budget proposal I submitted last week."
            }
          ]
        },
        {
          "label": "Empathy & Appreciation",
          "original_text": "I understand your schedule has been quite hectic, so I truly appreciate you taking the time to look into this.",
          "adjustments": [
            {
              "source_phrase": "I truly appreciate you taking the time",
              "scope": "phrase",
              "why": "Expressing appreciation for a senior's time is expected in Korean, but the phrasing is more formal and less direct — expressing gratitude as a conditional rather than an assumption.",
              "impact": "direct"
            }
          ],
          "options": [
            {
              "icon": "🤲",
              "name": "Humble & conditional",
              "description": "Frames appreciation as a hope rather than a statement, which feels more deferential in Korean",
              "korean": "바쁘신 와중에도 살펴봐 주신다면 정말 감사하겠습니다.",
              "back_translation": "I would be truly grateful if you could take a look despite your busy schedule."
            },
            {
              "icon": "✨",
              "name": "Warm acknowledgment",
              "description": "Acknowledges their effort warmly while keeping the tone professional",
              "korean": "바쁘신 중에도 시간 내어 검토해 주시니 깊이 감사드립니다.",
              "back_translation": "I am deeply grateful that you are taking time out of your busy schedule to review this."
            }
          ]
        },
        {
          "label": "Closing",
          "original_text": "If any revisions are needed, I would be happy to make adjustments at your convenience. Thank you again for your continued support and guidance.",
          "adjustments": [
            {
              "source_phrase": "I would be happy to make adjustments at your convenience.",
              "scope": "phrase",
              "why": "This flexibility offer is expressed more explicitly in Korean — the sender states they will act immediately upon the senior's word, rather than offering general willingness.",
              "impact": "direct"
            },
            {
              "source_phrase": "Thank you again for your continued support and guidance.",
              "scope": "move",
              "why": "Korean professional closings to seniors include a formal phrase expressing ongoing gratitude for the relationship, often with a seasonal or ambient well-wish rather than a direct thank-you statement.",
              "impact": "adapted"
            }
          ],
          "options": [
            {
              "icon": "✒️",
              "name": "Deferential close",
              "description": "Positions the sender as fully available to act on the senior's direction — the strongest show of deference",
              "korean": "수정이 필요한 부분이 있으시면 말씀만 해 주십시오. 바로 반영하겠습니다. 항상 이끌어 주심에 진심으로 감사드립니다.\n드림",
              "back_translation": "If there are any parts that need revision, please just let me know. I will apply them immediately. I sincerely thank you for always guiding me.\n[Sender]"
            },
            {
              "icon": "🍃",
              "name": "Warm seasonal close",
              "description": "Very common in Korean business writing — closes with a health wish alongside gratitude, softening the ending",
              "korean": "수정 사항이 있으시면 편하신 때에 말씀해 주시면 즉시 반영하겠습니다. 늘 아낌없이 도와주시고 이끌어 주심에 깊이 감사드리며, 건강하게 지내시길 바랍니다.\n드림",
              "back_translation": "If there are any revisions, please let me know at your convenience and I will apply them right away. I am deeply grateful for your generous help and guidance, and I hope you stay well.\n[Sender]"
            }
          ]
        }
      ]
    }
  }
};

export async function analyzeContext(sourceText: string, toneAdjustment?: string): Promise<ContextAnalysisResponse> {
  let prompt = `You are an expert English-to-Korean translator and cross-cultural communication analyst.

Read the source text and do two things simultaneously:

1. Classify the text into 3–5 discrete communicative "moves" (e.g., Opening, Main Request, Mitigation, Closing).

2. For each move, identify contextual adjustments — phrases or structural patterns where English communicative convention differs from Korean in a way that requires cultural adaptation beyond word-for-word translation. Consider:
   - Opening/closing conventions (different greeting and sign-off norms)
   - Directness (how directly requests, bad news, or disagreement are expressed)
   - Politeness strategy (face-saving, hedging, deference to seniority)
   - Social hierarchy (how communication adapts based on the recipient's seniority)
   - Discourse structure (e.g., reason-before-request vs. request-before-reason)

For each adjustment provide:
- source_phrase: the exact phrase from the source text
- scope: "move" if the whole move needs structural adaptation, "phrase" if a specific phrase is the issue
- why: 1–2 plain-English sentences explaining the cultural gap (write for someone who doesn't speak Korean)
- impact: "adapted" if the convention is fundamentally different and a literal translation would seem inappropriate or rude; "direct" if it's a subtle nuance and a literal translation would still convey meaning

Do NOT generate Korean translations yet. Only output the context, moves, and adjustments.

Return JSON in this EXACT format:
{
  "context": {
    "tone": "formal, writing to senior colleague",
    "purpose": "follow up on budget proposal"
  },
  "moves": [
    {
      "label": "Opening",
      "original_text": "I hope this message finds you well.",
      "adjustments": [
        {
          "source_phrase": "I hope this message finds you well.",
          "scope": "move",
          "why": "Korean professional emails don't use wellness-check openers. The convention is to open with a formal greeting using the recipient's name and honorific title.",
          "impact": "adapted"
        }
      ]
    },
    {
      "label": "Main Request",
      "original_text": "I wanted to follow up on the budget proposal...",
      "adjustments": []
    }
  ]
}

Source text:
"""
${sourceText}
"""
`;

  if (toneAdjustment) {
    prompt += `\nUser's adjustment request: "${toneAdjustment}". Please incorporate this when determining the tone and the available options.`;
  }

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: prompt
      }
    ],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error("No content returned");
  return JSON.parse(content) as ContextAnalysisResponse;
}

export interface OptionsGenerationResponse {
  options: MoveOption[];
  recommended_index?: number;
}

export async function generateOptionsForMove(
  move: CommunicativeMove,
  context: AnalysisContext,
  routeHistory: RouteHistory[],
  toneAdjustment?: string
): Promise<OptionsGenerationResponse> {
  const isFirstMove = routeHistory.length === 0;
  
  let historyContext = "";
  if (!isFirstMove) {
    historyContext = `
Previous Translation Route History:
${routeHistory.map((h, i) => `Move ${i + 1}: Chosen approach was "${h.name}" - ${h.description}`).join('\n')}

Because the user has already chosen a specific communicative route above, you MUST provide a \`recommended_index\` (0, 1, or 2) pointing to the option that most naturally continues the established tone and flow.
Do NOT force the user; all options should remain valid independent choices, but one must be recommended.`;
  }

  let prompt = `You are an expert English-to-Korean translator and communication coach.
We are translating the text chunk by chunk. It's time to generate 2 to 3 translation options for the CURRENT MOVE.

Overall Context:
Tone: ${context.tone}
Purpose: ${context.purpose}
${toneAdjustment ? `User Tone Request: ${toneAdjustment}` : ''}
${historyContext}

CURRENT MOVE to translate:
Label: ${move.label}
Original Text: "${move.original_text}"

Generate 2 to 3 tone/approach options for how it could be translated into Korean.
Do NOT use grammatical jargon like "합쇼체 vs 해요체". Use intention-level names like "Warm & personal", "Standard formal", etc.

IMPORTANT: The options you provide should REMAIN INHERENT TO KOREAN LANGUAGE NUANCES. They should NOT just be repeating what is already decided in the English text. 
You must present communicative crossroads that exist in Korean.

Provide a 1-sentence \`description\` in English for each option explaining WHY it matters or when to use it in Korean context, naturally.
For each option provide an appropriate emoji \`icon\` that represents this choice.
Crucially, provide the proposed \`korean\` translation for this move, and its \`back_translation\` in English so the user can see exactly what they are choosing.

Return JSON in this EXACT format:
{
  "options": [
    {
      "icon": "☀️",
      "name": "Wellbeing Check",
      "description": "Directly asking how they're doing — a common way to show genuine care in Korean professional emails",
      "korean": "안녕하세요, 잘 지내고 계신지요?",
      "back_translation": "Hello, are you doing well?"
    },
...
  ]${!isFirstMove ? `,\n  "recommended_index": 0` : ''}
}
`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: prompt
      }
    ],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error("No content returned");
  return JSON.parse(content) as OptionsGenerationResponse;
}

export async function translateMove(
  move: CommunicativeMove,
  optionDetails: { name: string, description?: string, customText?: string },
  context: AnalysisContext
): Promise<MoveTranslationResponse> {
  const isCustom = !!optionDetails.customText;

  const instruction = isCustom
    ? `The user provided their own instruction for the tone/approach: "${optionDetails.customText}"`
    : `The user selected the approach: "${optionDetails.name}" (${optionDetails.description})`;

  const prompt = `You are an expert English-to-Korean translator.
You are translating a single "move" from a larger text.

Context of the whole text:
Tone: ${context.tone}
Purpose: ${context.purpose}

Original text for this move:
"""
${move.original_text}
"""

${instruction}

Provide:
1. The final Korean translation for this move based on the choice.
2. An English back-translation of your Korean text.
3. A 1-2 sentence explanation of how the user's choice was realized in Korean.

Return JSON in this EXACT format:
{
  "korean": "안녕하세요, 잘 지내고 계신지요?",
  "back_translation": "Hello, are you doing well?",
  "explanation": "Your warm opening translates into a direct wellbeing check, which feels natural and respectful in Korean business writing."
}
`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: prompt
      }
    ],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error("No content returned");
  return JSON.parse(content) as MoveTranslationResponse;
}
