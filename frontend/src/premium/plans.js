const PLAN_ORDER = ["free", "silver", "gold", "platinum"];

const FEATURE_LABELS = {
  mcq: "MCQs",
  flashcards: "Flashcards",
  text_summary: "Text summary",
  fill_blanks: "Fill in the blanks",
  audio_summary: "Audio summary",
  knowledge_gap: "Knowledge gap analyzer",
  true_false: "True / False",
  mock_exam: "Mock exam",
  youtube_guide: "YouTube guide",
};

const PLAN_DEFS = {
  free: {
    label: "Free",
    priceText: "\u20b90",
    features: ["mcq", "flashcards", "text_summary"],
  },
  silver: {
    label: "Silver",
    priceText: "\u20b9200/yr",
    features: ["mcq", "flashcards", "text_summary", "fill_blanks", "audio_summary", "knowledge_gap"],
  },
  gold: {
    label: "Gold",
    priceText: "\u20b9500/yr",
    features: ["mcq", "flashcards", "text_summary", "fill_blanks", "audio_summary", "knowledge_gap", "true_false"],
  },
  platinum: {
    label: "Platinum",
    priceText: "\u20b91000/yr",
    features: ["mcq", "flashcards", "text_summary", "fill_blanks", "audio_summary", "knowledge_gap", "true_false", "mock_exam", "youtube_guide"],
  },
};

const FEATURE_MIN_PLAN = {
  mcq: "free",
  flashcards: "free",
  text_summary: "free",
  fill_blanks: "silver",
  audio_summary: "silver",
  knowledge_gap: "silver",
  true_false: "gold",
  mock_exam: "platinum",
  youtube_guide: "platinum",
};

function getPlanRank(plan) {
  const normalized = String(plan || "free").trim().toLowerCase();
  const idx = PLAN_ORDER.indexOf(normalized);
  return idx === -1 ? 0 : idx;
}

function hasFeature(plan, feature) {
  const required = FEATURE_MIN_PLAN[String(feature || "").trim()] || "free";
  return getPlanRank(plan) >= getPlanRank(required);
}

function requiredPlanForFeature(feature) {
  return FEATURE_MIN_PLAN[String(feature || "").trim()] || "free";
}

export { PLAN_ORDER, PLAN_DEFS, FEATURE_LABELS, hasFeature, requiredPlanForFeature, getPlanRank };

