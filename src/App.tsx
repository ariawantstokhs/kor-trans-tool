import React, { useState } from 'react';
import { Loader2, Send, RotateCcw, X, ChevronRight } from 'lucide-react';
import {
  translateAndAnnotate,
  backTranslate,
  generateAlternatives,
  SCENARIOS,
  type Segment,
  type SegmentType,
  type Alternative,
} from './api';

// ─── Color mapping ───

const TYPE_COLORS: Record<SegmentType, string> = {
  direct: 'bg-emerald-100 border-emerald-300',
  transformed: 'bg-amber-100 border-amber-300',
  added: 'bg-red-100 border-red-300',
  removed: 'bg-gray-100 border-gray-300 line-through opacity-60',
};

const TYPE_DOT: Record<SegmentType, string> = {
  direct: 'bg-emerald-500',
  transformed: 'bg-amber-500',
  added: 'bg-red-500',
  removed: 'bg-gray-400',
};

const TYPE_LABELS: Record<SegmentType, string> = {
  direct: 'Direct',
  transformed: 'Transformed',
  added: 'Added',
  removed: 'Removed',
};

// ─── App ───

type Phase = 'input' | 'loading' | 'result';

export function App() {
  // Input state
  const [emailText, setEmailText] = useState('');
  const [recipient, setRecipient] = useState('');
  const [relationship, setRelationship] = useState('');
  const [situation, setSituation] = useState('');

  // Result state
  const [phase, setPhase] = useState<Phase>('input');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [fullKorean, setFullKorean] = useState('');
  const [alternatives, setAlternatives] = useState<Record<number, Alternative[]>>({});
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  function loadScenario() {
    const s = SCENARIOS.scenarioA;
    setEmailText(s.source);
    setRecipient(s.context.recipient);
    setRelationship(s.context.relationship);
    setSituation(s.context.situation);
  }

  async function handleTranslate() {
    if (!emailText.trim()) return;
    setPhase('loading');
    setError(null);

    try {
      // Call 1
      setLoadingStep('Translating & annotating...');
      const result1 = await translateAndAnnotate(emailText, recipient, relationship, situation);
      setFullKorean(result1.full_korean);

      // Call 2
      setLoadingStep('Back-translating...');
      const updatedSegments = await backTranslate(result1.segments);

      // Call 3
      setLoadingStep('Generating alternatives...');
      const result3 = await generateAlternatives(
        updatedSegments,
        emailText,
        recipient,
        relationship,
        situation
      );

      setSegments(updatedSegments);
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
          ? { ...seg, korean: alt.korean, back_translation: alt.back_translation }
          : seg
      )
    );
    setFullKorean(
      segments
        .map((seg, i) => (i === segIdx ? alt.korean : seg.korean))
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

  // ─── INPUT PHASE ───

  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Context Gap Visualizer</h1>
          <p className="text-slate-500 mb-6">
            See what changes when your English email becomes Korean
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">English Email</label>
              <textarea
                className="w-full h-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Paste your English email here..."
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Recipient</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Professor Kim"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. student to professor"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Situation</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. budget follow-up"
                  value={situation}
                  onChange={e => setSituation(e.target.value)}
                />
              </div>
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
                onClick={loadScenario}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Load Example
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Context Gap Visualizer</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
            {(['transformed', 'added', 'removed', 'direct'] as SegmentType[]).map(type => (
              counts[type] ? (
                <span key={type} className="flex items-center gap-1">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${TYPE_DOT[type]}`} />
                  {counts[type]} {TYPE_LABELS[type]}
                </span>
              ) : null
            ))}
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
      <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-5 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Legend:</span>
        {(['direct', 'transformed', 'added', 'removed'] as SegmentType[]).map(type => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${TYPE_COLORS[type]}`}>
              {type === 'removed' ? 'abc' : 'Aa'}
            </span>
            {TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className="flex">
        {/* Main content area */}
        <div className={`flex-1 transition-all ${selectedSegmentIdx !== null ? 'mr-96' : ''}`}>
          {/* Korean Translation (Main View) */}
          <section className="px-6 py-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Korean Translation
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-5 leading-relaxed text-base">
              {segments.map((seg, i) => (
                <span
                  key={i}
                  onClick={seg.type !== 'direct' ? () => setSelectedSegmentIdx(i) : undefined}
                  className={`
                    inline rounded px-1 py-0.5 border transition-all
                    ${TYPE_COLORS[seg.type]}
                    ${seg.type !== 'direct' ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}
                    ${selectedSegmentIdx === i ? 'ring-2 ring-blue-500' : ''}
                  `}
                >
                  {seg.type === 'removed' ? seg.original_english : seg.korean}
                </span>
              ))}
            </div>
          </section>

          {/* Back-translation Panel */}
          <section className="px-6 pb-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Back-Translation (what it actually says)
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-5 leading-relaxed text-base">
              {segments.map((seg, i) => (
                <span
                  key={i}
                  onClick={seg.type !== 'direct' ? () => setSelectedSegmentIdx(i) : undefined}
                  className={`
                    inline rounded px-1 py-0.5 border transition-all
                    ${TYPE_COLORS[seg.type]}
                    ${seg.type !== 'direct' ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}
                    ${selectedSegmentIdx === i ? 'ring-2 ring-blue-500' : ''}
                  `}
                >
                  {seg.back_translation}
                </span>
              ))}
            </div>
          </section>

          {/* Original English (reference) */}
          <section className="px-6 pb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Original English
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-slate-600 text-sm leading-relaxed">
              {emailText}
            </div>
          </section>
        </div>

        {/* Detail Panel (sidebar) */}
        {selectedSeg && selectedSegmentIdx !== null && (
          <aside className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-lg z-40 overflow-y-auto">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${TYPE_DOT[selectedSeg.type]}`} />
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

              {/* Current segment */}
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-1">Korean</p>
                <p className="text-base text-slate-900">
                  {selectedSeg.type === 'removed' ? '(removed)' : selectedSeg.korean}
                </p>
              </div>

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

              {/* Why explanation */}
              {selectedSeg.why && (
                <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Why this change?</p>
                  <p className="text-sm text-blue-900">{selectedSeg.why}</p>
                </div>
              )}

              {/* Explicitness spectrum */}
              <div className="mb-5">
                <p className="text-xs font-medium text-slate-500 mb-2">Explicitness Spectrum</p>
                <div className="relative h-2 bg-gradient-to-r from-blue-200 via-slate-200 to-amber-200 rounded-full">
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
                  <span>Low-context (English)</span>
                  <span>High-context (Korean)</span>
                </div>
              </div>

              {/* Alternatives */}
              {selectedAlts && selectedAlts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Alternatives
                  </p>
                  <div className="space-y-2">
                    {selectedAlts.map((alt, ai) => (
                      <button
                        key={ai}
                        onClick={() => handleSelectAlternative(selectedSegmentIdx, alt)}
                        className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                      >
                        <p className="text-sm text-slate-900 mb-1">{alt.korean}</p>
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
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
