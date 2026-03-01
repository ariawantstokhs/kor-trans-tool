import React, { useState, useRef, useEffect } from "react";
import { ProficiencyEngine, ProficiencyLevel, FeatureState } from "./proficiencyEngine";
import { getFeatureMatrix, createEngine } from "./proficiencyEngine";
import OpenAI from "openai";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranslationResult {
  korean: string;
  tokens: Token[];
  culturalFlags: CulturalFlag[];
  alternatives: Alternative[];
}

interface Token {
  id: string;
  text: string;
  hasExploration: boolean;
}

interface CulturalFlag {
  id: string;
  title: string;
  detail: string;
  severity: "note" | "caution";
}

interface Alternative {
  korean: string;
  formality: "formal" | "neutral" | "casual";
  nuance: string;
}

interface ExplorationResult {
  word: string;
  romanization: string;
  meaning: string;
  usageContext: string;
  grammarNote: string;
}

interface TranslationToolProps {
  engine: ProficiencyEngine;
  onChangeLevel: (level: ProficiencyLevel) => void;
}

// ─── API ────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: (import.meta as any).env.VITE_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", 
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1000,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content ?? "";
}


async function translateText(
  text: string,
  features: ProficiencyEngine["features"]
): Promise<TranslationResult> {
  const wantCultural = features.culturalContext !== "off";
  const wantAlternatives = features.alternatives !== "off";

  const systemPrompt = `You are a Korean translation assistant. 
Respond ONLY with valid JSON matching this exact shape:
{
  "korean": "<translated Korean text>",
  "tokens": [{ "id": "t1", "text": "<word or particle>", "hasExploration": true }],
  "culturalFlags": ${wantCultural ? '[{ "id": "c1", "title": "...", "detail": "...", "severity": "note" }]' : "[]"},
  "alternatives": ${wantAlternatives ? '[{ "korean": "...", "formality": "formal|neutral|casual", "nuance": "..." }]' : "[]"}
}
- tokens: split the Korean output into meaningful chunks (words/particles). Mark hasExploration true for words worth exploring.
- culturalFlags: flag genuine cultural/politeness nuances (max 3).
- alternatives: provide 2-3 variants with different formality levels.
- No markdown, no prose, pure JSON only.`;

  const raw = await callOpenAI(systemPrompt, `Translate to Korean: "${text}"`);
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { korean: raw, tokens: [{ id: "t0", text: raw, hasExploration: false }], culturalFlags: [], alternatives: [] };
  }
}

async function exploreWord(word: string, sentenceContext: string): Promise<ExplorationResult> {
  const systemPrompt = `You are a Korean language tutor. Respond ONLY with valid JSON:
{
  "word": "...",
  "romanization": "...",
  "meaning": "...",
  "usageContext": "...",
  "grammarNote": "..."
}`;
  const raw = await callOpenAI(systemPrompt, `Explain the Korean word "${word}" in this sentence: "${sentenceContext}"`);
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return { word, romanization: "", meaning: raw, usageContext: "", grammarNote: "" };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const FormalityBadge = ({ formality }: { formality: Alternative["formality"] }) => {
  const colors: Record<string, string> = {
    formal: "#4a7c59",
    neutral: "#7c6a4a",
    casual: "#7c4a5e",
  };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", padding: "2px 8px", borderRadius: 999,
      background: colors[formality] + "22", color: colors[formality], border: `1px solid ${colors[formality]}44`
    }}>
      {formality}
    </span>
  );
};

const FeaturePill = ({ state, label }: { state: FeatureState; label: string }) => {
  const colors = { on: "#4a7c59", partial: "#b07c2a", off: "#888" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, color: colors[state], padding: "3px 10px",
      borderRadius: 999, background: colors[state] + "18",
      border: `1px solid ${colors[state]}33`, fontWeight: 600
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors[state] }} />
      {label}: {state.toUpperCase()}
    </span>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const TranslationTool: React.FC<TranslationToolProps> = ({ engine, onChangeLevel }) => {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exploration, setExploration] = useState<ExplorationResult | null>(null);
  const [exploringWord, setExploringWord] = useState<string | null>(null);
  const [explorationLoading, setExplorationLoading] = useState(false);
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { features, level } = engine;

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult(null);
    setExploration(null);
    setExploringWord(null);
    setSelectedAlt(null);
    try {
      const res = await translateText(inputText, features);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  const handleWordTap = async (token: Token) => {
    if (features.onDemandExplore === "off" || !token.hasExploration || !result) return;
    setExploringWord(token.text);
    setExplorationLoading(true);
    setExploration(null);
    try {
      const res = await exploreWord(token.text, result.korean);
      setExploration(res);
    } finally {
      setExplorationLoading(false);
    }
  };

  const levels: ProficiencyLevel[] = ["low", "mid", "high"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f5efe8", fontFamily: "'Georgia', serif" }}>

      {/* ── Top bar ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", background: "#fff", borderBottom: "1px solid #e8ddd4",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #ffb76b, #ff7f50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16 }}>한</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#2b1a11", letterSpacing: "-0.01em" }}>KoreanBridge</span>
        </div>

        {/* Dev toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#999", fontFamily: "monospace", background: "#f0e8e0", padding: "2px 8px", borderRadius: 4 }}>DEV</span>
          {levels.map((l) => (
            <button key={l} onClick={() => onChangeLevel(l)} style={{
              padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
              fontFamily: "'Georgia', serif", cursor: "pointer", border: "none",
              background: level === l ? "#2b1a11" : "#f0e8e0",
              color: level === l ? "#fff" : "#7b6a5c",
              transition: "all 0.15s ease"
            }}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
          <span style={{ fontSize: 12, color: "#b29b87", marginLeft: 4 }}>proficiency</span>
        </div>

        {/* Active features */}
        <div style={{ display: "flex", gap: 6 }}>
          <FeaturePill state={features.culturalContext} label="F3" />
          <FeaturePill state={features.onDemandExplore} label="F4" />
          <FeaturePill state={features.alternatives} label="F5" />
        </div>
      </header>

      {/* ── Split panel ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: Input + Output */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 28, gap: 20, overflowY: "auto", borderRight: "1px solid #e8ddd4" }}>

          {/* Input */}
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b29b87", display: "block", marginBottom: 10 }}>
              English Input
            </label>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleTranslate(); }}
              placeholder="Type something to translate..."
              rows={4}
              style={{
                width: "100%", border: "none", outline: "none", resize: "none",
                fontSize: 16, lineHeight: 1.6, color: "#2b1a11", fontFamily: "'Georgia', serif",
                background: "transparent"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={handleTranslate} disabled={loading || !inputText.trim()} style={{
                background: loading ? "#ccc" : "#2b1a11", color: "#fff",
                border: "none", borderRadius: 999, padding: "10px 24px",
                fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Georgia', serif", transition: "background 0.15s ease"
              }}>
                {loading ? "Translating…" : "Translate ↵"}
              </button>
            </div>
          </div>

          {/* Korean output */}
          {result && (
            <div style={{ background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b29b87", display: "block", marginBottom: 12 }}>
                Korean Output
                {features.onDemandExplore !== "off" && (
                  <span style={{ marginLeft: 8, fontWeight: 400, textTransform: "none", fontSize: 11, color: "#c4a882" }}>
                    — tap a word to explore
                  </span>
                )}
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 26, lineHeight: 1.8 }}>
                {result.tokens.map((token) => {
                  const canTap = features.onDemandExplore !== "off" && token.hasExploration;
                  const isActive = exploringWord === token.text;
                  return (
                    <span
                      key={token.id}
                      onClick={() => handleWordTap(token)}
                      style={{
                        cursor: canTap ? "pointer" : "default",
                        borderRadius: 6, padding: "0 3px",
                        background: isActive ? "#ff8a5c22" : canTap ? "transparent" : "transparent",
                        borderBottom: canTap ? "2px solid #ff8a5c66" : "2px solid transparent",
                        color: isActive ? "#ff6b35" : "#2b1a11",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {token.text}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected alternative display */}
          {result && selectedAlt !== null && features.alternatives !== "off" && (
            <div style={{ background: "#fff8f0", borderRadius: 16, padding: 18, border: "1px solid #ffd4a8" }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b29b87", display: "block", marginBottom: 8 }}>
                Selected Alternative
              </label>
              <div style={{ fontSize: 22, color: "#2b1a11" }}>
                {result.alternatives[selectedAlt]?.korean}
              </div>
            </div>
          )}
        </div>

        {/* Right: Feature panel */}
        <div
          style={{
            width: 360,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            overflowY: "auto",
            background: "rgb(255, 219, 180)",
          }}
        >
          {/* F3: Cultural Context */} 
          {features.culturalContext !== "off" && (
            <div style={{ padding: 24, borderBottom: "1px solid #907c6c" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🏮</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#2b1a11" }}>Cultural Context</span>
                {features.culturalContext === "partial" && (
                  <span style={{ fontSize: 10, color: "#b07c2a", background: "#b07c2a18", padding: "1px 7px", borderRadius: 999, fontWeight: 600 }}>PARTIAL</span>
                )}
              </div>
              {!result && (
                <p style={{ fontSize: 13, color: "#2b1a11", margin: 0, fontStyle: "italic" }}>
                  Cultural flags will appear here after translation.
                </p>
              )}
              {result && result.culturalFlags.length === 0 && (
                <p style={{ fontSize: 13, color: "#2b1a11", margin: 0 }}>✓ No cultural issues flagged.</p>
              )}
              {result && result.culturalFlags.map((flag) => (
                <div key={flag.id} style={{
                  background: flag.severity === "caution" ? "#fff3e0" : "#f0f7f2",
                  borderLeft: `3px solid ${flag.severity === "caution" ? "#ff9800" : "#4a7c59"}`,
                  borderRadius: "0 10px 10px 0", padding: "10px 14px", marginBottom: 10
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#2b1a11", marginBottom: 4 }}>
                    {flag.severity === "caution" ? "⚠️" : "ℹ️"} {flag.title}
                  </div>
                  {features.culturalContext !== "partial" && (
                    <div style={{ fontSize: 12, color: "#5a4a3a", lineHeight: 1.5 }}>{flag.detail}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* F4: On-demand Exploration */}
          {features.onDemandExplore !== "off" && (
            <div style={{ padding: 24, borderBottom: "1px solid #907c6c" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>🔍</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#2b1a11" }}>Word Exploration</span>
              </div>
              {!exploringWord && (
                <p style={{ fontSize: 13, color: "#2b1a11", margin: 0, fontStyle: "italic" }}>
                  Tap an underlined word in the Korean output to explore it.
                </p>
              )}
              {explorationLoading && (
                <div style={{ fontSize: 13, color: "#2b1a11", fontStyle: "italic" }}>Exploring "{exploringWord}"…</div>
              )}
              {exploration && !explorationLoading && (
                <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#2b1a11" }}>{exploration.word}</span>
                    <span style={{ fontSize: 14, color: "#2b1a11" }}>{exploration.romanization}</span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b1a11", marginBottom: 3 }}>Meaning</div>
                    <div style={{ fontSize: 13, color: "#2b1a11" }}>{exploration.meaning}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b1a11", marginBottom: 3 }}>Usage Context</div>
                    <div style={{ fontSize: 13, color: "#2b1a11" }}>{exploration.usageContext}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b1a11", marginBottom: 3 }}>Grammar Note</div>
                    <div style={{ fontSize: 13, color: "#2b1a11" }}>{exploration.grammarNote}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* F5: Alternatives */}
          {features.alternatives !== "off" && (
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#907c6c" }}>
                <span style={{ fontSize: 18 }}>↔️</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#2b1a11" }}>Alternative Expressions</span>
                {features.alternatives === "partial" && (
                  <span style={{ fontSize: 10, color: "#b07c2a", background: "#b07c2a18", padding: "1px 7px", borderRadius: 999, fontWeight: 600 }}>PARTIAL</span>
                )}
              </div>
              {!result && (
                <p style={{ fontSize: 13, color: "#2b1a11", margin: 0, fontStyle: "italic" }}>
                  Alternatives will appear here after translation.
                </p>
              )}
              {result && result.alternatives.length === 0 && (
                <p style={{ fontSize: 13, color: "#2b1a11", margin: 0 }}>No alternatives generated.</p>
              )}
              {result && result.alternatives.map((alt, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedAlt(selectedAlt === i ? null : i)}
                  style={{
                    background: selectedAlt === i ? "#fff3e8" : "#fff",
                    border: `1px solid ${selectedAlt === i ? "#ffb76b" : "#ede3da"}`,
                    borderRadius: 14, padding: "12px 16px", marginBottom: 10,
                    cursor: "pointer", transition: "all 0.15s ease",
                    boxShadow: selectedAlt === i ? "0 4px 16px rgba(255,138,92,0.15)" : "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <FormalityBadge formality={alt.formality} />
                    {selectedAlt === i && <span style={{ fontSize: 11, color: "#ff8a5c" }}>✓ selected</span>}
                  </div>
                  <div style={{ fontSize: 18, color: "#2b1a11", marginBottom: 4 }}>{alt.korean}</div>
                  {features.alternatives !== "partial" && (
                    <div style={{ fontSize: 12, color: "#2b1a11" }}>{alt.nuance}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state when all features are off */}
          {features.culturalContext === "off" && features.onDemandExplore === "off" && features.alternatives === "off" && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔇</div>
              <div style={{ fontSize: 14, color: "#b29b87" }}>All features are off at this proficiency level.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
