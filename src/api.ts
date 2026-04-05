import OpenAI from 'openai';

const openai = new OpenAI({
  // @ts-ignore
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const MODEL = 'gpt-4o';

// ─── Types ───

export type SegmentType = 'direct' | 'transformed' | 'added' | 'removed';

export interface Segment {
  korean: string;
  type: SegmentType;
  original_english: string | null;
  why: string | null;
  back_translation: string;
}

export interface TranslateResponse {
  full_korean: string;
  segments: Segment[];
}

export interface Alternative {
  korean: string;
  back_translation: string;
  explicitness: 'more explicit (closer to English style)' | 'conventional Korean' | 'middle ground';
}

export interface AlternativesResponse {
  alternatives: Record<number, Alternative[]>; // keyed by segment index
}

// ─── Preset scenario ───

export const SCENARIOS = {
  scenarioA: {
    source: `I hope this message finds you well. I wanted to follow up on the budget proposal I submitted last week and check whether there have been any updates. I understand your schedule has been quite hectic, so I truly appreciate you taking the time to look into this. If any revisions are needed, I would be happy to make adjustments at your convenience. Thank you again for your continued support and guidance.`,
    context: {
      recipient: 'Professor Kim',
      relationship: 'student to professor',
      situation: 'Following up on a budget proposal for a research project',
    },
  },
};

// ─── Call 1: Translate + Annotate ───

export async function translateAndAnnotate(
  englishText: string,
  recipient: string,
  relationship: string,
  situation: string
): Promise<TranslateResponse> {
  const prompt = `You are an expert English-to-Korean translator specializing in pragmatic and cultural adaptation.

[Source Email]
"""
${englishText}
"""

[Context]
- Recipient: ${recipient}
- Relationship: ${relationship}
- Situation: ${situation}

### Task:
Translate the email into natural Korean. Then break the translation into segments and annotate each segment with one of these types:
- "direct": meaning and delivery style are nearly identical to the original
- "transformed": same intent, but delivered differently due to Korean conventions
- "added": not in the original, but added because Korean conventions expect it
- "removed": present in the original, but omitted because it would be unnatural in Korean

For each segment:
- "korean": the Korean text of this segment (for "removed" segments, leave empty string)
- "type": one of the four types above
- "original_english": the corresponding English phrase (null for "added" segments)
- "why": for non-direct segments, explain in English: "In English, [X], but in Korean, [Y] because [reason]." Null for "direct" segments.
- "back_translation": a literal English back-translation of the Korean text (for "removed" segments, write what was removed from the original)

Return ONLY a JSON object:
{
  "full_korean": "the complete Korean translation as a single string",
  "segments": [ ... ]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 1');
  return JSON.parse(content) as TranslateResponse;
}

// ─── Call 2: Back-translate ───

export async function backTranslate(
  segments: Segment[]
): Promise<Segment[]> {
  const koreanSegments = segments
    .filter(s => s.type !== 'removed')
    .map((s, i) => ({ index: i, korean: s.korean }));

  const prompt = `You are a Korean-to-English literal translator.

Below are Korean text segments. For each one, provide a literal, word-for-word English back-translation that preserves the Korean sentence structure and nuance as closely as possible. Do NOT polish or naturalize the English — the goal is to show English speakers exactly what the Korean says.

Segments:
${JSON.stringify(koreanSegments, null, 2)}

Return ONLY a JSON object:
{
  "back_translations": {
    "0": "literal back-translation for segment 0",
    "1": "literal back-translation for segment 1",
    ...
  }
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 2');
  const parsed = JSON.parse(content) as { back_translations: Record<string, string> };

  let koreanIdx = 0;
  return segments.map(seg => {
    if (seg.type === 'removed') return seg;
    const bt = parsed.back_translations[String(koreanIdx)] ?? seg.back_translation;
    koreanIdx++;
    return { ...seg, back_translation: bt };
  });
}

// ─── Call 3: Generate Alternatives ───

export async function generateAlternatives(
  segments: Segment[],
  englishText: string,
  recipient: string,
  relationship: string,
  situation: string
): Promise<AlternativesResponse> {
  const nonDirectSegments = segments
    .map((s, i) => ({ ...s, originalIndex: i }))
    .filter(s => s.type !== 'direct');

  if (nonDirectSegments.length === 0) {
    return { alternatives: {} };
  }

  const prompt = `You are an expert English-to-Korean translator.

[Original English Email]
"""
${englishText}
"""

[Context]
- Recipient: ${recipient}
- Relationship: ${relationship}
- Situation: ${situation}

For each of the following non-direct translation segments, generate 2-3 alternative Korean translations. Each alternative should have:
- "korean": the alternative Korean text
- "back_translation": literal English back-translation
- "explicitness": one of "more explicit (closer to English style)", "conventional Korean", or "middle ground"

Segments to generate alternatives for:
${JSON.stringify(nonDirectSegments.map(s => ({
  index: s.originalIndex,
  type: s.type,
  current_korean: s.korean,
  original_english: s.original_english,
  why: s.why,
})), null, 2)}

Return ONLY a JSON object:
{
  "alternatives": {
    "<segment_index>": [
      { "korean": "...", "back_translation": "...", "explicitness": "..." },
      ...
    ],
    ...
  }
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: prompt }],
  });

  const content = response.choices[0].message?.content;
  if (!content) throw new Error('No content returned from Call 3');
  return JSON.parse(content) as AlternativesResponse;
}
