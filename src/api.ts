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
  options?: MoveOption[];
  recommended_index?: number;
}

export interface RouteHistory {
  name: string;
  description: string;
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
        "tone": "formal, writing to peer or senior colleague",
        "purpose": "propose delaying the Q3 project deadline"
      },
      "moves": [
        {
          "label": "Opening",
          "original_text": "Hi Jimin,\n\nI wanted to reach out about the Q3 project timeline.",
          "options": [
            {
              "icon": "☀️",
              "name": "Wellbeing check",
              "description": "Directly asking how they're doing — a common way to show genuine care in Korean professional emails",
              "korean": "지민 님 안녕하세요, 잘 지내고 계신지요?",
              "back_translation": "Hello Jimin, are you doing well?"
            },
            {
              "icon": "☕",
              "name": "Soft & conversational",
              "description": "A warmer, polite greeting without specifically asking about health.",
              "korean": "지민 님 안녕하세요, 그간 평안하셨는지요?",
              "back_translation": "Hello Jimin, have you been peaceful lately?"
            },
            {
              "icon": "🎯",
              "name": "Standard formal",
              "description": "A simple greeting that gets straight to the point.",
              "korean": "지민 님 안녕하세요,",
              "back_translation": "Hello Jimin,"
            }
          ]
        },
        {
          "label": "Delivering Bad News",
          "original_text": "After reviewing our current progress with the team, I think we need to push the deadline back by about two weeks. The data collection phase took longer than expected, and I want to make sure we deliver quality work rather than rushing through the analysis.",
          "options": [
            {
              "icon": "👥",
              "name": "Focus on collective goal",
              "description": "Highlights the team's consensus and factual constraints to soften the blow.",
              "korean": "팀원들과 현재 진행 상황을 검토해 본 결과, 마감일을 약 2주 정도 늦춰야 할 것 같습니다. 데이터 수집 단계가 예상보다 오래 걸렸고, 분석을 서두르기보다는 완성도 높은 결과물을 전달해 드리고 싶기 때문입니다.",
              "back_translation": "As a result of reviewing the current progress with the team members, it seems we will need to delay the deadline by about two weeks. It is because the data collection phase took longer than expected, and I want to deliver a highly complete outcome rather than rushing the analysis."
            },
            {
              "icon": "🙇",
              "name": "Direct & apologizing",
              "description": "Takes more direct responsibility while apologizing for the delay. More deferential in Korean.",
              "korean": "일정에 차질을 드려 죄송합니다만, 마감일을 2주 정도 연기해야 할 것 같습니다. 데이터 수집이 지연되어 양질의 결과를 위해서는 시간이 조금 더 필요합니다.",
              "back_translation": "I apologize for the disruption to the schedule, but it seems we will need to postpone the deadline by about 2 weeks. Data collection has been delayed, so a little more time is needed for quality results."
            }
          ]
        },
        {
          "label": "Mitigation & Call to Action",
          "original_text": "I know this might affect your team's planning, so I'd love to discuss how we can minimize the impact. Are you free for a quick call this week?",
          "options": [
            {
              "icon": "🤝",
              "name": "Accommodating & empathetic",
              "description": "Shows deep consideration for their schedule, using traditional polite phrasing.",
              "korean": "이로 인해 귀하 팀의 일정에도 영향을 미칠 수 있을 것 같아, 그 영향을 최소화할 방안을 논의하고 싶습니다. 이번 주 편하신 시간에 잠시 통화 가능하신지요?",
              "back_translation": "It seems this might also affect your team's schedule, so I would like to discuss ways to minimize that impact. Are you available for a brief call at your convenience this week?"
            },
            {
              "icon": "📅",
              "name": "Proactive & structured",
              "description": "Recommends a quick touchpoint to actively resolve any friction.",
              "korean": "팀 일정에 영향을 미칠 수 있다는 점을 인지하고 있으며, 이를 해결하기 위해 이번 주에 잠시 미팅을 제안드립니다.",
              "back_translation": "I am aware that this could affect your team's schedule, and to resolve this, I propose a brief meeting this week."
            }
          ]
        },
        {
          "label": "Closing",
          "original_text": "Thanks,\nAlex",
          "options": [
            {
              "icon": "✒️",
              "name": "Standard sign-off",
              "description": "A standard polite sign-off used across most corporate communications.",
              "korean": "감사합니다.\n알렉스 드림",
              "back_translation": "Thank you.\nAlex"
            },
            {
              "icon": "🍂",
              "name": "Seasonal / Ambient",
              "description": "Very common in Korean business to end by wishing good health or referencing the weather.",
              "korean": "일교차가 큰데 건강 유의하시길 바랍니다. 감사합니다.\n알렉스 드림",
              "back_translation": "The daily temperature range is large, so please take care of your health. Thank you.\nAlex"
            }
          ]
        }
      ]
    }
  }
};

export async function analyzeContext(sourceText: string, toneAdjustment?: string): Promise<ContextAnalysisResponse> {
  let prompt = `You are an expert English-to-Korean translator and communication coach.
The user provides an English text.
Read the entire text and classify its communicative structure into about 3-5 logical "moves" (e.g., Opening, Main point, Closing).
Do NOT generate the actual Korean translations or options yet. Only output the context and the sequence of moves that make up the source text.

Return JSON in this EXACT format:
{
  "context": {
    "tone": "formal, writing to senior colleague",
    "purpose": "follow up on budget proposal"
  },
  "moves": [
    {
      "label": "Opening",
      "original_text": "I hope this message finds you well."
    },
    {
      "label": "Main Request",
      "original_text": "I wanted to follow up on the budget proposal I submitted last week..."
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
