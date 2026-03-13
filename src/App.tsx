import React, { useState, useEffect } from 'react';
import {
  generateOptionsForSentence,
  splitSentences,
  SCENARIOS,
  SentenceOption,
} from './api';
import {
  Sparkles, IterationCw, TriangleAlert,
  MessageSquare, Copy, RefreshCcw, ArrowRight, Play,
} from 'lucide-react';
import { cx } from './utils';
import { RoadMap } from './RoadMap';

type Phase = 'INPUT' | 'NAVIGATING' | 'ARRIVAL';

export function App() {
  const [inputText, setInputText] = useState(SCENARIOS.scenarioA.source);
  const [scenario, setScenario] = useState<'A' | 'custom'>('A');
  const [toneAdjustment, setToneAdjustment] = useState('');

  const [phase, setPhase] = useState<Phase>('INPUT');
  const [error, setError] = useState<string | null>(null);

  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentOptions, setCurrentOptions] = useState<SentenceOption[]>([]);
  const [confirmedKorean, setConfirmedKorean] = useState<string[]>([]);
  const [confirmedChoices, setConfirmedChoices] = useState<SentenceOption[]>([]);

  const [culturalNote, setCulturalNote] = useState<string | null>(null);
  const [pragmaticIntent, setPragmaticIntent] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<SentenceOption | null>(null);
  const [previewOption, setPreviewOption] = useState<SentenceOption | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);

  useEffect(() => {
    handleLoadScenario('A');
  }, []);

  const resetState = () => {
    setPhase('INPUT');
    setSentences([]);
    setCurrentIndex(0);
    setCurrentOptions([]);
    setConfirmedKorean([]);
    setConfirmedChoices([]);
    setSelectedOption(null);
    setPreviewOption(null);
    setCulturalNote(null);
    setPragmaticIntent(null);
    setError(null);
  };

  const handleLoadScenario = (s: 'A') => {
    setScenario(s);
    setInputText(SCENARIOS.scenarioA.source);
    resetState();
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScenario('custom');
    setInputText(e.target.value);
  };

  // Auto-select the single option when there's only one
  useEffect(() => {
    if (phase !== 'NAVIGATING' || isGeneratingOptions || currentOptions.length !== 1) return;
    setSelectedOption(currentOptions[0]);
  }, [currentOptions, isGeneratingOptions, phase]);

  const handleStart = async () => {
    if (!inputText.trim()) return;
    setIsStarting(true);
    setError(null);

    const newSentences = splitSentences(inputText);
    setSentences(newSentences);
    setCurrentIndex(0);
    setConfirmedKorean([]);
    setConfirmedChoices([]);
    setSelectedOption(null);
    setPreviewOption(null);
    setCurrentOptions([]);

    try {
      setIsGeneratingOptions(true);
      const { options, cultural_note, pragmatic_intent } = await generateOptionsForSentence(newSentences[0], inputText, [], toneAdjustment);
      setCurrentOptions(options);
      setCulturalNote(cultural_note ?? null);
      setPragmaticIntent(pragmatic_intent ?? null);
      setPhase('NAVIGATING');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate options.');
    } finally {
      setIsStarting(false);
      setIsGeneratingOptions(false);
    }
  };

  const handleOptionClick = (opt: SentenceOption) => {
    setPreviewOption(opt);
    setSelectedOption(opt);
  };

  const handleDriveNext = async () => {
    if (!selectedOption) return;

    const newKorean = [...confirmedKorean, selectedOption.korean];
    const newChoices = [...confirmedChoices, selectedOption];
    setConfirmedKorean(newKorean);
    setConfirmedChoices(newChoices);
    setSelectedOption(null);
    setPreviewOption(null);
    setCurrentOptions([]);
    setCulturalNote(null);
    setPragmaticIntent(null);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= sentences.length) {
      setPhase('ARRIVAL');
      return;
    }

    setCurrentIndex(nextIndex);
    setIsGeneratingOptions(true);
    try {
      const { options, cultural_note, pragmatic_intent } = await generateOptionsForSentence(
        sentences[nextIndex],
        inputText,
        newKorean,
        toneAdjustment
      );
      setCurrentOptions(options);
      setCulturalNote(cultural_note ?? null);
      setPragmaticIntent(pragmatic_intent ?? null);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate options.');
    } finally {
      setIsGeneratingOptions(false);
    }
  };

  const handleEditRoute = (index: number) => {
    const trimmedKorean = confirmedKorean.slice(0, index);
    setCurrentIndex(index);
    setConfirmedKorean(trimmedKorean);
    setConfirmedChoices(confirmedChoices.slice(0, index));
    setSelectedOption(null);
    setPreviewOption(null);
    setCurrentOptions([]);
    setPhase('NAVIGATING');

    setIsGeneratingOptions(true);
    generateOptionsForSentence(sentences[index], inputText, trimmedKorean, toneAdjustment)
      .then(({ options, cultural_note, pragmatic_intent }) => { setCurrentOptions(options); setCulturalNote(cultural_note ?? null); setPragmaticIntent(pragmatic_intent ?? null); })
      .catch(err => setError(err?.message || 'Failed.'))
      .finally(() => setIsGeneratingOptions(false));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(confirmedKorean.join('\n\n'));
    alert('Copied to clipboard!');
  };

  const totalSentences = sentences.length;
  const isMultipleOptions = currentOptions.length > 1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-200 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-30 transition-all">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-2 rounded-xl text-white shadow-md shadow-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">KorTrans Builder</h1>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dynamic Turn-by-Turn GPS</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLoadScenario('A')}
              className={cx("px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300", scenario === 'A' ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              Scenario A
            </button>
            <button
              onClick={() => { setScenario('custom'); setInputText(''); resetState(); }}
              className={cx("px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300", scenario === 'custom' ? "bg-slate-900 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              Custom
            </button>
          </div>
        </div>

        {phase === 'NAVIGATING' && sentences.length > 0 && (
          <RoadMap
            totalNodes={totalSentences}
            currentNodeIndex={currentIndex}
            phase={phase}
          />
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-start">

        {error && (
          <div className="w-full max-w-2xl mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Phase: INPUT */}
        {phase === 'INPUT' && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-10 max-w-lg">
              <h2 className="text-4xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 leading-tight">
                Craft the Perfect Message
              </h2>
              <p className="text-slate-500 text-[15px] leading-relaxed font-medium">
                Drop your English draft below to start the turn-by-turn Korean translation process.
              </p>
            </div>

            <section className="w-full bg-white p-2 rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 relative overflow-hidden group transition-all ring-1 ring-black/5 focus-within:ring-blue-500/20 focus-within:shadow-blue-500/10 hover:shadow-2xl hover:shadow-black/[0.03]">
              <div className="bg-slate-50/50 rounded-3xl p-6 transition-colors group-focus-within:bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Original English Draft</h3>
                </div>
                <textarea
                  className="w-full h-48 resize-none bg-transparent text-[16px] leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none transition-colors border-none p-0 focus:ring-0"
                  value={inputText}
                  onChange={handleCustomInput}
                  placeholder="Drop your English text here to start translating..."
                />
              </div>

              <div className="px-6 py-4 flex justify-between items-center bg-white rounded-b-3xl gap-4">
                <input
                  type="text"
                  placeholder="Tone note (optional): e.g., 'Actually this is to a peer'"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 focus:bg-white transition-colors text-slate-700 text-sm"
                  value={toneAdjustment}
                  onChange={(e) => setToneAdjustment(e.target.value)}
                />
                <button
                  onClick={handleStart}
                  disabled={isStarting || !inputText.trim()}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shrink-0 tracking-wide"
                >
                  {isStarting ? (
                    <><IterationCw className="w-4 h-4 animate-spin text-slate-400" /> Loading...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 text-amber-300" /> Start Translation</>
                  )}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Phase: NAVIGATING */}
        {phase === 'NAVIGATING' && sentences.length > 0 && (
          <div className="w-full h-[65vh] min-h-[500px] mt-4 relative bg-[#EEEEE8] rounded-[2rem] overflow-hidden border border-slate-200/60 shadow-xl animate-in fade-in zoom-in-95 duration-500 flex flex-col justify-end ring-1 ring-black/5">

            {/* Map background grid */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(#6b7280 1px, transparent 1px), linear-gradient(to right, #6b7280 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.04), transparent)' }} />

            {/* Dynamic Map Area */}
            <div className={cx(
              "absolute inset-0 flex flex-col justify-end items-center pb-[180px] transition-all duration-500 ease-in-out",
              previewOption ? "opacity-30 blur-[1px]" : ""
            )}>

              {/* Road SVG */}
              <div className="absolute inset-x-0 bottom-[140px] top-0 pointer-events-none flex justify-center">
                <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
                  {(() => {
                    const count = currentOptions.length;
                    const selectedIdx = currentOptions.findIndex(o => o.name === selectedOption?.name);

                    const Road = ({ d, selected, isMain }: { d: string; selected?: boolean; isMain?: boolean }) => (
                      <>
                        <path d={d} fill="none" stroke={isMain ? "#1e3a5f" : selected ? "#1e3a5f" : "#6B7280"} strokeWidth={isMain ? "22" : "20"} strokeLinecap="round" />
                        <path d={d} fill="none" stroke={isMain ? "#2563EB" : selected ? "#3B82F6" : "#9CA3AF"} strokeWidth={isMain ? "16" : "14"} strokeLinecap="round" />
                        <path d={d} fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="18 12" strokeLinecap="round" opacity={isMain ? "0.8" : selected ? "0.9" : "0.5"} />
                      </>
                    );

                    if (count === 1) {
                      // Straight road, no junction
                      return <Road d="M500,600 L500,80" isMain />;
                    }

                    if (count === 3) {
                      const jY = 400, cY = 110, lX = 140, rX = 860;
                      const paths = [
                        `M500,${jY} L${lX},${jY}`,
                        `M500,${jY} L500,${cY}`,
                        `M500,${jY} L${rX},${jY}`,
                      ];
                      return (
                        <>
                          <Road d={`M500,600 L500,${jY}`} isMain />
                          {paths.map((d, i) => <Road key={i} d={d} selected={selectedIdx === i} />)}
                          <circle cx="500" cy={jY} r="20" fill="#F59E0B" opacity="0.25">
                            <animate attributeName="r" values="16;26;16" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <circle cx="500" cy={jY} r="12" fill="#F59E0B" stroke="#FDE68A" strokeWidth="4" />
                          <circle cx="500" cy={jY} r="5" fill="white" />
                        </>
                      );
                    }

                    // 2 options
                    const jY = 380, tipY = 160;
                    const tips = [270, 730];
                    return (
                      <>
                        <Road d={`M500,600 L500,${jY}`} isMain />
                        {tips.map((tX, i) => (
                          <Road key={i} d={`M500,${jY} C500,${jY - 80} ${tX},${tipY + 60} ${tX},${tipY}`} selected={selectedIdx === i} />
                        ))}
                        <circle cx="500" cy={jY} r="20" fill="#1D4ED8" opacity="0.25">
                          <animate attributeName="r" values="16;26;16" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="500" cy={jY} r="12" fill="#1D4ED8" stroke="#BFDBFE" strokeWidth="4" />
                        <circle cx="500" cy={jY} r="5" fill="white" />
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Loading badge */}
              {isGeneratingOptions && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/60 flex items-center gap-3">
                    <IterationCw className="w-5 h-5 text-blue-500 animate-spin" />
                    <p className="font-bold text-slate-700 text-sm">Calculating route options...</p>
                  </div>
                </div>
              )}

              {/* Option cards */}
              <div className="absolute inset-0 pointer-events-none">
                {currentOptions.map((opt, idx, arr) => {
                  const count = arr.length;
                  let cardLeft = '50%', cardTop = '28%';
                  if (count === 3) {
                    if (idx === 0) { cardLeft = '15%'; cardTop = '55%'; }
                    else if (idx === 1) { cardLeft = '50%'; cardTop = '18%'; }
                    else { cardLeft = '85%'; cardTop = '55%'; }
                  } else if (count === 2) {
                    cardLeft = idx === 0 ? '27%' : '73%';
                    cardTop = '26%';
                  } else {
                    // 1 option — center
                    cardLeft = '50%'; cardTop = '30%';
                  }

                  const isSelected = selectedOption?.name === opt.name;

                  return (
                    <button
                      key={`card-${idx}`}
                      onClick={() => handleOptionClick(opt)}
                      disabled={isGeneratingOptions}
                      className={cx(
                        "absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto text-left transition-all duration-200 outline-none group",
                        isSelected ? "scale-[1.03] z-30" : "scale-100 z-10 hover:scale-[1.02]",
                      )}
                      style={{ left: cardLeft, top: cardTop }}
                    >
                      <div className={cx(
                        "bg-white border rounded-2xl p-4 w-[255px] shadow-sm transition-all",
                        isSelected
                          ? "border-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-2 ring-blue-400/20"
                          : "border-slate-200 group-hover:border-slate-300 group-hover:shadow-md"
                      )}>
                        <div className="flex items-start gap-2 mb-2.5">
                          <span className="text-xl leading-none mt-0.5 shrink-0">{opt.icon}</span>
                          <div className="min-w-0">
                            <p className={cx("text-[13.5px] font-bold leading-tight", isSelected ? "text-blue-700" : "text-slate-800")}>{opt.name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-slate-100 pt-2">
                          <p className="text-[12px] leading-[1.5] text-slate-400">{opt.description}</p>
                          <div className={cx(
                            "rounded-lg px-2.5 py-2 border",
                            isSelected ? "bg-blue-50 border-blue-100" : "bg-slate-50 border-slate-100"
                          )}>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">EN Preview</span>
                            <p className={cx("text-[12px] font-medium leading-snug italic", isSelected ? "text-blue-700" : "text-slate-600")}>
                              "{opt.back_translation}"
                            </p>
                          </div>
                          {isSelected && opt.korean && (
                            <p className="text-[11.5px] font-bold leading-[1.4] py-1.5 px-2 bg-blue-50 rounded-lg text-blue-700 mt-1 border border-blue-100">
                              {opt.korean}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Car puck */}
              <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-full shadow-[0_4px_16px_rgba(59,130,246,0.5)] border-[3px] border-white flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[11px] border-l-transparent border-r-transparent border-b-white mb-0.5" />
                </div>
                <div className="w-3 h-3 rounded-full bg-blue-600/20 mt-[-4px]" />
              </div>
            </div>

            {/* Preview overlay */}
            {selectedOption && previewOption && currentOptions.length > 1 && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px]" onClick={() => { setPreviewOption(null); setSelectedOption(null); }} />
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-200 w-full max-w-lg relative z-10">
                  <h4 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Selected Route
                  </h4>
                  <div className="mb-8">
                    <p className="text-2xl font-semibold text-slate-900 leading-snug mb-5 tracking-tight">
                      "{previewOption.back_translation}"
                    </p>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">KOR</span>
                      <p className="text-[15px] text-slate-600 font-medium">{previewOption.korean}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setPreviewOption(null); setSelectedOption(null); }}
                      className="px-6 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Change Route
                    </button>
                    <button
                      onClick={handleDriveNext}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] text-[15px]"
                    >
                      Drive to Next <Play className="w-4 h-4 fill-current ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cultural checkpoint — floating panel, right side of map */}
            {isMultipleOptions && culturalNote && (
              <div className="absolute top-5 right-5 z-30 w-[280px]">
                <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-2xl p-3.5 shadow-lg">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TriangleAlert className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Obstacle Encountered!</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">{culturalNote}</p>
                </div>
              </div>
            )}

            {/* Bottom bar */}
            <div className="absolute bottom-0 inset-x-0 z-40">
              <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Left: sentence index */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20 text-white font-bold text-lg shrink-0">
                        {currentIndex + 1}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                          Sentence {currentIndex + 1} of {totalSentences}
                        </p>
                        <p className="text-[13px] font-semibold text-slate-500">
                          {isMultipleOptions ? 'Choose your approach' : 'Direct translation'}
                        </p>
                      </div>
                    </div>

                    {/* Center: route + sentence text */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full md:w-auto gap-1.5">
                      {pragmaticIntent && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">Route</span>
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                            {pragmaticIntent}
                          </span>
                        </div>
                      )}
                      <p className="text-[15px] font-medium text-slate-700 line-clamp-2 leading-snug">
                        "{sentences[currentIndex]}"
                      </p>
                    </div>

                    {/* Right: proceed button */}
                    <div className="w-full md:w-[200px] shrink-0">
                      <button
                        onClick={handleDriveNext}
                        disabled={isGeneratingOptions || !selectedOption}
                        className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isGeneratingOptions
                          ? <><IterationCw className="w-4 h-4 animate-spin" /> Loading...</>
                          : <>Proceed <ArrowRight className="w-4 h-4" /></>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase: ARRIVAL */}
        {phase === 'ARRIVAL' && (
          <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-700 mt-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-500/30 mb-6 border-4 border-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight mb-3 text-slate-900">You've Arrived!</h2>
              <p className="text-slate-500 text-[17px] font-medium">Review your complete translated route below.</p>
            </div>

            <div className="flex gap-8 flex-col lg:flex-row items-stretch justify-center">

              {/* Left: result */}
              <div className="flex-1 w-full bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none" />
                <div className="px-10 pt-10 pb-8 border-b border-slate-100 relative z-10 text-left">
                  <h3 className="text-[12px] font-bold tracking-widest text-blue-600 uppercase mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Final Korean Delivery
                  </h3>
                  <div className="space-y-4 whitespace-pre-wrap text-[18px] text-slate-900 font-medium leading-relaxed selection:bg-blue-100">
                    {confirmedKorean.join('\n\n')}
                  </div>
                </div>
                <div className="px-10 pt-8 pb-10 bg-slate-50/80 relative z-10 text-left">
                  <h3 className="text-[11px] font-bold tracking-widest text-slate-400 flex items-center gap-2 uppercase mb-6">
                    <span className="w-2 h-2 rounded-full bg-slate-400" /> Original Intent (Back-translation)
                  </h3>
                  <div className="space-y-4 whitespace-pre-wrap text-[16px] text-slate-500 font-medium leading-relaxed">
                    {confirmedChoices.map(c => c.back_translation).join('\n\n')}
                  </div>
                </div>
              </div>

              {/* Right: route summary */}
              <div className="lg:w-[360px] w-full shrink-0 flex flex-col gap-4">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                  <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Route Summary
                  </h3>
                  <div className="space-y-3 flex-1 relative z-10">
                    {confirmedChoices.map((choice, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleEditRoute(idx)}
                        className="w-full text-left bg-white p-4 items-center rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group relative overflow-hidden active:scale-[0.98] flex gap-3"
                      >
                        <div className="flex flex-col items-center self-stretch mr-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-50 mt-1 shrink-0" />
                          {idx < confirmedChoices.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 my-1" />}
                        </div>
                        <div className="flex-1 min-w-0 py-1">
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">Sentence {idx + 1}</span>
                          <span className="text-[14px] font-bold text-slate-800 block mb-0.5 group-hover:text-blue-700 transition-colors">{choice.icon} {choice.name}</span>
                          <span className="text-[12px] text-slate-500 line-clamp-1 leading-snug italic">"{sentences[idx].slice(0, 45)}{sentences[idx].length > 45 ? '…' : ''}"</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity shrink-0">
                          <RefreshCcw className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 flex-col sm:flex-row mt-8">
              <button
                onClick={handleCopy}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl text-[15px] font-bold shadow-xl shadow-slate-900/20 transition-all active:scale-95 flex justify-center items-center gap-2.5"
              >
                <Copy className="w-5 h-5" /> Copy to Clipboard
              </button>
              <button
                onClick={resetState}
                className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 py-4 rounded-2xl text-[15px] font-bold shadow-sm transition-all active:scale-95 flex justify-center items-center gap-2.5"
              >
                <RefreshCcw className="w-5 h-5" /> Start Over
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
