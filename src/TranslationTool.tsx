import React, { useState, useRef, useCallback } from "react";
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
  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
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
  } catch {
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

// ── Call 3: Exploration Data (Mid only, on-demand) ──

async function fetchExploration(
  koreanSegment: string,
  fullContext: string,
  originalEnglish: string
): Promise<ExplorationResult> {
  const systemPrompt = `You are a Korean language tutor. The user has tapped a segment of a Korean translation to learn more.
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
  "cultural_context": "<1-2 sentences about cultural/social norms relevant to this specific segment>"
}

Rules:
- alternatives: 2-3 alternative ways to express the same idea with different formality/nuance. Present as OPTIONS, not corrections.
- grammar_patterns: 1-2 reusable grammar patterns from this expression with examples.
- cultural_context: segment-specific cultural norm (formality, honorifics, social appropriateness).
- Use the original English and communicative context as background to inform your analysis, but keep explanations focused on the Korean segment.
- All explanations in English. No markdown, pure JSON only.`;

  const raw = await callOpenAI(
    systemPrompt,
    `Explain this Korean segment: "${koreanSegment}"\nFull sentence context: "${fullContext}"\nOriginal English context: "${originalEnglish}"`
  );
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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [exploration, setExploration] = useState<ExplorationResult | null>(null);
  const [explorationLoading, setExplorationLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Low follow-up state
  const [followUps, setFollowUps] = useState<Record<number, FollowUpQA[]>>({});
  const [followUpLoading, setFollowUpLoading] = useState<Record<number, boolean>>({});
  const [followUpInputs, setFollowUpInputs] = useState<Record<number, string>>({});
  const [followUpOpen, setFollowUpOpen] = useState<Record<number, boolean>>({});

  // Segment review state
  const [reviewedSegments, setReviewedSegments] = useState<Set<number>>(new Set());
  const [interactionLog, setInteractionLog] = useState<Array<{ segIdx: number; action: string; timestamp: number }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { features, level } = engine;

  // ── Handlers ──

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    setSegments([]);
    setSelectedIdx(null);
    setExploration(null);
    setExpandedSections(new Set());
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

  const handleSegmentTap = async (idx: number) => {
    if (level === "low") return; // No interactivity in low mode
    setSelectedIdx(idx);
    setExploration(null);
    setExpandedSections(new Set());
  };

  const handleFetchExploration = async () => {
    if (selectedIdx === null || !result) return;
    const seg = segments[selectedIdx];
    setInteractionLog((prev) => [...prev, { segIdx: selectedIdx, action: "exploration_opened", timestamp: Date.now() }]);
    setExplorationLoading(true);
    try {
      const res = await fetchExploration(
        seg.korean,
        segments.map((s) => s.korean).join(" "),
        inputText
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
    if (selectedIdx === null) return;
    setSegments((prev) => {
      const next = [...prev];
      next[selectedIdx] = { ...next[selectedIdx], korean: altKorean };
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

          {/* ──────── MID MODE — Left panel: Korean segments ──────── */}
          {level === "mid" && result && (
            <div className="tl-card">
              <label className="tl-label">
                Korean Translation
                <span className="tl-label-hint"> — tap a sentence to explore</span>
              </label>
              <div className="tl-sentences">
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
                      className={`tl-sentence tl-sentence--interactive ${selectedIdx === i ? "tl-sentence--selected" : ""}`}
                      onClick={() => handleSegmentTap(i)}
                    >
                      <div className="tl-korean">{seg.korean}</div>
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
        </div>

        {/* ──────── Right panel: Mid mode features only ──────── */}
        {level === "mid" && (
          <div className="tl-right">
            {/* ── MID MODE: Exploration panel ── */}
            {level === "mid" && !result && (
              <div className="tl-empty-state">
                <div className="tl-empty-icon">↵</div>
                <div>Translate text to explore features</div>
              </div>
            )}

            {level === "mid" && result && selectedIdx === null && (
              <div className="tl-empty-state">
                <div className="tl-empty-icon">←</div>
                <div>Tap a Korean sentence to explore it</div>
              </div>
            )}

            {level === "mid" && result && selectedIdx !== null && (
              <div className="tl-feature-panel">
                {/* Back-translation — always shown automatically */}
                <div className="tl-fp-section tl-fp-section--bt">
                  <div className="tl-fp-section-header">
                    <span className="tl-fp-section-icon">↩</span>
                    <span className="tl-fp-section-title">Back-translation</span>
                  </div>
                  <div className="tl-fp-section-body">
                    <p className="tl-fp-bt-text">{segments[selectedIdx].backTranslation}</p>
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
                          {exploration.culturalContext || "No specific cultural notes for this segment."}
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
