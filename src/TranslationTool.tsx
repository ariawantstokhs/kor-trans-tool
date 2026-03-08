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

interface SentenceSegment {
  korean: string;
  backTranslation: string;
  tokens: TokenData[];
  communicativeFunction: string;
  normAlignment?: string;
  originalEnglish?: string;
}

interface FollowUpQA {
  question: string;
  answer: string;
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

  const systemPrompt = `You are a Korean translation assistant specializing in professional emails.
${contextLine}
The user's Korean proficiency level is: ${level}.

Respond ONLY with valid JSON matching this shape:
{
  "korean_translation": "<full Korean email as a single string>",
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
      "communicative_function": "<short label for what this sentence does, e.g. Greeting, Self-introduction, Purpose statement, Credential presentation, Closing & gratitude>",
      "norm_alignment": "<OPTIONAL — include ONLY when there is a meaningful communicative norm. 1-2 sentences describing what is generally expected for this communicative function in this specific context. Include relevant Korean expressions parenthetically so the user can locate them. Keep explanation in English. Omit this field entirely if no meaningful norm applies.>"
    }
  ]
}

Rules:
- Split the input into individual sentences. Translate each separately.
- original_english: REQUIRED for every segment. The exact portion of the user's original English input that this Korean segment translates.
- back_translation: translate each Korean sentence back to English independently.
- tokens: break each Korean sentence into key words/morphemes with romanization, meaning, and part-of-speech.
- communicative_function: REQUIRED for every segment. A short plain-English label describing the rhetorical role of this sentence in the writing (e.g. "Greeting", "Request", "Closing & gratitude").
- norm_alignment: OPTIONAL. Include ONLY when there is a meaningful communicative norm relevant to this segment in this specific context. Describe the norm, NOT the translation. Be specific to the situation — do NOT give generic advice like "use polite language". Describe the concrete communicative convention. Include relevant Korean expressions in parentheses. Do NOT evaluate, judge, or suggest edits to the translation.
- Do NOT generate a document-level or email-level situation briefing. All situational information must be at the sentence level.
- No markdown, no prose, pure JSON only.`;

  const raw = await callOpenAI(systemPrompt, `Translate this professional email to Korean:\n"${text}"`);
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
        normAlignment: s.norm_alignment || undefined,
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

// ── Call 2: Low Follow-Up (on-demand) ──

async function fetchLowFollowUp(
  segment: SentenceSegment,
  userQuestion: string
): Promise<string> {
  const systemPrompt = `The user is reviewing a Korean translation and has asked a follow-up question about a specific segment. Answer their question using only the context below. Keep your answer in English, 2–3 sentences max.

Rules:
- Answer only what the user asked. Do not evaluate the translation or suggest edits.
- If the question is about how something would be perceived by a Korean reader, describe the convention — do not say the translation is right or wrong.
- Stay within this segment's scope. Do not comment on other parts of the translation.
- No markdown formatting. Plain text only.`;

  const userMessage = `Context:
Original English: ${segment.originalEnglish || "(not available)"}
Korean: ${segment.korean}
Back-translation: ${segment.backTranslation}
Communicative norm: ${segment.normAlignment || "(none)"}

User's question: ${userQuestion}`;

  return await callOpenAI(systemPrompt, userMessage);
}

// ── Call 3: Exploration Data (Mid only, on-demand, phrase-level) ──

async function fetchExploration(
  tappedExpression: string,
  fullKoreanSentence: string,
  backTranslation: string,
  originalEnglish: string
): Promise<ExplorationResult> {
  const systemPrompt = `You are a Korean language tutor. The user selected a specific word or phrase in the Korean translation to learn more.
Respond ONLY with valid JSON:
{
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
- Focus your analysis on the selected expression within its sentence context.
- alternatives: 2-3 alternative ways to express the same idea with different formality/nuance. Present as OPTIONS, not corrections.
- grammar_patterns: 1-2 reusable grammar patterns from this expression with examples.
- cultural_context: expression-specific cultural norm (formality, honorifics, social appropriateness).
- All explanations in English. No markdown, pure JSON only.`;

  const userMessage = `Selected expression: "${tappedExpression}"
Full Korean sentence: "${fullKoreanSentence}"
Back-translation: "${backTranslation}"
Original English: "${originalEnglish}"`;

  const raw = await callOpenAI(systemPrompt, userMessage);
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
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
    return { alternatives: [], grammarPatterns: [], culturalContext: raw };
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

  // Low follow-up state
  const [followUps, setFollowUps] = useState<Record<number, FollowUpQA[]>>({});
  const [followUpLoading, setFollowUpLoading] = useState<Record<number, boolean>>({});
  const [followUpInputs, setFollowUpInputs] = useState<Record<number, string>>({});
  const [followUpOpen, setFollowUpOpen] = useState<Record<number, boolean>>({});

  // Segment review state
  const [reviewedSegments, setReviewedSegments] = useState<Set<number>>(new Set());
  const [interactionLog, setInteractionLog] = useState<Array<{ segIdx: number; action: string; timestamp: number }>>([]);

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
    setFollowUps({});
    setFollowUpLoading({});
    setFollowUpInputs({});
    setFollowUpOpen({});
    setReviewedSegments(new Set());
    setInteractionLog([]);
    try {
      const res = await translateText(inputText, level);
      setResult(res);
      setSegments([...res.segments]);
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
    setSelectedPhrase({ text: selectionPopup.text, segIdx: selectionPopup.segIdx });
    setExploration(null);
    setExpandedSections(new Set());
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    // Auto-fetch exploration
    const seg = segments[selectionPopup.segIdx];
    setExplorationLoading(true);
    fetchExploration(
      selectionPopup.text,
      seg.korean,
      seg.backTranslation,
      seg.originalEnglish || inputText
    ).then((res) => {
      setExploration(res);
    }).finally(() => {
      setExplorationLoading(false);
    });
  };

  const handleFetchExploration = async () => {
    if (!selectedPhrase || !result) return;
    const seg = segments[selectedPhrase.segIdx];
    setInteractionLog((prev) => [...prev, { segIdx: selectedPhrase.segIdx, action: "exploration_opened", timestamp: Date.now() }]);
    setExplorationLoading(true);
    try {
      const res = await fetchExploration(
        selectedPhrase.text,
        seg.korean,
        seg.backTranslation,
        seg.originalEnglish || inputText
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
  };

  const handleFollowUp = useCallback(async (segIdx: number) => {
    const question = (followUpInputs[segIdx] || "").trim();
    if (!question) return;
    const seg = segments[segIdx];
    setInteractionLog((prev) => [...prev, { segIdx, action: "followup_asked", timestamp: Date.now() }]);
    setFollowUpLoading((prev) => ({ ...prev, [segIdx]: true }));
    setFollowUpInputs((prev) => ({ ...prev, [segIdx]: "" }));
    try {
      const answer = await fetchLowFollowUp(seg, question);
      setFollowUps((prev) => ({
        ...prev,
        [segIdx]: [{ question, answer }, ...(prev[segIdx] || [])],
      }));
    } finally {
      setFollowUpLoading((prev) => ({ ...prev, [segIdx]: false }));
    }
  }, [segments, followUpInputs]);

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
      <div className={`tl-content ${level === "low" ? "tl-content--stacked" : "tl-content--split"}`}>

        {/* ── Input area + Low mode output (shared) ── */}
        <div className={level === "low" ? "tl-stacked-inner" : "tl-left"}>
          <div className="tl-card">
            <label className="tl-label">English Input</label>


            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleTranslate(); }}
              placeholder="Type a professional email to translate…"
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

          {/* ──────── LOW MODE OUTPUT — Inline annotations ──────── */}
          {level === "low" && result && (
            <div className="tl-card">
              <label className="tl-label">Translation</label>
              <div className="tl-segment-list">
                {segments.map((seg, i) => (
                  <div key={i} className="tl-segment-wrapper">
                    <button
                      className={`tl-review-icon-btn ${reviewedSegments.has(i) ? "tl-review-icon-btn--checked" : ""}`}
                      onClick={() => toggleReview(i)}
                      aria-label={reviewedSegments.has(i) ? "Unmark as reviewed" : "Mark as reviewed"}
                    >
                      <span className="tl-review-icon" />
                    </button>
                    <div className="tl-segment-row">
                      <div className="tl-segment-korean">{seg.korean}</div>
                      <div className="tl-segment-bt">{seg.backTranslation}</div>
                      {seg.normAlignment && (
                        <div className="tl-segment-norm">{seg.normAlignment}</div>
                      )}
                      {/* Follow-up Q&A — always available */}
                      {(seg.normAlignment || followUpOpen[i]) ? (
                        <div className="tl-followup-area">
                          {followUpLoading[i] && (
                            <div className="tl-followup-loading">
                              <div className="tl-spinner" />
                              <span>Thinking…</span>
                            </div>
                          )}
                          {(followUps[i] || []).map((qa, qi) => (
                            <div key={qi} className="tl-followup-pair">
                              <div className="tl-followup-q">Q: {qa.question}</div>
                              <div className="tl-followup-a">{qa.answer}</div>
                            </div>
                          ))}
                          <div className="tl-followup-input-row">
                            <input
                              type="text"
                              className="tl-followup-input"
                              placeholder="Ask about this…"
                              value={followUpInputs[i] || ""}
                              onChange={(e) =>
                                setFollowUpInputs((prev) => ({ ...prev, [i]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleFollowUp(i);
                              }}
                              disabled={followUpLoading[i]}
                            />
                            <button
                              className="tl-followup-send"
                              onClick={() => handleFollowUp(i)}
                              disabled={followUpLoading[i] || !(followUpInputs[i] || "").trim()}
                            >
                              ↵
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="tl-followup-trigger"
                          onClick={() => setFollowUpOpen((prev) => ({ ...prev, [i]: true }))}
                        >
                          Have a question?
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
          )}

          {/* ──────── MID MODE — Left panel: Korean segments (select text to explore) ──────── */}
          {level === "mid" && result && (
            <div className="tl-card">
              <label className="tl-label">
                Korean Translation
                <span className="tl-label-hint"> — select a word to explore</span>
              </label>
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
                        {selectedPhrase && selectedPhrase.segIdx === i && seg.korean.includes(selectedPhrase.text) ? (
                          (() => {
                            const idx = seg.korean.indexOf(selectedPhrase.text);
                            return (
                              <>
                                {seg.korean.slice(0, idx)}
                                <mark className="tl-highlight">{selectedPhrase.text}</mark>
                                {seg.korean.slice(idx + selectedPhrase.text.length)}
                              </>
                            );
                          })()
                        ) : (
                          seg.korean
                        )}
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
                >
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
          )}
        </div>

        {/* ──────── Right panel: Mid mode features only ──────── */}
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

                {/* See alternatives — expandable */}
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
                          <div className="tl-alt-top">
                            <span className="tl-alt-korean">{alt.korean}</span>
                            <span className={`tl-formality-badge tl-formality--${alt.formality.replace(/\s+/g, "-")}`}>
                              {alt.formality}
                            </span>
                          </div>
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
                      {exploration && exploration.alternatives.length === 0 && (
                        <p className="tl-placeholder">No alternatives available.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* See grammar pattern — expandable */}
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
                      {exploration && exploration.grammarPatterns.length === 0 && (
                        <p className="tl-placeholder">No grammar patterns identified.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* See cultural context — expandable */}
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
                          {exploration.culturalContext || "No specific cultural notes for this expression."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
