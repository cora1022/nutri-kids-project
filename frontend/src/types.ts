export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbohydrate'
  | 'calcium'
  | 'iron'
  | 'vitaminA'
  | 'vitaminC'
  | 'vitaminD'
  | 'sodium';

export type NutrientKind = 'target' | 'adequateIntake' | 'unassessed';

export interface NutrientMetaEntry {
  key: NutrientKey;
  label: string;
  unit: string;
  kind: NutrientKind;
}

export type NutrientValues = Partial<Record<NutrientKey, number | null>>;

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
  nickname?: string;
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

export type Goals = Record<NutrientKey, number | null>;

export type EvaluationStatus = 'deficient' | 'ok' | 'over' | 'unknown';

export interface EvaluationItem {
  status: EvaluationStatus;
  value: number | null;
  goal: number | null;
  upperLimit?: number | null;
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
  analysis?: MealAnalysis;
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

export interface AnalysisWarning {
  code: string;
  message: string;
  foodId?: string | null;
}

/** 백엔드 /meals/analyze 응답을 UI용으로 옮긴 형태 */
export interface MealAnalysis {
  evaluation: Evaluation;
  recommendations: RecommendationCandidate[];
  warnings: AnalysisWarning[];
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  profileCompleted: boolean;
}

export type Stage =
  | 'welcome'
  | 'consent'
  | 'profile'
  | 'goals'
  | 'search'
  | 'evaluate'
  | 'dailySummary'
  | 'settings';

export type EntryMode = 'google' | 'guest';

export interface AppContextValue {
  user: AuthUser | null;
  authReady: boolean;
  authError: string;
  googleEnabled: boolean;
  startGoogleLogin: () => void;
  logout: () => Promise<void>;
  entryMode: EntryMode;
  beginEntry: (mode: EntryMode) => void;
  openSettings: () => void;
  closeSettings: () => void;
  editProfile: () => void;
  cancelProfileEdit: () => void;
  profile: Profile | null;
  stage: Stage;
  setStage: (stage: Stage) => void;
  dateKey: string;
  completeProfile: (profile: Profile) => Promise<void>;
  dailyGoals: Goals | null;
  mealGoals: Goals | null;
  mealItems: MealItem[];
  addFoodToMeal: (food: Food, qty: number) => void;
  undoLastFood: () => void;
  resetMealDraft: () => void;
  confirmMeal: (analysis?: MealAnalysis) => Promise<ConfirmedMeal>;
  lastConfirmedMeal: ConfirmedMeal | null;
  dailyMeals: ConfirmedMeal[];
  dailyTotals: Totals | null;
  dailyAnalysis: Evaluation | null;
  dailyWarnings: AnalysisWarning[];
  dailyIsPartial: boolean;
  dailyError: string;
  dailyLoading: boolean;
  refreshDaily: (date?: string) => Promise<void>;
}
