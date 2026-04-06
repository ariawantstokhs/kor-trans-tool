import React, { useState } from 'react';
import { Loader2, Send, RotateCcw, X, ChevronRight } from 'lucide-react';
import {
  translate,
  analyze,
  alternativesAndTags,
  SCENARIOS,
  LANGUAGES,
  type Segment,
  type SegmentType,
  type DirectionTag,
  type Alternative,
  type LanguageConfig,
} from './api';

// ─── Color mapping ───

const TYPE_COLORS: Record<SegmentType, string> = {
  direct: 'bg-emerald-100 border-emerald-300',
  transformed: 'bg-amber-100 border-amber-300',
  cultural_adjustment: 'bg-blue-100 border-blue-300',
  added: 'bg-red-100 border-red-300',
  removed: 'bg-gray-100 border-gray-300 line-through opacity-60',
};

const TYPE_DOT: Record<SegmentType, string> = {
  direct: 'bg-emerald-500',
  transformed: 'bg-amber-500',
  cultural_adjustment: 'bg-blue-500',
  added: 'bg-red-500',
  removed: 'bg-gray-400',
};

const TYPE_LABELS: Record<SegmentType, string> = {
  direct: 'Direct',
  transformed: 'Transformed',
  cultural_adjustment: 'Cultural Adjustment',
  added: 'Added',
  removed: 'Removed',
};

const TYPE_EMOJI: Record<SegmentType, string> = {
  direct: '🟢',
  transformed: '🟡',
  cultural_adjustment: '🔵',
  added: '🔴',
  removed: '⚪',
};

// ─── App ───

type Phase = 'input' | 'loading' | 'result';

export function App() {
  // Input state
  const [emailText, setEmailText] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('ko');

  // Result state
  const [phase, setPhase] = useState<Phase>('input');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [fullKorean, setFullKorean] = useState('');
  const [alternatives, setAlternatives] = useState<Record<number, Alternative[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  function loadScenario(key: 'short' | 'long') {
    setEmailText(SCENARIOS[key].source);
  }

  async function handleTranslate() {
    if (!emailText.trim()) return;
    setPhase('loading');
    setError(null);

    try {
      const lang = LANGUAGES[selectedLang];

      // Call 1: Translate
      setLoadingStep('Translating...');
      const translation = await translate(emailText, lang);
      setFullKorean(translation);

      // Call 2: Analyze
      setLoadingStep('Analyzing translation...');
      const result2 = await analyze(emailText, translation, lang);

      // Call 3: Alternatives + Tags
      setLoadingStep('Generating alternatives & tagging...');
      const result3 = await alternativesAndTags(result2.segments, lang);

      // Apply tags to segments
      const taggedSegments = result2.segments.map((seg, i) => {
        const tag = result3.tags[String(i)];
        if (tag) return { ...seg, direction_tag: tag };
        return seg;
      });

      setSegments(taggedSegments);
      setAlternatives(result3.alternatives);
      setPhase('result');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setPhase('input');
    }
  }

  function handleReset() {
    setPhase('input');
    setSegments([]);
    setFullKorean('');
    setAlternatives({});
    setSelectedSegmentIdx(null);
    setError(null);
  }

  function handleSelectAlternative(segIdx: number, alt: Alternative) {
    setSegments(prev =>
      prev.map((seg, i) =>
        i === segIdx
          ? { ...seg, translated: alt.translated, back_translation: alt.back_translation }
          : seg
      )
    );
    setFullKorean(
      segments
        .map((seg, i) => (i === segIdx ? alt.translated : seg.translated))
        .filter(k => k)
        .join(' ')
    );
    setSelectedSegmentIdx(null);
  }

  // Summary counts
  const counts = segments.reduce(
    (acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Tag counts for cultural_adjustment segments
  const tagCounts = segments.reduce(
    (acc, s) => {
      if (s.type === 'cultural_adjustment' && s.direction_tag) {
        acc[s.direction_tag] = (acc[s.direction_tag] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  // ─── INPUT PHASE ───

  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Context Gap Visualizer</h1>
          <p className="text-slate-500 mb-6">
            See what changes when your English email crosses cultures
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Language</label>
              <select
                value={selectedLang}
                onChange={e => setSelectedLang(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <option key={code} value={code}>{lang.label}</option>
                ))}
              </select>
            </div>
            <div>
              <textarea
                className="w-full h-64 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Paste your English email here..."
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTranslate}
                disabled={!emailText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
                Translate
              </button>
              <button
                onClick={() => loadScenario('short')}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Short Example
              </button>
              <button
                onClick={() => loadScenario('long')}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Long Example
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LOADING PHASE ───

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 text-sm">{loadingStep}</p>
        </div>
      </div>
    );
  }

  // ─── RESULT PHASE ───

  const selectedSeg = selectedSegmentIdx !== null ? segments[selectedSegmentIdx] : null;
  const selectedAlts = selectedSegmentIdx !== null ? alternatives[selectedSegmentIdx] : null;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Context Gap Visualizer</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            {(['cultural_adjustment', 'transformed', 'added', 'direct'] as SegmentType[]).map(type => (
              counts[type] ? (
                <span key={type} className="flex items-center gap-1">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${TYPE_DOT[type]}`} />
                  {counts[type]} {TYPE_LABELS[type]}
                </span>
              ) : null
            ))}
            {Object.keys(tagCounts).length > 0 && (
              <>
                <span className="text-slate-300">|</span>
                {Object.entries(tagCounts).map(([tag, count]) => (
                  <span key={tag} className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                    {count} {tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={14} />
          Start Over
        </button>
      </header>

      {/* Legend */}
      <div className="flex-shrink-0 px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-5 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Legend:</span>
        {(['direct', 'transformed', 'cultural_adjustment', 'added', 'removed'] as SegmentType[]).map(type => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${TYPE_COLORS[type]}`}>
              {type === 'removed' ? 'abc' : 'Aa'}
            </span>
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Korean Translation with inline Back-translation */}
          <div className="p-6 h-full flex flex-col">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {LANGUAGES[selectedLang].label} Translation
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex-1 overflow-y-auto space-y-4">
              {(() => {
                // Group segments into sentences (split after sentence-ending punctuation)
                const sentences: Segment[][] = [];
                let current: Segment[] = [];
                segments.forEach((seg) => {
                  current.push(seg);
                  const text = seg.translated || seg.original_english || '';
                  if (/[.?!。]$/.test(text.trim())) {
                    sentences.push(current);
                    current = [];
                  }
                });
                if (current.length > 0) sentences.push(current);

                return sentences.map((sentence, si) => (
                  <div key={si} className="pb-3 border-b border-slate-100 last:border-b-0">
                    {/* Korean line */}
                    <div className="flex flex-wrap items-end gap-x-1 gap-y-1 mb-1.5">
                      {sentence.map((seg) => {
                        const idx = segments.indexOf(seg);
                        return (
                          <span
                            key={idx}
                            onClick={seg.type !== 'direct' ? () => setSelectedSegmentIdx(idx) : undefined}
                            className={`
                              inline rounded-md px-2 py-1 border transition-all
                              ${TYPE_COLORS[seg.type]}
                              ${seg.type !== 'direct' ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}
                              ${selectedSegmentIdx === idx ? 'ring-2 ring-blue-500' : ''}
                            `}
                          >
                            {seg.type === 'removed' ? seg.original_english : seg.translated}
                          </span>
                        );
                      })}
                    </div>
                    {/* Back-translation line */}
                    <p className="text-sm text-slate-500 pl-1">
                      {sentence.map(seg => seg.back_translation).filter(Boolean).join(' ')}
                    </p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Detail Panel (sidebar) - always visible */}
        <aside className="w-96 flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
          {selectedSeg && selectedSegmentIdx !== null ? (
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TYPE_EMOJI[selectedSeg.type]}</span>
                  <span className="text-sm font-semibold text-slate-800 uppercase">
                    {TYPE_LABELS[selectedSeg.type]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSegmentIdx(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Current segment — translated text */}
              <div className="mb-4">
                <p className="text-base text-slate-900">
                  {selectedSeg.type === 'removed' ? '(removed)' : selectedSeg.translated}
                </p>
              </div>

              {/* You wrote / This becomes */}
              {selectedSeg.type === 'cultural_adjustment' ? (
                <div className="mb-4 space-y-2">
                  {selectedSeg.original_english && (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-500">You wrote: </span>
                      "{selectedSeg.original_english}"
                    </p>
                  )}
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-500">This becomes: </span>
                    "{selectedSeg.back_translation}"
                  </p>
                </div>
              ) : (
                <>
                  {selectedSeg.original_english && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-500 mb-1">Original English</p>
                      <p className="text-sm text-slate-700">{selectedSeg.original_english}</p>
                    </div>
                  )}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">Back-translation</p>
                    <p className="text-sm text-slate-700 italic">{selectedSeg.back_translation}</p>
                  </div>
                </>
              )}

              {/* Why explanation */}
              {selectedSeg.why && (
                <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">{selectedSeg.why}</p>
                </div>
              )}

              {/* Direction tag badge (cultural_adjustment only) */}
              {selectedSeg.type === 'cultural_adjustment' && selectedSeg.direction_tag && (
                <div className="mb-5">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                    {selectedSeg.direction_tag}
                  </span>
                </div>
              )}

              {/* Alternatives spectrum (only for cultural_adjustment) */}
              {selectedSeg.type === 'cultural_adjustment' && selectedAlts && selectedAlts.length > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                    <span>Explicit</span>
                    <span>Implicit</span>
                  </div>
                  <div className="relative h-1 bg-gradient-to-r from-amber-200 via-slate-200 to-blue-200 rounded-full mb-3" />
                  <div className="space-y-2">
                    {selectedAlts.map((alt, ai) => (
                      <button
                        key={ai}
                        onClick={() => handleSelectAlternative(selectedSegmentIdx, alt)}
                        className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                      >
                        <p className="text-sm text-slate-900 mb-1">{alt.translated}</p>
                        <p className="text-xs text-slate-500 italic mb-1.5">{alt.back_translation}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                          <ChevronRight size={10} />
                          {alt.explicitness}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Explicitness spectrum for non-cultural_adjustment */}
              {selectedSeg.type !== 'cultural_adjustment' && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-slate-500 mb-2">Explicitness Spectrum</p>
                  <div className="relative h-2 bg-gradient-to-r from-amber-200 via-slate-200 to-blue-200 rounded-full">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-800 rounded-full border-2 border-white shadow"
                      style={{
                        left: selectedSeg.type === 'direct'
                          ? '50%'
                          : selectedSeg.type === 'added'
                          ? '85%'
                          : selectedSeg.type === 'removed'
                          ? '15%'
                          : '60%',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Explicit</span>
                    <span>Implicit</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-5">
              <p className="text-sm text-slate-400 text-center">
                Click a colored segment<br />to see details here
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
