import React, { useState, useRef, useEffect, useCallback } from "react";
import { TranslationTool } from "./TranslationTool";
import { createEngine, deriveLevelFromSurvey, ProficiencyLevel, ProficiencyEngine } from "./proficiencyEngine";

type StepId = 1 | 2 | 3;

const readingOptions = [
  { label: "I can't read it, or only recognize a few words", level: "low" as const },
  { label: "I can read it but often need help understanding", level: "low" as const },
  { label: "I can read and mostly understand everyday text", level: "mid" as const },
  { label: "I can read most texts, though formal writing is sometimes difficult", level: "mid" as const },
];

const topikLevels = [1, 2, 3, 4, 5, 6] as const;

const stepsMeta: { id: StepId; title: string; subtitle: string }[] = [
  { id: 1, title: "Language", subtitle: "Language to translate to" },
  { id: 2, title: "Your level", subtitle: "A quick check on your proficiency" },
  { id: 3, title: "Ready!", subtitle: "We'll set up your personalised tool" },
];

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null);
  const [hasTopik, setHasTopik] = useState<boolean | null>(null);
  const [topikLevel, setTopikLevel] = useState<number | null>(null);
  const [readingChoice, setReadingChoice] = useState<number | null>(null);
  const [engine, setEngine] = useState<ProficiencyEngine | null>(null);

  const stepsListRef = useRef<HTMLOListElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [progressHeight, setProgressHeight] = useState(0);

  const updateProgress = useCallback(() => {
    const list = stepsListRef.current;
    if (!list) return;
    const firstIcon = iconRefs.current[0];
    const lastIcon = iconRefs.current[stepsMeta.length - 1];
    const activeIcon = iconRefs.current[currentStep - 1];
    if (!firstIcon || !lastIcon || !activeIcon) return;
    const listRect = list.getBoundingClientRect();
    const firstRect = firstIcon.getBoundingClientRect();
    const lastRect = lastIcon.getBoundingClientRect();
    const activeRect = activeIcon.getBoundingClientRect();
    const firstCenter = firstRect.top + firstRect.height / 2 - listRect.top;
    const lastCenter = lastRect.top + lastRect.height / 2 - listRect.top;
    const activeCenter = activeRect.top + activeRect.height / 2 - listRect.top;
    list.style.setProperty("--first-circle-top", `${firstCenter}px`);
    list.style.setProperty("--gray-line-height", `${lastCenter - firstCenter}px`);
    setProgressHeight(Math.max(0, activeCenter - firstCenter));
  }, [currentStep]);

  useEffect(() => {
    updateProgress();
    window.addEventListener("resize", updateProgress);
    return () => window.removeEventListener("resize", updateProgress);
  }, [updateProgress]);

  const goNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else {
      const surveyData = { targetLanguage: targetLanguage ?? "Korean", hasTopik, topikLevel, readingChoice };
      const level = deriveLevelFromSurvey(surveyData);
      setEngine(createEngine(level, surveyData));
    }
  };

  const goBack = () => {
    setCurrentStep((prev) => (prev > 1 ? (prev - 1) as StepId : prev));
  };

  // Can the user proceed from current step?
  const canProceedStep1 = targetLanguage !== null;
  const canProceedStep2 = hasTopik === true ? topikLevel !== null : hasTopik === false ? readingChoice !== null : false;
  const canProceed = currentStep === 1 ? canProceedStep1 : currentStep === 2 ? canProceedStep2 : true;

  const handleChangeLevel = (level: ProficiencyLevel) => {
    if (!engine) return;
    setEngine(createEngine(level, engine.surveyData));
  };

  if (engine) {
    return <TranslationTool engine={engine} onChangeLevel={handleChangeLevel} targetLanguage={targetLanguage ?? "Korean"} />;
  }

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <section className="question-section">
          <header className="question-header">
            <div className="question-meta"><span className="question-number">01</span></div>
            <h2>What language are you writing in?</h2>
          </header>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {["Korean", "Spanish"].map((lang) => (
              <button
                key={lang}
                className={"scale-pill" + (targetLanguage === lang ? " scale-pill--active" : "")}
                onClick={() => setTargetLanguage(lang)}
                style={{ padding: "10px 18px", minWidth: "auto", textAlign: "left" }}
              >
                {lang}
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (currentStep === 2) {
      const examName = targetLanguage === "Spanish" ? "DELE/SIELE" : "TOPIK";
      return (
        <section className="question-section">
          <header className="question-header">
            <div className="question-meta"><span className="question-number">02</span></div>
            <h2>Do you have an official {examName} score?</h2>
          </header>

          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <button
              className={"scale-pill" + (hasTopik === true ? " scale-pill--active" : "")}
              onClick={() => { setHasTopik(true); setReadingChoice(null); }}
              style={{ padding: "8px 28px", minWidth: "auto" }}
            >
              Yes
            </button>
            <button
              className={"scale-pill" + (hasTopik === false ? " scale-pill--active" : "")}
              onClick={() => { setHasTopik(false); setTopikLevel(null); }}
              style={{ padding: "8px 28px", minWidth: "auto" }}
            >
              No
            </button>
          </div>

          {hasTopik === true && (
            <>
              <p className="paragraph" style={{ marginBottom: 8 }}>
                What level?
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {topikLevels.map((lvl) => (
                  <button
                    key={lvl}
                    className={"scale-pill" + (topikLevel === lvl ? " scale-pill--active" : "")}
                    onClick={() => setTopikLevel(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </>
          )}

          {hasTopik === false && (
            <>
              <p className="paragraph" style={{ marginBottom: 8 }}>
                How well can you read {targetLanguage}?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {readingOptions.map((opt, idx) => (
                  <button
                    key={idx}
                    className={"scale-pill" + (readingChoice === idx ? " scale-pill--active" : "")}
                    onClick={() => setReadingChoice(idx)}
                    style={{ padding: "10px 18px", minWidth: "auto", textAlign: "left" }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      );
    }

    return (
      <section className="question-section">
        <header className="question-header">
          <div className="question-meta"><span className="question-number">03</span></div>
          <h2>You're all set!</h2>
        </header>
        <p className="paragraph">
          Based on your answers, we'll tailor the translation tools to match your comfort level with {targetLanguage}.
        </p>
        <p className="paragraph" style={{ marginTop: 12 }}>
          Hit "Launch" to open TransLucent.
        </p>
      </section>
    );
  };

  return (
    <div className="app-root">
      <div className="card">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <h1>Let's set up TransLucent</h1>
            <p>Answer a quick question so we can tailor the experience to your level.</p>
          </div>
          <ol
            ref={stepsListRef}
            className="steps-list"
            style={{ "--progress-height": `${progressHeight}px` } as React.CSSProperties}
          >
            {stepsMeta.map((step) => {
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              const className = "step step-clickable" + (isActive ? " active" : "") + (isDone ? " done" : "");
              return (
                <li key={step.id} className={className} onClick={() => step.id < currentStep && setCurrentStep(step.id)}>
                  <div className="step-icon" ref={(el) => { iconRefs.current[step.id - 1] = el; }}>
                    {step.id}
                  </div>
                  <div className="step-body">
                    <div className="step-title">{step.title}</div>
                    <div className="step-subtitle">{step.subtitle}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
        <main className="main-panel">
          {renderStepContent()}
          <footer className="footer">
            <button className="ghost-button" onClick={goBack} disabled={currentStep === 1}>
              <span className="arrow arrow-left" /> Back
            </button>
            <button
              className="primary-button"
              onClick={goNext}
              disabled={!canProceed}
            >
              {currentStep === 3 ? "Launch tool" : "Next"} <span className="arrow arrow-right" />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
};
