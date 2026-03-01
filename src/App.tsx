import React, { useState, useRef, useEffect, useCallback } from "react";
import { TranslationTool } from "./TranslationTool";
import { createEngine, deriveLevelFromSurvey, ProficiencyLevel, ProficiencyEngine } from "./proficiencyEngine";

type StepId = 1 | 2 | 3 | 4;

const koreanStudyDurations = ["Never studied", "< 6 months", "6–12 months", "1-3 years", "3+ years"] as const;
type StudyDuration = (typeof koreanStudyDurations)[number];

const koreanGoalOptions = [
  "Travel", "K-dramas/Music", "Work", "Heritage", "Friends/Family", "Academic", "Other"
] as const;
type GoalOption = (typeof koreanGoalOptions)[number];

const selfRatingScale = Array.from({ length: 10 }, (_, i) => i + 1);

const stepsMeta: { id: StepId; title: string; subtitle: string }[] = [
  { id: 1, title: "About you", subtitle: "A little background to get started" },
  { id: 2, title: "Korean background", subtitle: "Your experience and confidence level" },
  { id: 3, title: "Your goals", subtitle: "Why are you learning Korean?" },
  { id: 4, title: "Ready!", subtitle: "We'll set up your personalised tool" },
];

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [name, setName] = useState("");
  const [studyDuration, setStudyDuration] = useState<StudyDuration | "">("");
  const [selfRating, setSelfRating] = useState<number>(5);
  const [selectedGoals, setSelectedGoals] = useState<Set<GoalOption>>(new Set());
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

  const toggleGoal = (label: GoalOption) => {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const goNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as StepId);
    } else {
      const surveyData = {
        studyDuration: studyDuration || undefined,
        selfRating,
        goals: Array.from(selectedGoals),
      };
      const level = deriveLevelFromSurvey(surveyData);
      setEngine(createEngine(level, surveyData));
    }
  };

  const goBack = () => {
    setCurrentStep((prev) => (prev > 1 ? (prev - 1) as StepId : prev));
  };

  const handleChangeLevel = (level: ProficiencyLevel) => {
    if (!engine) return;
    setEngine(createEngine(level, engine.surveyData));
  };

  if (engine) {
    return <TranslationTool engine={engine} onChangeLevel={handleChangeLevel} />;
  }

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <section className="question-section">
          <header className="question-header">
            <div className="question-meta"><span className="question-number">01</span></div>
            <h2>What should we call you?</h2>
          </header>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name..."
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              border: "1px solid #e4d5c9", fontSize: 16, fontFamily: "inherit",
              color: "#2b1a11", background: "#fdf7f1", outline: "none", marginTop: 8,
            }}
          />
          <p className="paragraph" style={{ marginTop: 20 }}>
            This tool adapts to your Korean proficiency level to give you exactly the right level of help — not too much, not too little.
          </p>
        </section>
      );
    }

    if (currentStep === 2) {
      return (
        <section className="question-section">
          <header className="question-header">
            <div className="question-meta"><span className="question-number">02</span></div>
            <h2>Tell us about your Korean background.</h2>
          </header>
    
          <p className="paragraph" style={{ marginBottom: 8 }}>
          <span className="question-number" style={{ marginRight: 10, background: "#ffb76b", borderColor: "#ffb76b", color: "#fff" }}>A</span>
            How long have you been studying?
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
            {koreanStudyDurations.map((d) => (
              <button
                key={d}
                className={"scale-pill" + (studyDuration === d ? " scale-pill--active" : "")}
                onClick={() => setStudyDuration(d)}
                style={{ padding: "8px 18px", minWidth: "auto" }}
              >
                {d}
              </button>
            ))}
          </div>
    
          <p className="paragraph" style={{ marginBottom: 8 }}>
            <span className="question-number" style={{ marginRight: 10, background: "#ffb76b", borderColor: "#ffb76b", color: "#fff" }}>B</span>
            How confident are you reading Korean? &nbsp;·&nbsp; 1 = can't read Hangul &nbsp;·&nbsp; 10 = fluent
          </p>
          <div className="scale-row">
            {selfRatingScale.map((value) => (
              <button
                key={value}
                className={"scale-pill" + (value === selfRating ? " scale-pill--active" : "")}
                onClick={() => setSelfRating(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="question-section">
          <header className="question-header">
            <div className="question-meta"><span className="question-number">04</span></div>
            <h2>Why are you learning Korean?</h2>
          </header>
          <div className="grid" style={{ marginTop: 16 }}>
            {koreanGoalOptions.map((label) => {
              const active = selectedGoals.has(label);
              return (
                <button
                  key={label}
                  className={"grid-item" + (active ? " grid-item--active" : "")}
                  onClick={() => toggleGoal(label)}
                >
                  <span className="grid-label">{label}</span>
                  {active && <span className="grid-check" />}
                </button>
              );
            })}
          </div>
        </section>
      );
    }

    const previewLevel = deriveLevelFromSurvey({ studyDuration: studyDuration || undefined, selfRating });
    const levelColors: Record<string, string> = { low: "#ff8a5c", mid: "#ffb76b", high: "#4a7c59" };
    return (
      <section className="question-section">
        <header className="question-header">
          <div className="question-meta"><span className="question-number">05</span></div>
          <h2>{name ? `You're all set, ${name}!` : "You're all set!"}</h2>
        </header>
        <p className="paragraph">Based on your answers, we've set your starting proficiency level to:</p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12, marginTop: 8,
          background: levelColors[previewLevel] + "18", border: `2px solid ${levelColors[previewLevel]}44`,
          borderRadius: 16, padding: "14px 24px"
        }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: levelColors[previewLevel] }} />
          <span style={{ fontSize: 22, fontWeight: 700, color: levelColors[previewLevel], textTransform: "capitalize" }}>
            {previewLevel} proficiency
          </span>
        </div>
        <p className="paragraph" style={{ marginTop: 20 }}>
          You can always switch levels with the dev toggle while testing. Hit "Launch" to open the translation tool.
        </p>
      </section>
    );
  };

  return (
    <div className="app-root">
      <div className="card">
        <aside className="sidebar">
          {/* <div className="brand">
            <div className="brand-mark" />
            <span className="brand-name">KoreanBridge</span>
          </div> */}
          <div className="sidebar-heading">
            <h1>Let's set up your Korean tool</h1>
            <p>Answer a few quick questions so we can tailor the experience to your level.</p>
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
            <button className="primary-button" onClick={goNext}>
              {currentStep === 4 ? "Launch tool" : "Next"} <span className="arrow arrow-right" />
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
};
