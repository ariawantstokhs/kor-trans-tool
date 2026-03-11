import React, { useState, useEffect } from 'react';
import { 
  analyzeContext, 
  translateMove, 
  ContextAnalysisResponse, 
  MoveTranslationResponse, 
  SCENARIOS,
  MoveOption
} from './api';
import { 
  Sparkles, IterationCw, ChevronRight, ChevronLeft, 
  MessageSquare, Copy, RefreshCcw, ArrowRight, Play
} from 'lucide-react';
import { cx } from './utils';
import { RoadMap } from './RoadMap';

type Phase = 'INPUT' | 'ANALYSIS' | 'NAVIGATING' | 'ARRIVAL';

export function App() {
  const [inputText, setInputText] = useState(SCENARIOS.scenarioA.source);
  const [scenario, setScenario] = useState<'A' | 'custom'>('A');

  const [phase, setPhase] = useState<Phase>('INPUT');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysisData, setAnalysisData] = useState<ContextAnalysisResponse | null>(null);
  const [toneAdjustment, setToneAdjustment] = useState('');

  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [moveResults, setMoveResults] = useState<MoveTranslationResponse[]>([]);
  // Store the user's choices string for the route summary
  const [routeHistory, setRouteHistory] = useState<{name: string, description: string}[]>([]); 
  
  const [selectedOptionInfo, setSelectedOptionInfo] = useState<{name: string, description?: string, customText?: string} | null>(null);
  const [previewOption, setPreviewOption] = useState<MoveOption | null>(null);

  const [isTranslating, setIsTranslating] = useState(false);
  const [customMoveInstruction, setCustomMoveInstruction] = useState('');

  useEffect(() => {
    handleLoadScenario('A');
  }, []);

  const resetState = () => {
    setPhase('INPUT');
    setAnalysisData(null);
    setToneAdjustment('');
    setCurrentMoveIndex(0);
    setMoveResults([]);
    setRouteHistory([]);
    setError(null);
    setCustomMoveInstruction('');
    setSelectedOptionInfo(null);
    setPreviewOption(null);
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

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    
    try {
      let data: ContextAnalysisResponse;
      if (scenario === 'custom' || toneAdjustment) {
        data = await analyzeContext(inputText, toneAdjustment);
      } else {
        // Quick load mock for scenario A without adjustment
        data = SCENARIOS.scenarioA.mockAnalysis as any; 
      }
      setAnalysisData(data);
      setPhase('ANALYSIS');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred during context analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartMoves = () => {
    setCurrentMoveIndex(0);
    setMoveResults([]);
    setRouteHistory([]);
    setPhase('NAVIGATING');
    setCustomMoveInstruction('');
    setSelectedOptionInfo(null);
    setPreviewOption(null);
  };

  const handleOptionClick = (opt: MoveOption) => {
    setPreviewOption(opt);
    setSelectedOptionInfo({ name: opt.name, description: opt.description });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMoveInstruction.trim()) return;
    setSelectedOptionInfo({ name: 'Custom override', customText: customMoveInstruction });
    setPreviewOption(null); // No preview available until API returns
  };

  const clearSelection = () => {
    setSelectedOptionInfo(null);
    setPreviewOption(null);
    setCustomMoveInstruction('');
  };

  const handleDriveNext = async () => {
    if (!analysisData || !selectedOptionInfo) return;
    setIsTranslating(true);
    setError(null);
    
    try {
      const move = analysisData.moves[currentMoveIndex];
      const result = await translateMove(move, selectedOptionInfo, analysisData.context);
      
      const newResults = [...moveResults];
      newResults[currentMoveIndex] = result;
      setMoveResults(newResults);
      
      const newHistory = [...routeHistory];
      newHistory[currentMoveIndex] = {
        name: selectedOptionInfo.name,
        description: selectedOptionInfo.description || (selectedOptionInfo.customText ? `"${selectedOptionInfo.customText}"` : '')
      };
      setRouteHistory(newHistory);

      clearSelection();
      
      if (currentMoveIndex < analysisData.moves.length - 1) {
        setCurrentMoveIndex(prev => prev + 1);
      } else {
        setPhase('ARRIVAL');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to translate this move.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEditRoute = (index: number) => {
    setCurrentMoveIndex(index);
    setPhase('NAVIGATING');
    clearSelection();
  };

  const handleCopy = () => {
     const draft = moveResults.slice(0, analysisData?.moves.length).map(r => r.korean).join('\n\n');
     navigator.clipboard.writeText(draft);
     alert('Copied to clipboard!');
  };

  const totalMoves = analysisData?.moves.length || 0;
  // Node labels
  const nodeLabels = analysisData?.moves.map(m => m.label) || [];

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
        
        {/* Road Map Top Menu */
         phase !== 'INPUT' && phase !== 'ANALYSIS' && analysisData && (
           <RoadMap 
             totalNodes={totalMoves} 
             currentNodeIndex={currentMoveIndex} 
             nodeLabels={nodeLabels}
             phase={phase}
           />
         )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col items-center justify-start">
        
        {/* Error Alert */}
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
              
              <div className="px-6 py-4 flex justify-between items-center bg-white rounded-b-3xl">
                 <div />
                 <button
                   onClick={handleAnalyze}
                   disabled={isAnalyzing || !inputText.trim()}
                   className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-sm font-bold shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ml-auto tracking-wide group-hover:bg-black"
                 >
                   {isAnalyzing ? (
                     <><IterationCw className="w-4 h-4 animate-spin text-slate-400" /> Analyzing Intent...</>
                   ) : (
                     <><Sparkles className="w-4 h-4 text-amber-300" /> Start Translation</>
                   )}
                 </button>
              </div>
            </section>
          </div>
        )}

        {/* Phase: ANALYSIS */}
        {phase === 'ANALYSIS' && analysisData && (
          <div className="w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-extrabold tracking-tight mb-2 text-slate-900">Context Analysis</h2>
                <p className="text-slate-500 font-medium">We've mapped out the communicative structure of your text.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl mb-8">
               <div className="mb-6">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Detected Tone</h3>
                 <div className="text-lg font-semibold text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">{analysisData.context.tone}</div>
               </div>
               <div className="mb-8">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Detected Purpose</h3>
                 <div className="text-lg font-semibold text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-100">{analysisData.context.purpose}</div>
               </div>

               <div className="mb-8">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Adjust Tone / Context (Optional)</h3>
                 <div className="flex gap-2 flex-col sm:flex-row">
                    <input 
                      type="text" 
                      placeholder="e.g., 'Actually this is to a peer instead'"
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-50 focus:bg-white transition-colors text-slate-700"
                      value={toneAdjustment}
                      onChange={(e) => setToneAdjustment(e.target.value)}
                    />
                    {toneAdjustment && (
                      <button 
                        onClick={handleAnalyze} 
                        disabled={isAnalyzing}
                        className="px-6 py-3 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                      >
                         {isAnalyzing ? <IterationCw className="w-5 h-5 animate-spin"/> : 'Update Context'}
                      </button>
                    )}
                 </div>
               </div>

               <button onClick={handleStartMoves} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                 Start Translation Route <ArrowRight className="w-5 h-5" />
               </button>
            </div>
          </div>
        )}

        {/* Phase: NAVIGATING Crossroads */}
        {phase === 'NAVIGATING' && analysisData && (
          <div className="w-full h-[80vh] min-h-[600px] mt-4 relative bg-[#F0EFEA] rounded-[2rem] overflow-hidden border border-slate-200/60 shadow-2xl animate-in fade-in zoom-in-95 duration-500 flex flex-col justify-end ring-1 ring-black/5">
            
            {/* Map Background Pattern (subtle grid to ground it + map texture feeling) */}
            <div className="absolute inset-x-0 bottom-0 h-full opacity-30 pointer-events-none bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" />

            {/* Dynamic Map Area */}
            <div className={cx(
              "absolute inset-0 flex flex-col justify-end items-center pb-[180px] transition-transform duration-1000 ease-in-out",
              previewOption ? "translate-y-[15vh] scale-110 opacity-40 blur-[2px]" : "" // zoom into branch
            )}>
              
               {/* Route Path (SVG) */}
               <div className="absolute inset-x-0 bottom-[140px] top-0 pointer-events-none flex justify-center">
                  <svg className="w-[800px] h-full overflow-visible" viewBox="0 0 800 600" preserveAspectRatio="none">

                    {/* Branches (Base outline/unselected paths first) */}
                    {analysisData.moves[currentMoveIndex].options.map((_, idx, arr) => {
                       const count = arr.length;
                       // Left, Center(Forward), Right
                       let tX = 400; 
                       if (count === 2) tX = idx === 0 ? 250 : 550;
                       if (count === 3) tX = idx === 0 ? 150 : (idx === 1 ? 400 : 650);

                       const isSelected = selectedOptionInfo?.name === arr[idx].name;
                       const d = `M400,360 C400,240 ${tX},280 ${tX},160`;

                       // Unselected path styling (white street with gray border, Map style)
                       if (!isSelected) {
                         return (
                           <g key={`path-unselected-${idx}`}>
                             {/* Border casing */}
                             <path d={d} stroke="#CBD5E1" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.8" />
                             {/* Inner street */}
                             <path d={d} stroke="#FFFFFF" strokeWidth="20" strokeLinecap="round" fill="none" />
                           </g>
                         );
                       }
                       return null;
                    })}

                    {/* Active Route on top */}
                    {analysisData.moves[currentMoveIndex].options.map((_, idx, arr) => {
                       const count = arr.length;
                       let tX = 400;
                       if (count === 2) tX = idx === 0 ? 250 : 550;
                       if (count === 3) tX = idx === 0 ? 150 : (idx === 1 ? 400 : 650);

                       const isSelected = selectedOptionInfo?.name === arr[idx].name;
                       const d = `M400,360 C400,240 ${tX},280 ${tX},160`;

                       if (isSelected) {
                         return (
                           <g key={`path-selected-${idx}`} style={{ zIndex: 10 }}>
                             {/* Halo outer glow (simplified, no shadow filter) */}
                             <path d={d} stroke="#BFDBFE" strokeWidth="36" strokeLinecap="round" fill="none" opacity="0.6" />
                             {/* Core blue route */}
                             <path d={d} stroke="#3B82F6" strokeWidth="20" strokeLinecap="round" fill="none" />
                           </g>
                         );
                       }
                       return null;
                    })}

                    {/* Main Stem originating from car (draw last so it covers the junction overlap) */}
                    <g>
                      <path d="M400,600 L400,300" stroke="#BFDBFE" strokeWidth="36" strokeLinecap="round" fill="none" opacity="0.6" />
                      <path d="M400,600 L400,300" stroke="#3B82F6" strokeWidth="20" strokeLinecap="round" fill="none" />
                    </g>

                    {/* Invisible Hit Areas for clicking paths directly */}
                    {analysisData.moves[currentMoveIndex].options.map((_, idx, arr) => {
                       const count = arr.length;
                       let tX = 400;
                       if (count === 2) tX = idx === 0 ? 250 : 550;
                       if (count === 3) tX = idx === 0 ? 150 : (idx === 1 ? 400 : 650);
                       const d = `M400,300 C400,200 ${tX},250 ${tX},120`;
                       
                       return (
                         <path 
                           key={`path-hit-${idx}`} 
                           d={d} 
                           stroke="transparent" 
                           strokeWidth="40" 
                           strokeLinecap="round" 
                           fill="none" 
                           className="cursor-pointer pointer-events-auto"
                           onClick={() => handleOptionClick(arr[idx])}
                         />
                       );
                    })}
                 </svg>
              </div>

              {/* Branch Cards (Apple Maps POI style) - Now wider to fit screen edges safely */}
              <div className="absolute w-full top-[160px] flex justify-center h-0 pointer-events-none px-4 box-border">
                <div className="w-[800px] max-w-full relative">
                  {analysisData.moves[currentMoveIndex].options.map((opt, idx, arr) => {
                       const count = arr.length;
                       let left = '50%';
                       if (count === 2) left = idx === 0 ? '31.25%' : '68.75%'; // 250/800 and 550/800
                       if (count === 3) left = idx === 0 ? '18.75%' : (idx === 1 ? '50%' : '81.25%'); // 150/800, 400/800, 650/800

                       const isSelected = selectedOptionInfo?.name === opt.name;

                       // Temporary patch for mock object translation hint until API is connected fully if it lacks 'korean' prop upfront
                       // Assumes opt might have some small hint or we use back_translation if available.
                       const hint = (opt as any)?.korean || (opt as any)?.back_translation || opt.description;

                       return (
                         <button
                           key={`card-${idx}`}
                           onClick={() => handleOptionClick(opt)}
                           disabled={isTranslating}
                           className={cx(
                             "absolute top-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto text-left transition-all duration-300 transform outline-none group",
                             isSelected ? "scale-[1.10] z-30" : "scale-100 z-10 hover:scale-105",
                           )}
                           style={{ left }}
                         >
                            <div className={cx(
                              "bg-white/95 backdrop-blur-xl border p-4 rounded-3xl flex flex-col items-center w-[220px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all",
                              isSelected ? "border-blue-500 shadow-blue-500/20 ring-4 ring-blue-500/10" : "border-slate-200/60 hover:border-slate-300 group-hover:shadow-[0_12px_40px_rgb(0,0,0,0.15)]"
                            )}>
                              <div className="text-center w-full">
                                <p className={cx("text-[14px] font-extrabold leading-tight mb-2", isSelected ? "text-blue-700" : "text-slate-800")}>{opt.name}</p>
                                
                                {/* Concrete Translation Hint */}
                                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 w-full text-left">
                                   <p className={cx(
                                      "text-[12.5px] font-bold leading-snug line-clamp-3",
                                      isSelected ? "text-blue-900" : "text-slate-700"
                                   )}>
                                      "{opt.back_translation || opt.description}"
                                   </p>
                                   {opt.korean && (
                                     <p className={cx(
                                        "text-[11.5px] font-medium leading-[1.4] line-clamp-2",
                                        isSelected ? "text-blue-600/90" : "text-slate-500"
                                     )}>
                                        {opt.korean}
                                     </p>
                                   )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Pin connector dot to path */}
                            <div className="mx-auto w-4 h-4 rounded-full bg-white border-[3px] shadow-sm transform translate-y-3 flex items-center justify-center transition-colors" style={{ borderColor: isSelected ? '#3B82F6' : '#CBD5E1'}}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                            </div>
                         </button>
                       );
                  })}
                </div>
              </div>
              
              {/* Car Icon Tracker (Bottom Center of map path) */}
              <div className="absolute bottom-[130px] w-14 h-14 bg-white rounded-full shadow-[0_8px_20px_rgb(0,0,0,0.2)] border-2 border-slate-100 flex items-center justify-center z-20 pointer-events-none transform -translate-x-1/2 left-1/2 ring-[6px] ring-white/50 backdrop-blur-md">
                 {/* Navigation Puck Arrow */}
                 <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-blue-600 transform drop-shadow-sm mb-1" />
                 {/* Glowing dot inside */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 rounded-full bg-blue-300 blur-[1px]" />
              </div>

            </div>

            {/* Selected Option Preview Overlay */}
            {selectedOptionInfo && previewOption && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px]" onClick={(e) => { e.stopPropagation(); clearSelection(); }} />
                <div className="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-200 w-full max-w-lg relative z-10 transform transition-all">
                  <h4 className="text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Selected Route
                  </h4>
                  <div className="mb-8">
                    <p className="text-2xl font-semibold text-slate-900 leading-snug mb-5 tracking-tight">
                      "{previewOption.back_translation}"
                    </p>
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">KOR</span>
                      <p className="text-[15px] text-slate-600 font-medium">
                        {previewOption.korean}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                      className="px-6 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Change Route
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDriveNext(); }}
                      disabled={isTranslating}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 text-[15px]"
                    >
                      {isTranslating ? (
                        <><IterationCw className="w-5 h-5 animate-spin" /> Moving...</>
                      ) : (
                        <>Drive to Next Node <Play className="w-4 h-4 fill-current ml-1" /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Navigation UI Bar (Apple Maps style) */}
            <div className="absolute bottom-0 inset-x-0 z-40">
              <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 md:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl">
                 <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Left: Move Info */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                       <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20 text-white font-bold text-lg shrink-0">
                         {currentMoveIndex + 1}
                       </div>
                       <div>
                         <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Move {currentMoveIndex + 1} of {analysisData.moves.length}</p>
                         <p className="text-[15px] font-bold text-slate-900">{analysisData.moves[currentMoveIndex].label}</p>
                       </div>
                    </div>
                    
                    {/* Center: Instruction text */}
                    <div className="flex-1 flex justify-center text-center px-4 w-full md:w-auto">
                       <p className="text-[15px] font-medium text-slate-700 line-clamp-2 leading-snug">
                         "{analysisData.moves[currentMoveIndex].original_text}"
                       </p>
                    </div>

                    {/* Right: Custom route input */}
                    <div className="w-full md:w-[300px] shrink-0">
                      <form onSubmit={handleCustomSubmit} className={cx(
                         "flex items-center bg-slate-100 rounded-full border transition-all p-1",
                         selectedOptionInfo?.name === 'Custom override' ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20" : "border-transparent focus-within:bg-white focus-within:border-slate-300 focus-within:shadow-sm"
                      )}>
                        <input
                           type="text"
                           placeholder="Route detour note..."
                           className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] px-4 py-2 outline-none text-slate-800 placeholder:text-slate-400 font-medium"
                           value={customMoveInstruction}
                           onChange={(e) => {
                             setCustomMoveInstruction(e.target.value);
                             if (selectedOptionInfo && selectedOptionInfo.name !== 'Custom override') clearSelection();
                           }}
                           disabled={isTranslating}
                        />
                        <button
                           type="submit"
                           disabled={!customMoveInstruction.trim() || isTranslating}
                           className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-slate-300 hover:bg-black transition-colors shrink-0"
                        >
                           <ChevronRight className="w-4 h-4" />
                        </button>
                      </form>
                      
                      {selectedOptionInfo?.name === 'Custom override' && customMoveInstruction.trim() && !previewOption && (
                         <button 
                            onClick={handleDriveNext}
                            disabled={isTranslating}
                            className="w-full mt-3 bg-blue-600 text-white py-2.5 rounded-xl text-[13px] font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors active:scale-95"
                         >
                            {isTranslating ? <IterationCw className="w-4 h-4 animate-spin" /> : 'Drive Custom Route'}
                         </button>
                      )}
                    </div>
                 </div>
              </div>
            </div>

          </div>
        )}

        {/* Old MOVE_RESULT has been removed and folded into the preview of NAVIGATING */}

        {/* Phase: ARRIVAL (Final Review) */}
        {phase === 'ARRIVAL' && analysisData && (
          <div className="w-full max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-700 mt-10">
            
            <div className="text-center mb-12">
               {/* Map Pin / Flag Icon */}
               <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full text-white shadow-xl shadow-blue-500/30 mb-6 border-4 border-white">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
               </div>
               <h2 className="text-4xl font-extrabold tracking-tight mb-3 text-slate-900">You've Arrived!</h2>
               <p className="text-slate-500 text-[17px] font-medium">Review your complete translated route below.</p>
            </div>

            <div className="flex gap-8 flex-col lg:flex-row items-stretch items-start justify-center">
              
              {/* Left Column: Result Strings */}
              <div className="flex-1 w-full bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none" />

                 <div className="px-10 pt-10 pb-8 border-b border-slate-100 relative z-10 text-left">
                   <h3 className="text-[12px] font-bold tracking-widest text-blue-600 uppercase mb-6 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-blue-500" /> Final Korean Delivery
                   </h3>
                   <div className="space-y-4 whitespace-pre-wrap text-[18px] text-slate-900 font-medium leading-relaxed selection:bg-blue-100">
                     {moveResults.map(r => r.korean).join('\n\n')}
                   </div>
                 </div>

                 <div className="px-10 pt-8 pb-10 bg-slate-50/80 relative z-10 text-left h-full">
                   <h3 className="text-[11px] font-bold tracking-widest text-slate-400 flex items-center gap-2 uppercase mb-6">
                     <span className="w-2 h-2 rounded-full bg-slate-400" /> Original Intent (Back-translation)
                   </h3>
                   <div className="space-y-4 whitespace-pre-wrap text-[16px] text-slate-500 font-medium leading-relaxed">
                     {moveResults.map(r => r.back_translation).join('\n\n')}
                   </div>
                 </div>
              </div>

              {/* Right Column: Route summary */}
              <div className="lg:w-[360px] w-full shrink-0 flex flex-col gap-4">
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 h-full flex flex-col relative overflow-hidden">
                   {/* Background map grid pattern */}
                   <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                   
                   <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                     </svg>
                     Route Summary
                   </h3>
                   <div className="space-y-3 flex-1 relative z-10">
                     {routeHistory.map((rh, idx) => (
                       <button 
                         key={idx}
                         onClick={() => handleEditRoute(idx)}
                         className="w-full text-left bg-white p-4 items-center rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group relative overflow-hidden active:scale-[0.98] flex gap-3"
                       >
                         {/* Route indicator circle and line */}
                         <div className="flex flex-col items-center self-stretch mr-2">
                           <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-50 mt-1 shrink-0" />
                           {idx < routeHistory.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 my-1" />}
                         </div>
                         
                         <div className="flex-1 min-w-0 py-1">
                           <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">{analysisData.moves[idx].label}</span>
                           <span className="text-[14px] font-bold text-slate-800 block mb-0.5 group-hover:text-blue-700 transition-colors truncate">{rh.name}</span>
                           <span className="text-[12px] text-slate-500 line-clamp-1 leading-snug">{rh.description}</span>
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

            <div className="flex gap-4 flex-col sm:flex-row">
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
