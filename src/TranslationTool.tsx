import React, { useState, useRef, useCallback, useEffect } from "react";
import { ProficiencyEngine, ProficiencyLevel, FeatureMode } from "./proficiencyEngine";
import OpenAI from "openai";

// ─── Types ──────────────────────────────────────────────────────────────────



interface TokenData {
  text: string;
  romanization: string;
  meaning: string;
  pos: string;
}

type LowModeStep = 'input' | 'slides' | 'review' | 'final';

interface SentenceOption {
  korean: string;
  backTranslation: string;
  explanation: string;
}

interface SentenceSegment {
  korean: string;
  backTranslation: string;
  tokens: TokenData[];
  communicativeFunction: string;
  originalEnglish?: string;
}

interface TranslationResult {
  koreanTranslation: string;
  segments: SentenceSegment[];
}

interface AlternativeExpression {
  korean: string;
  english: string;
  formality: "more formal" | "similar" | "more casual";
  nuanceDiff: string;
}

interface ReusablePattern {
  pattern: string;
  description: string;
  examples: string[];
}

interface ExplorationResult {
  explanation: string;
  alternatives: AlternativeExpression[];
  grammarPatterns: ReusablePattern[];
  culturalContext: string;
}

interface TranslationToolProps {
  engine: ProficiencyEngine;
  onChangeLevel: (level: ProficiencyLevel) => void;
}

// ─── API ────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: (import.meta as any).env.VITE_OPEN_AI_KEY as string,
      dangerouslyAllowBrowser: true,
    });
  }
  return _openai;
}

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5-mini-2025-08-07",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_completion_tokens: 16000,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ── Call 1: Translation + Base Data ──

async function translateText(
  text: string,
  level: ProficiencyLevel
): Promise<TranslationResult> {
  const contextLine = "Infer the recipient type and formality from the text content.";

  const systemPrompt = `You are a Korean translation assistant specializing in professional writing.
The user will provide a text in English (a message, document, or letter). Your task is to translate it into natural, highly professional Korean and analyze it sentence by sentence.

Respond ONLY with valid JSON matching this shape:
{
  "korean_translation": "<full Korean text as a single string>",
  "sentence_segments": [
    {
      "korean": "<one Korean sentence>",
      "back_translation": "<English back-translation of that sentence>",
      "original_english": "<the portion of the user's original English input that this Korean segment corresponds to>",
      "tokens": [
        {
          "text": "<Korean word/morpheme>",
          "romanization": "<romanization>",
          "meaning": "<English meaning>",
          "pos": "<part of speech>"
        }
      ],
      "communicative_function": "<short label for what this sentence does, e.g. Greeting, Self-introduction, Purpose statement, Credential presentation, Closing & gratitude>"
    }
  ]
}

Rules:
- Split the input into individual sentences. Translate each separately.
- original_english: REQUIRED for every segment. The exact portion of the user's original English input that this Korean segment translates.
- back_translation: translate each Korean sentence back to English independently.
- tokens: break each Korean sentence into key words/morphemes with romanization, meaning, and part-of-speech.
- communicative_function: REQUIRED for every segment. A short plain-English label describing the rhetorical role of this sentence in the writing (e.g. "Greeting", "Request", "Closing & gratitude").
- Do NOT generate a document-level situation briefing. All situational information must be at the sentence level.
- No markdown, no prose, pure JSON only.`;

  const raw = await callOpenAI(systemPrompt, `Translate this professional text to Korean:\n"${text}"`);
  console.log("[Call 1] Raw response length:", raw.length);
  console.log("[Call 1] Raw response:", raw.substring(0, 500));
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      koreanTranslation: parsed.korean_translation || "",
      segments: (parsed.sentence_segments || []).map((s: any) => ({
        korean: s.korean || "",
        backTranslation: s.back_translation || "",
        tokens: (s.tokens || []).map((t: any) => ({
          text: t.text || "",
          romanization: t.romanization || "",
          meaning: t.meaning || "",
          pos: t.pos || "",
        })),
        communicativeFunction: s.communicative_function || "",
        originalEnglish: s.original_english || undefined,
      })),
    };
  } catch (err) {
    console.error("[Call 1] JSON parse error:", err);
    console.log("[Call 1] Failed raw:", raw);
    return {
      koreanTranslation: raw,
      segments: [{ korean: raw, backTranslation: "(parsing error)", tokens: [], communicativeFunction: "" }],
    };
  }
}

// ── Call 2: Alternative Generation (Low mode, sentence-level) ──

async function generateSentenceAlternatives(
  originalEnglish: string,
  fullEnglishText: string,
  baseKorean: string,
): Promise<SentenceOption[]> {
  const systemPrompt = `You are a Korean translation assistant. 
The user is writing a professional document or message.
Full text context: "${fullEnglishText}"

For the specific sentence: "${originalEnglish}"
The default Korean translation is: "${baseKorean}"

Your task:
1. Provide a short 1-2 sentence explanation of the nuance/tone of the default translation IN ENGLISH.
2. Generate 2 meaningfully different alternative Korean translations for this sentence that represent different communicative choices the sender might face (e.g., different familiarity with the recipient, different relationship dynamics, different purposes). Do NOT generate alternatives that differ only in politeness level of the same expression.
3. For each alternative, provide its back-translation to English and a short 1-2 sentence explanation of its nuance/tone and when it's appropriate IN ENGLISH.

Respond ONLY with valid JSON matching this shape:
{
  "options": [
    {
      "korean": "<default translation>",
      "backTranslation": "<back-translation of default>",
      "explanation": "<explanation of default translation's nuance IN ENGLISH>"
    },
    {
      "korean": "<alternative 1>",
      "backTranslation": "<back-translation 1>",
      "explanation": "<explanation 1 IN ENGLISH>"
    },
    {
      "korean": "<alternative 2>",
      "backTranslation": "<back-translation 2>",
      "explanation": "<explanation 2 IN ENGLISH>"
    }
  ]
}
No markdown, pure JSON only.`;

  const raw = await callOpenAI(systemPrompt, "Generate options.");
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return parsed.options || [];
  } catch (err) {
    console.error("[Call 2] Alternative generation error", err);
    return [];
  }
}

// ── Call 3: Exploration Data (Mid only, on-demand, phrase-level) ──

async function fetchExploration(
  tappedExpression: string,
  fullKoreanSentence: string,
  backTranslation: string,
  originalEnglish: string,
  userQuestion: string | null
): Promise<ExplorationResult> {
  let systemPrompt: string;
  let userMessage: string;

  if (userQuestion) {
    // Branch A — Tailored mode
    systemPrompt = `You are a helpful Korean language tutor.
The user selected a specific expression from a Korean translation and has a specific question about it.

Context:
Original English: "${originalEnglish}"
Korean Translation: "${fullKoreanSentence}"
Back-translation: "${backTranslation}"
Selected expression: "${tappedExpression}"
User's question: "${userQuestion}"

Respond ONLY with valid JSON:
{
  "explanation": "A clear, focused 2-3 sentence answer to the user's specific question about this expression.",
  "alternatives": [
    {
      "korean": "<alternative expression>",
      "english": "<english translation>",
      "formality": "more formal|similar|more casual",
      "nuance_diff": "<difference explanation>"
    }
  ],
  "grammar_patterns": [
    {
      "pattern": "<reusable pattern>",
      "description": "<when to use>",
      "examples": ["<ex1>", "<ex2>"]
    }
  ],
  "cultural_context": "<1-2 sentences, only if relevant to the question>"
}

STRICT RULES:
- "explanation" is the PRIMARY field. Answer the user's question directly and thoroughly.
- Only include alternatives, grammar_patterns, cultural_context if they are relevant to the user's question. If not relevant, return empty array [] or empty string "".
- All explanations in English. No markdown, pure JSON only.`;
    userMessage = "Explore this expression.";
  } else {
    // Branch B — General mode
    systemPrompt = `You are a Korean language tutor. The user selected a specific word or phrase in the Korean translation to learn more.
Respond ONLY with valid JSON:
{
  "explanation": "A clear 1-2 sentence overview of what this expression means and why it was used in this context.",
  "alternatives": [
    {
      "korean": "<alternative Korean expression>",
      "english": "<English translation>",
      "formality": "more formal|similar|more casual",
      "nuance_diff": "<how this differs in nuance/tone>"
    }
  ],
  "grammar_patterns": [
    {
      "pattern": "<reusable grammar pattern, e.g. ~(으)시다>",
      "description": "<when to use this pattern>",
      "examples": ["<example 1>", "<example 2>"]
    }
  ],
  "cultural_context": "<1-2 sentences about cultural/social norms relevant to this specific expression in this context>"
}

Rules:
- "explanation" gives a concise overview first. The rest of the fields provide detailed drill-down.
- Focus your analysis on the selected expression within its sentence context.
- alternatives: 2-3 alternative ways to express the same idea with different formality/nuance. Present as OPTIONS, not corrections.
- grammar_patterns: 1-2 reusable grammar patterns from this expression with examples.
- cultural_context: expression-specific cultural norm (formality, honorifics, social appropriateness).
- All explanations in English. No markdown, pure JSON only.`;

    userMessage = `Selected expression: "${tappedExpression}"
Full Korean sentence: "${fullKoreanSentence}"
Back-translation: "${backTranslation}"
Original English: "${originalEnglish}"`;
  }

  const raw = await callOpenAI(systemPrompt, userMessage);
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      explanation: parsed.explanation || "",
      alternatives: (parsed.alternatives || []).map((a: any) => ({
        korean: a.korean || "",
        english: a.english || "",
        formality: a.formality || "similar",
        nuanceDiff: a.nuance_diff || "",
      })),
      grammarPatterns: (parsed.grammar_patterns || []).map((p: any) => ({
        pattern: p.pattern || "",
        description: p.description || "",
        examples: p.examples || [],
      })),
      culturalContext: parsed.cultural_context || "",
    };
  } catch {
    return { explanation: "", alternatives: [], grammarPatterns: [], culturalContext: raw };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const ModeBadge = ({ mode }: { mode: FeatureMode }) => {
  const config = {
    proactive: { color: "#4a7c59", label: "ALWAYS ON" },
    "on-demand": { color: "#b07c2a", label: "ON-DEMAND" },
    off: { color: "#888", label: "OFF" },
  };
  const { color, label } = config[mode];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, color, padding: "2px 8px",
      borderRadius: 999, background: color + "15",
      border: `1px solid ${color}30`, fontWeight: 700,
      letterSpacing: "0.06em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
};





// ─── Main Component ──────────────────────────────────────────────────────────

export const TranslationTool: React.FC<TranslationToolProps> = ({ engine, onChangeLevel }) => {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [segments, setSegments] = useState<SentenceSegment[]>([]);
  const [loading, setLoading] = useState(false);

  // Mid mode state
  const [selectedPhrase, setSelectedPhrase] = useState<{ text: string; segIdx: number } | null>(null);
  const [exploration, setExploration] = useState<ExplorationResult | null>(null);
  const [explorationLoading, setExplorationLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showBT, setShowBT] = useState<Record<number, boolean>>({});
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; segIdx: number; x: number; y: number } | null>(null);
  const [popupQuestion, setPopupQuestion] = useState("");
  const [userQuestion, setUserQuestion] = useState<string | null>(null);

  // Low slide view state
  const [lowModeStep, setLowModeStep] = useState<LowModeStep>('input');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [sentenceOptions, setSentenceOptions] = useState<Record<number, SentenceOption[]>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const fetchingOptions = useRef<Set<number>>(new Set());

  // Segment review state
  const [reviewedSegments, setReviewedSegments] = useState<Set<number>>(new Set());
  const [interactionLog, setInteractionLog] = useState<any[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentencesRef = useRef<HTMLDivElement>(null);
  const { features, level } = engine;

  // ── Handlers ──

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    setSegments([]);
    setSelectedPhrase(null);
    setExploration(null);
    setExpandedSections(new Set());
    setShowBT({});
    setSelectionPopup(null);
    setLowModeStep('input');
    setReviewedSegments(new Set());
    setInteractionLog([]);
    try {
      const res = await translateText(inputText, level);
      setResult(res);
      setSegments([...res.segments]);
      if (level === 'low' && res.segments.length > 0) {
        setLowModeStep('slides');
        setCurrentSlideIndex(0);
        setSentenceOptions({});
        setSelectedOptions({});
        fetchingOptions.current = new Set();
        setInteractionLog(prev => [...prev, { type: "slide_enter", sentenceIdx: 0, timestamp: Date.now() }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = useCallback(() => {
    if (level === "low") return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() || "";
    if (text.length < 2) {
      setSelectionPopup(null);
      return;
    }
    // Find which segment this selection belongs to
    const anchor = sel?.anchorNode?.parentElement;
    if (!anchor) return;
    const sentenceEl = anchor.closest("[data-seg-idx]");
    if (!sentenceEl) return;
    const segIdx = parseInt(sentenceEl.getAttribute("data-seg-idx") || "-1", 10);
    if (segIdx < 0) return;
    // Position popup near selection
    const range = sel?.getRangeAt(0);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    setSelectionPopup({ text, segIdx, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, [level]);

  const handleExploreSelection = () => {
    if (!selectionPopup) return;
    const question = popupQuestion.trim() || null;
    setSelectedPhrase({ text: selectionPopup.text, segIdx: selectionPopup.segIdx });
    setUserQuestion(question);
    setExploration(null);
    setExpandedSections(new Set());
    setSelectionPopup(null);
    setPopupQuestion("");
    window.getSelection()?.removeAllRanges();
    // Auto-fetch exploration
    const seg = segments[selectionPopup.segIdx];
    const mode = question ? "tailored" : "general";
    setInteractionLog((prev) => [...prev, { segIdx: selectionPopup.segIdx, action: "exploration_opened", userQuestion: question, mode, timestamp: Date.now() }]);
    setExplorationLoading(true);
    fetchExploration(
      selectionPopup.text,
      seg.korean,
      seg.backTranslation,
      seg.originalEnglish || inputText,
      question
    ).then((res) => {
      setExploration(res);
    }).finally(() => {
      setExplorationLoading(false);
    });
  };

  const handleFetchExploration = async () => {
    if (!selectedPhrase || !result) return;
    const seg = segments[selectedPhrase.segIdx];
    const mode = userQuestion ? "tailored" : "general";
    setInteractionLog((prev) => [...prev, { segIdx: selectedPhrase.segIdx, action: "exploration_opened", userQuestion, mode, timestamp: Date.now() }]);
    setExplorationLoading(true);
    try {
      const res = await fetchExploration(
        selectedPhrase.text,
        seg.korean,
        seg.backTranslation,
        seg.originalEnglish || inputText,
        userQuestion
      );
      setExploration(res);
    } finally {
      setExplorationLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
        // Fetch exploration data on first expand if not loaded
        if (!exploration && !explorationLoading) {
          handleFetchExploration();
        }
      }
      return next;
    });
  };

  const handleReplaceSegment = (altKorean: string) => {
    if (!selectedPhrase) return;
    const idx = selectedPhrase.segIdx;
    setSegments((prev) => {
      const next = [...prev];
      const oldKorean = next[idx].korean;
      next[idx] = { ...next[idx], korean: oldKorean.replace(selectedPhrase.text, altKorean) };
      return next;
    });
    setSelectedPhrase({ ...selectedPhrase, text: altKorean });
  };

  const toggleReview = useCallback((idx: number) => {
    setReviewedSegments((prev) => {
      const next = new Set(prev);
      const action = next.has(idx) ? "review_uncheck" : "review_check";
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      setInteractionLog((p) => [...p, { segIdx: idx, action, timestamp: Date.now() }]);
      return next;
    });
  }, []);

  const handleSendReady = useCallback(() => {
    console.log("[TransLucent] Interaction Log:", interactionLog);
    console.log("[TransLucent] All segments reviewed. Ready to send.");
  }, [interactionLog]);

  const levels: ProficiencyLevel[] = ["low", "mid"];

  // Dismiss selection popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".tl-selection-popup")) {
        setSelectionPopup(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchOptionsForIndex = useCallback(async (idx: number, segs: SentenceSegment[], text: string) => {
    if (fetchingOptions.current.has(idx) || sentenceOptions[idx] || idx >= segs.length) return;
    fetchingOptions.current.add(idx);
    const seg = segs[idx];
    if (!seg.originalEnglish) {
      setSentenceOptions(prev => ({ ...prev, [idx]: [{ korean: seg.korean, backTranslation: seg.backTranslation, explanation: "Standard translation." }] }));
      return;
    }
    const opts = await generateSentenceAlternatives(seg.originalEnglish, text, seg.korean);
    const validOpts = opts.length > 0 ? opts : [{ korean: seg.korean, backTranslation: seg.backTranslation, explanation: "Standard translation." }];
    setSentenceOptions(prev => ({ ...prev, [idx]: validOpts }));
  }, [sentenceOptions]);

  // Pre-fetch next options
  useEffect(() => {
    if (level === 'low' && lowModeStep === 'slides' && segments.length > 0) {
      if (!sentenceOptions[currentSlideIndex]) {
        fetchOptionsForIndex(currentSlideIndex, segments, inputText);
      }
      if (currentSlideIndex + 1 < segments.length && !sentenceOptions[currentSlideIndex + 1]) {
        fetchOptionsForIndex(currentSlideIndex + 1, segments, inputText);
      }
    }
  }, [level, lowModeStep, currentSlideIndex, segments, inputText, sentenceOptions, fetchOptionsForIndex]);

  const handleOptionSelect = (idx: number, optIdx: number) => {
    setSelectedOptions(prev => {
      const prevOptIdx = prev[idx];
      if (prevOptIdx !== undefined && prevOptIdx !== optIdx) {
        setInteractionLog(log => [...log, { type: "option_changed", sentenceIdx: idx, prevOptionIdx: prevOptIdx, newOptionIdx: optIdx, timestamp: Date.now() }]);
      } else if (prevOptIdx === undefined) {
        setInteractionLog(log => [...log, { type: "option_selected", sentenceIdx: idx, optionIdx: optIdx, timestamp: Date.now() }]);
      }
      return { ...prev, [idx]: optIdx };
    });
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < segments.length - 1) {
      setCurrentSlideIndex(p => p + 1);
      setInteractionLog(log => [...log, { type: "slide_enter", sentenceIdx: currentSlideIndex + 1, timestamp: Date.now() }]);
    } else {
      setLowModeStep('review');
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(p => p - 1);
      setInteractionLog(log => [...log, { type: "slide_enter", sentenceIdx: currentSlideIndex - 1, timestamp: Date.now() }]);
    }
  };

  // ── Render ──

  return (
    <div className="tl-root">
      {/* ── Top bar ── */}
      <header className="tl-header">
        <div className="tl-brand">
          <div className="tl-brand-mark">
            <span>TL</span>
          </div>
          <span className="tl-brand-name">TransLucent</span>
        </div>

        {/* Dev toggle */}
        <div className="tl-dev-toggle">
          <span className="tl-dev-label">DEV</span>
          {levels.map((l) => (
            <button
              key={l}
              onClick={() => onChangeLevel(l)}
              className={`tl-level-btn ${level === l ? "tl-level-btn--active" : ""}`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
          <span className="tl-dev-suffix">proficiency</span>
        </div>


      </header>

      {/* ── Content ── */}
      <div className={`tl-content ${level === "mid" || (level === "low" && lowModeStep === "input") ? "tl-content--split" : "tl-content--single"}`}>

        {/* ── Mid mode: Landing input (before translation) ── */}
        {level === "mid" && !result && !loading && (
          <div className="tl-left">
            <div className="tl-card">
              <label className="tl-label">English Input</label>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleTranslate(); }}
                placeholder="Type a professional message to translate…"
                rows={4}
                className="tl-textarea"
              />
              <div className="tl-input-footer">
                <span className="tl-hint">Ctrl+Enter to translate</span>
                <button
                  onClick={handleTranslate}
                  disabled={loading || !inputText.trim()}
                  className="tl-translate-btn"
                >
                  {loading ? "Translating…" : "Translate ↵"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mid mode: Loading state ── */}
        {level === "mid" && !result && loading && (
          <div className="tl-left">
            <div className="tl-card">
              <div className="tl-exploration-loading" style={{ padding: "40px 24px", justifyContent: "center" }}>
                <div className="tl-spinner" />
                <span>Translating…</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Low mode: Input area ── */}
        {level === "low" && lowModeStep === "input" && (
          <div className="tl-left">
            <div className="tl-card">
              <label className="tl-label">English Input</label>

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleTranslate(); }}
                placeholder="Type a professional message to translate…"
                rows={4}
                className="tl-textarea"
              />
              <div className="tl-input-footer">
                <span className="tl-hint">Ctrl+Enter to translate</span>
                <button
                  onClick={handleTranslate}
                  disabled={loading || !inputText.trim()}
                  className="tl-translate-btn"
                >
                  {loading ? "Translating…" : "Translate ↵"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── MID MODE — Left panel: Korean segments (after translation) ──────── */}
        {level === "mid" && result && (
          <div className="tl-left">
            <div className="tl-card">
              <div className="tl-mid-header-row">
                <label className="tl-label">
                  Korean Translation
                  <span className="tl-label-hint"> — select a word to explore</span>
                </label>
                <button
                  className="tl-edit-input-btn"
                  onClick={() => {
                    setResult(null);
                    setSegments([]);
                    setSelectedPhrase(null);
                    setExploration(null);
                  }}
                  title="Edit English input"
                >
                  ✎ Edit input
                </button>
              </div>
              <div className="tl-sentences" ref={sentencesRef} onMouseUp={handleTextSelection}>
                {segments.map((seg, i) => (
                  <div key={i} className="tl-segment-wrapper">
                    <button
                      className={`tl-review-icon-btn ${reviewedSegments.has(i) ? "tl-review-icon-btn--checked" : ""}`}
                      onClick={() => toggleReview(i)}
                      aria-label={reviewedSegments.has(i) ? "Unmark as reviewed" : "Mark as reviewed"}
                    >
                      <span className="tl-review-icon" />
                    </button>
                    <div
                      className="tl-sentence"
                      data-seg-idx={i}
                    >
                      <div className="tl-korean tl-korean--selectable">
                        {(() => {
                          const hl = selectedPhrase && selectedPhrase.segIdx === i && seg.korean.includes(selectedPhrase.text)
                            ? selectedPhrase
                            : selectionPopup && selectionPopup.segIdx === i && seg.korean.includes(selectionPopup.text)
                              ? selectionPopup
                              : null;
                          if (hl) {
                            const idx = seg.korean.indexOf(hl.text);
                            return (
                              <>
                                {seg.korean.slice(0, idx)}
                                <mark className="tl-highlight">{hl.text}</mark>
                                {seg.korean.slice(idx + hl.text.length)}
                              </>
                            );
                          }
                          return seg.korean;
                        })()}
                      </div>
                      <div className="tl-bt-row">
                        <button
                          className="tl-bt-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowBT((prev) => ({ ...prev, [i]: !prev[i] }));
                          }}
                          title="Show back-translation"
                        >
                          ↩
                        </button>
                      </div>
                      {showBT[i] && (
                        <div className="tl-bt-inline">{seg.backTranslation}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating selection popup */}
              {selectionPopup && (
                <div
                  className="tl-selection-popup"
                  style={{
                    position: "fixed",
                    left: selectionPopup.x,
                    top: selectionPopup.y,
                    transform: "translate(-50%, -100%)",
                  }}
                  onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault(); }}
                >
                  <input
                    className="tl-selection-popup-input"
                    type="text"
                    placeholder="Ask anything, or just explore"
                    value={popupQuestion}
                    onChange={(e) => setPopupQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleExploreSelection(); }}
                  />
                  <button className="tl-selection-popup-btn" onClick={handleExploreSelection}>
                    Explore ▸
                  </button>
                </div>
              )}

              {/* Readiness bar */}
              <div className="tl-readiness-bar">
                <span className="tl-readiness-text">
                  Reviewed {reviewedSegments.size} of {segments.length} segments
                </span>
                {reviewedSegments.size === segments.length && segments.length > 0 && (
                  <button className="tl-send-btn" onClick={handleSendReady}>Ready to send</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────── Right panel: Mid mode ──────── */}
        {level === "mid" && (
          <div className="tl-right">
            {!result && (
              <div className="tl-empty-state">
                <div className="tl-empty-icon">↵</div>
                <div>Translate text to explore features</div>
              </div>
            )}

            {result && !selectedPhrase && (
              <div className="tl-empty-state">
                <div className="tl-empty-icon">←</div>
                <div>Select a Korean word to explore it</div>
              </div>
            )}

            {result && selectedPhrase && (
              <div className="tl-feature-panel">
                {/* Phrase header */}
                <div className="tl-phrase-header">
                  <span className="tl-phrase-header-label">About:</span>
                  <span className="tl-phrase-header-text">{selectedPhrase.text}</span>
                </div>

                {/* User question quote + Explanation — always visible */}
                <div className="tl-fp-section tl-fp-section--explanation">
                  {userQuestion && (
                    <p className="tl-user-question-quote">"{userQuestion}"</p>
                  )}
                  {explorationLoading && !exploration && (
                    <div className="tl-exploration-loading" style={{ padding: "16px 24px" }}>
                      <div className="tl-spinner" />
                      <span>Analyzing…</span>
                    </div>
                  )}
                  {exploration && exploration.explanation && (
                    <p className="tl-exploration-explanation">{exploration.explanation}</p>
                  )}
                </div>

                {/* Back-translation — always shown */}
                <div className="tl-fp-section tl-fp-section--bt">
                  <div className="tl-fp-section-header">
                    <span className="tl-fp-section-icon">↩</span>
                    <span className="tl-fp-section-title">Back-translation</span>
                  </div>
                  <div className="tl-fp-section-body">
                    <p className="tl-fp-bt-text">{segments[selectedPhrase.segIdx].backTranslation}</p>
                  </div>
                </div>

                {/* See alternatives — expandable, hidden if empty */}
                {(!exploration || exploration.alternatives.length > 0) && (
                  <div className="tl-fp-section">
                    <div
                      className="tl-fp-section-header tl-fp-section-header--clickable"
                      onClick={() => toggleSection("alternatives")}
                    >
                      <span className="tl-fp-section-icon">↔</span>
                      <span className="tl-fp-section-title">See alternatives</span>
                      <span className={`tl-chevron ${expandedSections.has("alternatives") ? "tl-chevron--open" : ""}`}>▸</span>
                    </div>
                    {expandedSections.has("alternatives") && (
                      <div className="tl-fp-section-body">
                        {explorationLoading && !exploration && (
                          <div className="tl-exploration-loading">
                            <div className="tl-spinner" />
                            <span>Loading alternatives…</span>
                          </div>
                        )}
                        {exploration && exploration.alternatives.map((alt, i) => (
                          <div key={i} className="tl-alt-card">
                            <div className="tl-alt-korean">{alt.korean}</div>
                            <div className="tl-alt-english">{alt.english}</div>
                            <div className="tl-alt-nuance">{alt.nuanceDiff}</div>
                            <button
                              className="tl-alt-use-btn"
                              onClick={() => handleReplaceSegment(alt.korean)}
                            >
                              Use this ↵
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* See grammar pattern — expandable, hidden if empty */}
                {(!exploration || exploration.grammarPatterns.length > 0) && (
                  <div className="tl-fp-section">
                    <div
                      className="tl-fp-section-header tl-fp-section-header--clickable"
                      onClick={() => toggleSection("grammar")}
                    >
                      <span className="tl-fp-section-icon">≡</span>
                      <span className="tl-fp-section-title">See grammar pattern</span>
                      <span className={`tl-chevron ${expandedSections.has("grammar") ? "tl-chevron--open" : ""}`}>▸</span>
                    </div>
                    {expandedSections.has("grammar") && (
                      <div className="tl-fp-section-body">
                        {explorationLoading && !exploration && (
                          <div className="tl-exploration-loading">
                            <div className="tl-spinner" />
                            <span>Loading grammar…</span>
                          </div>
                        )}
                        {exploration && exploration.grammarPatterns.map((pat, i) => (
                          <div key={i} className="tl-pattern-card">
                            <div className="tl-pattern-name">{pat.pattern}</div>
                            <div className="tl-pattern-desc">{pat.description}</div>
                            <div className="tl-pattern-examples">
                              {pat.examples.map((ex, j) => (
                                <div key={j} className="tl-pattern-example">• {ex}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* See cultural context — expandable, hidden if empty */}
                {(!exploration || exploration.culturalContext !== "") && (
                  <div className="tl-fp-section">
                    <div
                      className="tl-fp-section-header tl-fp-section-header--clickable"
                      onClick={() => toggleSection("cultural")}
                    >
                      <span className="tl-fp-section-icon">∞</span>
                      <span className="tl-fp-section-title">See cultural context</span>
                      <span className={`tl-chevron ${expandedSections.has("cultural") ? "tl-chevron--open" : ""}`}>▸</span>
                    </div>
                    {expandedSections.has("cultural") && (
                      <div className="tl-fp-section-body">
                        {explorationLoading && !exploration && (
                          <div className="tl-exploration-loading">
                            <div className="tl-spinner" />
                            <span>Loading context…</span>
                          </div>
                        )}
                        {exploration && (
                          <p className="tl-fp-cultural-text">
                            {exploration.culturalContext}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──────── LOW MODE: SINGLE COLUMN VIEWS ──────── */}
        {level === "low" && lowModeStep === "slides" && (
          <div className="tl-slide-view">
            <div className="tl-slide-card">
              <div className="tl-slide-header">
                <span className="tl-slide-progress">Sentence {currentSlideIndex + 1} of {segments.length}</span>
              </div>

              <div className="tl-slide-content">
                <div className="tl-slide-english">
                  <h3 className="tl-slide-title">Original English</h3>
                  <p className="tl-slide-english-text">{segments[currentSlideIndex]?.originalEnglish}</p>
                </div>

                <h3 className="tl-slide-title">Choose Translation Version</h3>
                <div className="tl-slide-options">
                  {!sentenceOptions[currentSlideIndex] ? (
                    <div className="tl-slide-loading">
                      <div className="tl-spinner" /> Generating translation options...
                    </div>
                  ) : (
                    sentenceOptions[currentSlideIndex].map((opt, i) => (
                      <div
                        key={i}
                        className={`tl-opt-card ${selectedOptions[currentSlideIndex] === i ? 'tl-opt-card--selected' : ''}`}
                        onClick={() => handleOptionSelect(currentSlideIndex, i)}
                      >
                        <p className="tl-opt-korean">{opt.korean}</p>
                        <p className="tl-opt-bt">{opt.backTranslation}</p>
                        <p className="tl-opt-exp">{opt.explanation}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="tl-slide-footer">
                <button
                  className="tl-nav-btn tl-nav-btn--secondary"
                  disabled={currentSlideIndex === 0}
                  onClick={handlePrevSlide}
                >
                  ← Previous
                </button>
                <button
                  className="tl-nav-btn tl-nav-btn--primary"
                  disabled={selectedOptions[currentSlideIndex] === undefined}
                  onClick={handleNextSlide}
                >
                  {currentSlideIndex < segments.length - 1 ? "Next →" : "Review Final Output →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {level === "low" && lowModeStep === "review" && (
          <div className="tl-review-view">
            <div className="tl-review-card">
              <h2 className="tl-review-title">Final Review</h2>
              <p className="tl-review-subtitle">Here is your composed text. You can change any sentence before finalizing.</p>

              <div className="tl-review-list">
                {segments.map((seg, i) => {
                  const selectedIdx = selectedOptions[i];
                  const opt = sentenceOptions[i]?.[selectedIdx] || { korean: seg.korean, backTranslation: seg.backTranslation, explanation: "" };
                  return (
                    <div key={i} className="tl-review-row">
                      <div className="tl-review-texts">
                        <div className="tl-review-korean">{opt.korean}</div>
                        <div className="tl-review-bt">{opt.backTranslation}</div>
                      </div>
                      <button className="tl-change-btn" onClick={() => {
                        setCurrentSlideIndex(i);
                        setLowModeStep('slides');
                        setInteractionLog(log => [...log, { type: "review_change_request", sentenceIdx: i, timestamp: Date.now() }]);
                      }}>
                        Change
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="tl-review-footer">
                <button className="tl-send-btn tl-send-btn--large" onClick={() => {
                  setInteractionLog(log => [...log, { type: "document_confirmed", timestamp: Date.now() }]);
                  console.log("[TransLucent] Document Confirmed!", interactionLog);
                  setLowModeStep('final');
                }}>
                  Finalize Document
                </button>
              </div>
            </div>
          </div>
        )}

        {level === "low" && lowModeStep === "final" && (
          <div className="tl-review-view">
            <div className="tl-review-card" style={{ textAlign: "center" }}>
              <div className="tl-slide-header">
                <span className="tl-slide-progress" style={{ background: "#e0f2fe", color: "#0284c7" }}>Done</span>
              </div>
              <h2 className="tl-review-title" style={{ marginBottom: "24px" }}>Document Ready</h2>
              <div className="tl-opt-card tl-opt-card--selected" style={{ textAlign: "left", marginBottom: "32px", cursor: "text" }}>
                <p className="tl-review-korean" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {segments.map((seg, i) => {
                    const selectedIdx = selectedOptions[i];
                    return (sentenceOptions[i]?.[selectedIdx] || { korean: seg.korean }).korean;
                  }).join(" ")}
                </p>
              </div>

              <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                <button
                  className="tl-nav-btn tl-nav-btn--secondary"
                  onClick={() => {
                    setLowModeStep('input');
                    setInputText('');
                    setResult(null);
                    setSegments([]);
                  }}
                >
                  Start Over
                </button>
                <button
                  className="tl-send-btn tl-send-btn--large"
                  onClick={() => {
                    const text = segments.map((seg, i) => {
                      const selectedIdx = selectedOptions[i];
                      return (sentenceOptions[i]?.[selectedIdx] || { korean: seg.korean }).korean;
                    }).join(" ");
                    navigator.clipboard.writeText(text);
                    setInteractionLog(log => [...log, { type: "document_copied", timestamp: Date.now() }]);
                    alert("Copied to clipboard!");
                  }}
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
