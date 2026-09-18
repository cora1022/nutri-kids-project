export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'calcium'
  | 'iron'
  | 'vitaminA'
  | 'vitaminC'
  | 'sodium';

export type NutrientKind = 'target' | 'upperLimit';

export interface NutrientMetaEntry {
  key: NutrientKey;
  label: string;
  unit: string;
  kind: NutrientKind;
}

export type NutrientValues = Record<NutrientKey, number | null>;

export type FoodCategory = 'cvs' | 'general';

/** 식품 오버뷰 품질 표시 (백엔드 계약과 일치) */
export type OverallQuality = 'CONFIRMED' | 'ESTIMATED' | 'MIXED' | 'MISSING';

export interface Food {
  id: string;
  name: string;
  brand?: string | null;
  category: FoodCategory;
  servingLabel: string;
  servingSize: number | null;
  unit: string;
  nutrients: NutrientValues;
  // 백엔드 연동 시에만 채워지는 선택 필드들
  nutrientDetails?: unknown;
  overallQuality?: OverallQuality;
  itemReportNo?: string | null;
  itemReportCandidates?: unknown[];
  itemReportStatus?: string | null;
  itemReportEvidence?: unknown;
  standardFoodMatch?: unknown;
  barcode?: string | null;
  price?: number | null;
  imageUrl?: string | null;
}

export type Gender = 'male' | 'female';

export interface Profile {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  mealsPerDay: number;
}

export interface MealItem {
  food: Food;
  qty: number;
  key: string;
}

export interface NutrientTotal {
  value: number;
  hasUnknown: boolean;
  hasAny: boolean;
}

export type Totals = Record<NutrientKey, NutrientTotal>;

export type Goals = Record<NutrientKey, number>;

export type EvaluationStatus = 'deficient' | 'ok' | 'over' | 'unknown';

export interface EvaluationItem {
  status: EvaluationStatus;
  value: number | null;
  goal: number;
  ratio: number | null;
  partial?: boolean;
  quality?: string;
}

export type Evaluation = Record<NutrientKey, EvaluationItem>;

export interface ConfirmedMealItem {
  foodId: string;
  name: string;
  qty: number;
}

export interface ConfirmedMeal {
  clientMealId: string;
  dateKey: string;
  items: ConfirmedMealItem[];
  totals: Totals;
  confirmedAt: string;
}

export interface RecommendationCandidate {
  food: Food;
  score: number;
  reasonKeys: NutrientKey[];
}

export interface RecommendationResult {
  candidates: RecommendationCandidate[];
  reason: string | null;
}

/** 백엔드 /meals/analyze 응답을 UI용으로 옮긴 형태 */
export interface MealAnalysis {
  evaluation: Evaluation;
  recommendations: RecommendationCandidate[];
  warnings: string[];
}

export type Stage =
  | 'welcome'
  | 'consent'
  | 'profile'
  | 'goals'
  | 'search'
  | 'evaluate'
  | 'dailySummary';

export interface AppContextValue {
  profile: Profile | null;
  stage: Stage;
  setStage: (stage: Stage) => void;
  dateKey: string;
  completeProfile: (profile: Profile) => void;
  dailyGoals: Goals | null;
  mealGoals: Goals | null;
  mealItems: MealItem[];
  addFoodToMeal: (food: Food, qty: number) => void;
  undoLastFood: () => void;
  resetMealDraft: () => void;
  confirmMeal: () => Promise<ConfirmedMeal>;
  lastConfirmedMeal: ConfirmedMeal | null;
  dailyMeals: ConfirmedMeal[];
  dailyTotals: Totals | null;
}
