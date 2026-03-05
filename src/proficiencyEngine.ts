// ─── Proficiency Engine ────────────────────────────────────────────────────
// Stores the user's proficiency level and derives which features are active.
// Two-level system: low (cannot read Korean) and mid (partially understands Korean)

export type ProficiencyLevel = "low" | "mid";
export type FeatureMode = "proactive" | "on-demand" | "off";

export interface FeatureFlags {
  situationBriefing: FeatureMode;   // Cultural/communicative norms
  backTranslation: FeatureMode;     // English back-translation
  contextualExploration: FeatureMode; // 3-layer drill-down (meaning → alternatives → patterns)
}

// Feature matrix (2 × 3) from the README spec
const FEATURE_MATRIX: Record<ProficiencyLevel, FeatureFlags> = {
  low: {
    situationBriefing: "proactive",      // Always visible in English
    backTranslation: "proactive",        // Always visible, full sentence-by-sentence
    contextualExploration: "off",        // Not available — user can't read Korean
  },
  mid: {
    situationBriefing: "on-demand",      // Tap to see context for a segment
    backTranslation: "on-demand",        // Tap uncertain segments to reveal
    contextualExploration: "on-demand",  // 3-layer drill-down on any segment
  },
};

export interface ProficiencyEngine {
  level: ProficiencyLevel;
  features: FeatureFlags;
  surveyData: {
    hasTopik?: boolean | null;
    topikLevel?: number | null;
    readingChoice?: number | null;
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
// TOPIK 1-2 → low, TOPIK 3+ → mid
// Reading choice 0-1 → low, 2-3 → mid
export function deriveLevelFromSurvey(
  surveyData: ProficiencyEngine["surveyData"]
): ProficiencyLevel {
  const { hasTopik, topikLevel, readingChoice } = surveyData;

  if (hasTopik && topikLevel != null) {
    return topikLevel >= 3 ? "mid" : "low";
  }

  if (readingChoice != null) {
    return readingChoice >= 2 ? "mid" : "low";
  }

  return "low";
}
