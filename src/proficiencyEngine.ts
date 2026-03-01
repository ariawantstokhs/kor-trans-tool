// ─── Proficiency Engine ────────────────────────────────────────────────────
// Stores the user's proficiency level and derives which features are active.
// "Partial" means the feature is shown but in a reduced/collapsed form.

export type ProficiencyLevel = "low" | "mid" | "high";
export type FeatureState = "on" | "partial" | "off";

export interface FeatureFlags {
  culturalContext: FeatureState;   // F3
  onDemandExplore: FeatureState;  // F4
  alternatives: FeatureState;     // F5
}

// Feature matrix derived from the design table
const FEATURE_MATRIX: Record<ProficiencyLevel, FeatureFlags> = {
  low: {
    culturalContext: "on",
    onDemandExplore: "off",
    alternatives: "off",
  },
  mid: {
    culturalContext: "on",
    onDemandExplore: "on",
    alternatives: "on",
  },
  high: {
    culturalContext: "partial",
    onDemandExplore: "on",
    alternatives: "partial",
  },
};

export interface ProficiencyEngine {
  level: ProficiencyLevel;
  features: FeatureFlags;
  // Survey answers that informed the level
  surveyData: {
    age?: string;
    studyDuration?: string;
    selfRating?: number;
    goals?: string[];
  };
}

export function createEngine(
  level: ProficiencyLevel,
  surveyData: ProficiencyEngine["surveyData"] = {}
): ProficiencyEngine {
  return {
    level,
    features: FEATURE_MATRIX[level],
    surveyData,
  };
}

export function getFeatureMatrix() {
  return FEATURE_MATRIX;
}

// Derives a proficiency level from survey answers
// (basic heuristic — can be replaced with LLM-based scoring later)
export function deriveLevelFromSurvey(
  surveyData: ProficiencyEngine["surveyData"]
): ProficiencyLevel {
  const { selfRating = 1, studyDuration } = surveyData;

  if (selfRating >= 7 || studyDuration === "3+ years") return "high";
  if (selfRating >= 4 || studyDuration === "1-3 years") return "mid";
  return "low";
}
