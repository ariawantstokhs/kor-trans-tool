import OpenAI from 'openai';

const openai = new OpenAI({
  // @ts-ignore
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'gpt-4o';

// ─── Language config ───

export interface LanguageConfig {
  code: string;
  label: string;
  contextNote: string;
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  ko: {
    code: 'ko',
    label: '한국어 (Korean)',
    contextNote: 'Korean',
  },
  'es-MX': {
    code: 'es-MX',
    label: 'Español - México (Spanish)',
    contextNote: 'Mexican Spanish',
  },
  zh: {
    code: 'zh',
    label: '中文 (Chinese)',
    contextNote: 'Chinese',
  },
};

// ─── Types ───

export type SegmentType = 'direct' | 'transformed' | 'cultural_adjustment' | 'added' | 'removed';

export type DirectionTag =
  | 'explicit → implicit'
  | 'direct → indirect'
  | 'personal → situational'
  | 'added context'
  | 'removed context';

export interface Segment {
  translated: string;
  type: SegmentType;
  original_english: string | null;
  why: string | null;
  back_translation: string;
  direction_tag?: DirectionTag;
}

export interface TranslateResponse {
  full_translated: string;
  segments: Segment[];
}

export interface Alternative {
  translated: string;
  back_translation: string;
  explicitness: string;
}

export interface AlternativesResponse {
  alternatives: Record<number, Alternative[]>;
}

// ─── Preset scenario ───

export const SCENARIOS = {
  short: {
    source: `Hi Professor Kim,
I hope this message finds you well. I wanted to follow up on the budget proposal I submitted last week and check whether there have been any updates. I understand your schedule has been quite hectic, so I truly appreciate you taking the time to look into this. If any revisions are needed, I would be happy to make adjustments at your convenience. Thank you again for your continued support and guidance.`,
  },
  long: {
    source: `Hi Professor Kim,
I hope you're doing well. I wanted to reach out about our meeting scheduled for this Thursday.
To be honest, I haven't made as much progress on the project as I was hoping to. I ran into some unexpected issues with the data collection — specifically, several of the survey responses came back incomplete, and I've been spending the past few days trying to figure out whether to re-recruit participants or work with what I have. I'm leaning toward re-recruiting, but I wanted to get your input before making that call.
Because of this, I don't feel like I have enough to present at our Thursday meeting. Would it be okay if we pushed it to early next week instead? That way I can come prepared with a clearer picture of where things stand and a concrete plan for the next steps.
I also wanted to mention that I've been reading through the two papers you recommended last time — the one by Park et al. and the Yamamoto study. I found some interesting connections to our framing, especially around how Park et al. handle the cultural adaptation piece. I'd love to discuss that when we do meet.
I'm sorry about the delay — I know your schedule is tight and I don't want to waste your time. I'll make sure to send you a brief summary of where I am by Wednesday so you're not going in blind when we do meet.
Thanks so much for being flexible about this. I really appreciate it.
Best,
Alex`,
  },
};

// ─── Call 1: Translate ───

export async function translate(
  englishText: string,
  lang: LanguageConfig = LANGUAGES.ko
): Promise<string> {
  const targetLang = lang.contextNote;

  const prompt = `Translate this English email into ${targetLang}.
Translate naturally and appropriately based on the content and context of the email.
Output only the translation.

${englishText}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 1');
  return content.trim();
}

// ─── Call 2: Analyze ───

export async function analyze(
  englishText: string,
  translation: string,
  lang: LanguageConfig = LANGUAGES.ko
): Promise<TranslateResponse> {
  const targetLang = lang.contextNote;

  const prompt = `Here is an English email and its ${targetLang} translation.

Original:
${englishText}

Translation:
${translation}

Segment the translation and compare each segment against the original. For each segment, provide a JSON array:

{
  "segments": [
    {
      "translated_text": "...",
      "type": "direct | transformed | cultural_adjustment | added | removed",
      "original_english": "..." or null if added,
      "back_translation": "natural fluent English preserving the tone and nuance of the translated text",
      "why": "(non-direct only) what you changed and why. Be specific to this sentence. Explain what a native reader would feel. Never use terms like high-context, low-context, collectivist, individualist."
    }
  ]
}

Type definitions:
- direct: Meaning and delivery essentially the same.
- transformed: Same meaning, form changed due to grammar (word order, honorifics, verb endings).
- cultural_adjustment: Communicative strategy changed — how the message is delivered is fundamentally different (direct became hedged, personal became situational, tone shifted beyond grammar, etc).
- added: Not in original, added for convention.
- removed: In original, dropped as unnatural or redundant. translated_text should be empty, original_english should contain what was dropped.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 2');
  const raw = JSON.parse(content);

  return {
    full_translated: translation,
    segments: (raw.segments || []).map((s: any) => ({
      translated: s.translated_text || '',
      type: s.type,
      original_english: s.original_english || null,
      back_translation: s.back_translation || '',
      why: s.why || null,
    })),
  } as TranslateResponse;
}

// ─── Call 3: Alternatives + Tags ───

export async function alternativesAndTags(
  segments: Segment[],
  lang: LanguageConfig = LANGUAGES.ko
): Promise<{ tags: Record<string, DirectionTag>; alternatives: Record<number, Alternative[]> }> {
  const targetLang = lang.contextNote;
  const caSegments = segments
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter(s => s.type === 'cultural_adjustment');

  if (caSegments.length === 0) {
    return { tags: {}, alternatives: {} };
  }

  const inputSegments = caSegments.map(s => ({
    index: s.originalIndex,
    translated_text: s.translated,
    original_english: s.original_english,
    back_translation: s.back_translation,
    why: s.why,
  }));

  const prompt = `Here are the cultural adjustment segments from a translation.

For each segment, provide:
1. direction_tag: exactly one of: "explicit → implicit", "direct → indirect", "personal → situational", "added context", "removed context"
2. alternatives: 3 options with back_translation for each:
   - "more explicit": closer to the original English style
   - "middle ground": balanced
   - "conventional": natural for ${targetLang}

Input segments:
${JSON.stringify(inputSegments, null, 2)}

Respond as a JSON object:
{
  "results": [
    {
      "index": <segment_index>,
      "direction_tag": "...",
      "alternatives": [
        { "translated": "...", "back_translation": "...", "explicitness": "more explicit" },
        { "translated": "...", "back_translation": "...", "explicitness": "middle ground" },
        { "translated": "...", "back_translation": "...", "explicitness": "conventional ${targetLang}" }
      ]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 3');
  const raw = JSON.parse(content);

  const tags: Record<string, DirectionTag> = {};
  const alternatives: Record<number, Alternative[]> = {};

  for (const item of raw.results || []) {
    const idx = item.index;
    tags[String(idx)] = item.direction_tag as DirectionTag;
    alternatives[idx] = (item.alternatives || []).map((a: any) => ({
      translated: a.translated || '',
      back_translation: a.back_translation || '',
      explicitness: a.explicitness || '',
    }));
  }

  return { tags, alternatives };
}
