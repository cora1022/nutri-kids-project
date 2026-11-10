// backend/app/services/nutrition/engine.py를 브라우저에서 실행하도록 옮긴 영양 분석 엔진입니다.
// 기준값, 계산 순서, 판정 규칙, 추천 조건과 경고 문구를 서버와 같게 유지합니다.
// 계산 근거는 backend/app/services/nutrition/Algorithm.md를 참고합니다.
import type { AnalysisWarning, NutrientKey } from '../types';
import type { BackendFood } from './foodApi';

type Sex = 'MALE' | 'FEMALE';
type QuantityUnit = 'SERVING' | 'GRAM' | 'MILLILITER';
type Status = 'LOW' | 'ADEQUATE' | 'HIGH' | 'UNKNOWN';

export interface AnalyzeRequest {
  mealType: string;
  eatenAt: string;
  profile: { sex: Sex; age: number; heightCm: number; weightKg: number; mealsPerDay: number };
  items: { foodId: string; quantity: number; quantityUnit: QuantityUnit }[];
  recommendationScope?: 'CU_ONLY' | 'ALL';
}

export interface NutrientAssessment {
  actual: number | null;
  target: number | null;
  upperLimit: number | null;
  unit: string;
  ratio: number | null;
  status: Status;
  quality: string;
}

export interface EngineRecommendation {
  food: BackendFood;
  reasonNutrients: NutrientKey[];
  score: number;
  message: string;
}

export interface EngineResult {
  analysisId: string;
  mealType: string;
  items: {
    foodId: string; name: string; quantity: number; quantityUnit: QuantityUnit;
    resolvedAmount: { amount: number | null; unit: string | null; countUnit?: string; label?: string };
    price: number | null;
  }[];
  totalPrice: number | null;
  nutrients: Record<NutrientKey, NutrientAssessment>;
  recommendations: EngineRecommendation[];
  warnings: AnalysisWarning[];
}

// 1. 연령과 성별 기준표와 EER 계산

const REFERENCE_VERSION = 'KDRI-2025 / EER-KDRI-2020-as-used-in-Gwak-2023 / policy-v1';
const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  kcal: 'kcal', protein: 'g', calcium: 'mg', iron: 'mg',
  vitaminA: 'µgRAE', vitaminC: 'mg', sodium: 'mg',
  carbohydrate: 'g', vitaminD: 'µg',
};
const KEYS = Object.keys(NUTRIENT_UNITS) as NutrientKey[];
const AGE_BANDS: [number, number][] = [[6, 8], [9, 11], [12, 14], [15, 18]];

type RniKey = 'protein' | 'calcium' | 'vitaminA' | 'vitaminC';
const RNI: Record<Sex, Record<RniKey, number[]>> = {
  MALE: {
    protein: [35, 50, 60, 65], calcium: [700, 800, 950, 800],
    vitaminA: [450, 600, 750, 850], vitaminC: [50, 70, 90, 100],
  },
  FEMALE: {
    protein: [35, 45, 55, 55], calcium: [700, 800, 850, 700],
    vitaminA: [400, 550, 650, 650], vitaminC: [50, 70, 90, 100],
  },
};
const VITAMIN_D_AI = [5, 5, 10, 10];
const VITAMIN_D_UL = [40, 60, 100, 100];
const VITAMIN_C_UL = [750, 1100, 1400, 1600];
const CALCIUM_UL: Record<Sex, number[]> = { MALE: [3000, 3000, 3000, 3000], FEMALE: [2500, 2500, 2500, 2500] };
const CARBOHYDRATE_RNI = 130;
const CARBOHYDRATE_AMDR = [0.50, 0.65];

const PA_COEFFICIENTS: Record<Sex, Record<string, number>> = {
  MALE: { SEDENTARY: 1.0, LOW_ACTIVE: 1.13, ACTIVE: 1.26, VERY_ACTIVE: 1.42 },
  FEMALE: { SEDENTARY: 1.0, LOW_ACTIVE: 1.16, ACTIVE: 1.31, VERY_ACTIVE: 1.56 },
};
const DEFAULT_ACTIVITY = 'LOW_ACTIVE';
const ENERGY_BAND = [0.80, 1.20];

interface Target {
  daily: number;
  perMeal: number;
  kind: 'EER' | 'RNI' | 'AI' | 'AMDR_PLAN';
  dailyUl: number | null;
  planningRange: [number, number] | null;
}

function target(daily: number, perMeal: number, kind: Target['kind'], dailyUl: number | null = null,
  planningRange: [number, number] | null = null): Target {
  return { daily, perMeal, kind, dailyUl, planningRange };
}

function ageBand(age: number): number {
  if (!Number.isInteger(age) || age < 6 || age > 18) throw new Error('지원 연령은 만 6-18세입니다.');
  return AGE_BANDS.findIndex(([lo, hi]) => lo <= age && age <= hi);
}

// 경고 문구를 서버와 같게 만들기 위해 파이썬 float 출력 형식을 흉내 냅니다.
function pyFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function calculateEer(sex: Sex, age: number, heightCm: number, weightKg: number) {
  ageBand(age);
  const pa = PA_COEFFICIENTS[sex]?.[DEFAULT_ACTIVITY];
  if (pa === undefined) throw new Error('지원하지 않는 성별 또는 활동단계입니다.');
  if ([heightCm, weightKg].some((v) => !Number.isFinite(v) || v <= 0)) {
    throw new Error('키와 몸무게는 양의 유한수여야 합니다.');
  }
  const h = heightCm / 100;
  const g = age <= 8 ? 20 : 25;
  const [intercept, ageC, weightC, heightC] = sex === 'MALE' ? [88.5, 61.9, 26.7, 903] : [135.3, 30.8, 10.0, 934];
  const result = intercept - ageC * age + pa * (weightC * weightKg + heightC * h) + g;
  if (!Number.isFinite(result) || result <= 0) throw new Error('입력값으로 양의 에너지필요추정량을 계산할 수 없습니다.');
  return {
    pa,
    formula: `${intercept} - ${ageC}*${age} + ${pyFloat(pa)}*(${pyFloat(weightC)}*${pyFloat(weightKg)} + ${heightC}*${pyFloat(h)}) + ${g}`,
    dailyKcal: result,
  };
}

function buildTargets(profile: AnalyzeRequest['profile']) {
  const idx = ageBand(profile.age);
  const sex = profile.sex;
  const n = profile.mealsPerDay;
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error('하루 식사 횟수는 1-6회여야 합니다.');
  const trace = calculateEer(sex, profile.age, profile.heightCm, profile.weightKg);
  const eer = trace.dailyKcal;
  const targets: Partial<Record<NutrientKey, Target>> = { kcal: target(eer, eer / n, 'EER') };
  for (const [key, values] of Object.entries(RNI[sex]) as [RniKey, number[]][]) {
    const ul = key === 'calcium' ? CALCIUM_UL[sex][idx] : key === 'vitaminC' ? VITAMIN_C_UL[idx] : null;
    targets[key] = target(values[idx], values[idx] / n, 'RNI', ul);
  }
  targets.vitaminD = target(VITAMIN_D_AI[idx], VITAMIN_D_AI[idx] / n, 'AI', VITAMIN_D_UL[idx]);
  const [lo, hi] = CARBOHYDRATE_AMDR.map((x) => eer * x / 4);
  targets.carbohydrate = target((lo + hi) / 2, (lo + hi) / 2 / n, 'AMDR_PLAN', null, [lo / n, hi / n]);
  return { targets, trace };
}

// 2. 섭취량 환산과 합산, 상태 판정

interface Value { amount: number | null; quality: string; problem?: string }

function num(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// 파이썬 Decimal(str(value))의 ROUND_HALF_UP과 같은 결과를 냅니다. 입력은 0 이상입니다.
export function rounded(value: number | null, digits = 2): number | null {
  if (value === null) return null;
  const text = String(value);
  if (text.includes('e-')) return 0; // 1e-7 미만이라 반올림하면 0입니다.
  if (text.includes('e')) return value;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length <= digits) return value;
  const scaled = BigInt(whole + fraction.slice(0, digits)) + (fraction[digits] >= '5' ? 1n : 0n);
  return Number(`${scaled}e-${digits}`);
}

function servingFactor(food: BackendFood, item: AnalyzeRequest['items'][number]) {
  const basis = num(food.serving?.amount);
  const unit = (food.serving?.unit || '').trim().toLowerCase();
  if (item.quantityUnit === 'SERVING') {
    const amount = basis && (unit === 'g' || unit === 'ml') ? basis * item.quantity : null;
    return { factor: item.quantity as number | null, amount, unit: amount !== null ? unit : null };
  }
  const expected = item.quantityUnit === 'GRAM' ? 'g' : 'ml';
  if (basis === null || basis <= 0 || expected !== unit) return { factor: null, amount: item.quantity, unit: expected };
  return { factor: item.quantity / basis, amount: item.quantity, unit: expected };
}

// 서버 3.12의 sum()과 같은 Neumaier 보정 합계입니다. 소수 둘째 자리 반올림 결과를 서버와 맞춥니다.
function pySum(values: number[]): number {
  let total = 0;
  let compensation = 0;
  for (const x of values) {
    const t = total + x;
    compensation += Math.abs(total) >= Math.abs(x) ? (total - t) + x : (x - t) + total;
    total = t;
  }
  return compensation && Number.isFinite(compensation) ? total + compensation : total;
}

// 검색 API 응답에는 DB에 행이 없던 성분도 value null로 채워져 있습니다.
// 성분이 하나도 없는 상품만 행이 없는 것으로 보고, 나머지 null은 값이 비어 있는 행으로 봅니다.
function hasStoredRows(food: BackendFood): boolean {
  return Object.values(food.nutrients ?? {}).some((row) => row && (row.value !== null || row.source !== 'NONE'));
}

function normalizedValue(food: BackendFood, key: NutrientKey): Value {
  const row = food.nutrients?.[key];
  if (!row || !hasStoredRows(food)) return { amount: null, quality: 'MISSING', problem: '성분값 없음' };
  const value = num(row.value);
  if (value === null || !['CONFIRMED', 'ESTIMATED', 'MIXED'].includes(row.quality ?? '')) {
    return { amount: null, quality: 'MISSING', problem: '성분값 또는 품질 미확인' };
  }
  const unit = (row.unit || '').replace(/[μµ]/g, 'u').replace(/ /g, '').toLowerCase();
  const targetUnit = NUTRIENT_UNITS[key].replace('µ', 'u').toLowerCase();
  const masses: Record<string, number> = { g: 0, mg: -3, ug: -6 };
  if (unit === targetUnit) return { amount: value, quality: row.quality! };
  if (targetUnit in masses && unit in masses) {
    return { amount: value * 10 ** (masses[unit] - masses[targetUnit]), quality: row.quality! };
  }
  return { amount: null, quality: 'MISSING', problem: `단위 불일치 (${row.unit} -> ${NUTRIENT_UNITS[key]})` };
}

function readValues(food: BackendFood, factor: number | null): Record<NutrientKey, Value> {
  const result = {} as Record<NutrientKey, Value>;
  for (const key of KEYS) {
    const value = normalizedValue(food, key);
    if (factor === null) result[key] = { amount: null, quality: 'MISSING', problem: '섭취 단위 환산 불가' };
    else if (value.amount === null) result[key] = value;
    else {
      const amount = value.amount * factor;
      result[key] = Number.isFinite(amount) ? { amount, quality: value.quality }
        : { amount: null, quality: 'MISSING', problem: '환산값 범위 초과' };
    }
  }
  return result;
}

function aggregate(values: Value[]): Value {
  if (!values.length || values.some((v) => v.amount === null)) {
    return { amount: null, quality: 'MISSING', problem: '일부 또는 전체 상품의 성분 미확인' };
  }
  const qualities = new Set(values.map((v) => v.quality));
  const quality = qualities.size === 1 ? values[0].quality : 'MIXED';
  const total = pySum(values.map((v) => v.amount as number));
  if (!Number.isFinite(total)) return { amount: null, quality: 'MISSING', problem: '합계 범위 초과' };
  return { amount: total, quality };
}

function assess(value: Value, t: Target | undefined): [number | null, Status] {
  if (value.amount === null || !t) return [null, 'UNKNOWN'];
  const actual = value.amount;
  const ratio = actual / t.perMeal;
  if (t.dailyUl !== null && actual > t.dailyUl) return [ratio, 'HIGH'];
  if (t.kind === 'AI') return [ratio, actual >= t.perMeal ? 'ADEQUATE' : 'UNKNOWN'];
  let lo: number;
  let hi: number;
  if (t.kind === 'EER') [lo, hi] = ENERGY_BAND.map((r) => t.perMeal * r);
  else if (t.planningRange) [lo, hi] = t.planningRange;
  else return [ratio, actual < t.perMeal ? 'LOW' : 'ADEQUATE'];
  return [ratio, actual < lo ? 'LOW' : actual > hi ? 'HIGH' : 'ADEQUATE'];
}

// 3. 보완 식품 추천

function foodResponse(food: BackendFood, values: Record<NutrientKey, Value>): BackendFood {
  const nutrients: NonNullable<BackendFood['nutrients']> = {};
  for (const key of KEYS) {
    const value = values[key];
    let source = food.nutrients?.[key]?.source ?? 'NONE';
    if (value.amount === null || !['MFDS', 'NATIONAL_STANDARD', 'MANUFACTURER'].includes(source)) source = 'NONE';
    nutrients[key] = { value: rounded(value.amount), unit: NUTRIENT_UNITS[key], quality: value.quality, source };
  }
  const qualities = new Set(KEYS.map((key) => values[key].quality));
  const overall = (qualities.size === 1 ? values.kcal.quality : 'MIXED') as BackendFood['overallQuality'];
  return { ...food, serving: { ...food.serving, amount: num(food.serving?.amount) }, nutrients, overallQuality: overall };
}

function recommend(catalog: BackendFood[], request: AnalyzeRequest, totals: Record<NutrientKey, Value>,
  targets: Partial<Record<NutrientKey, Target>>): EngineRecommendation[] {
  const targetEntries = Object.entries(targets) as [NutrientKey, Target][];
  const deficits = new Map<NutrientKey, number>();
  for (const [key, t] of targetEntries) {
    if (assess(totals[key], t)[1] === 'LOW') deficits.set(key, t.perMeal - (totals[key].amount as number));
  }
  const totalKcal = totals.kcal.amount;
  if (!deficits.size || totalKcal === null) return [];
  const calorieCap = targets.kcal!.perMeal * ENERGY_BAND[1];
  if (totalKcal >= calorieCap) return [];
  const excluded = new Set(request.items.map((item) => item.foodId));
  const scope = request.recommendationScope ?? 'CU_ONLY';
  const candidates = catalog
    .filter((food) => !excluded.has(food.id))
    .filter((food) => scope === 'CU_ONLY'
      ? food.sourceType === 'CU_PRODUCT' && Boolean(food.itemReportNo)
      : food.sourceType === 'CU_PRODUCT' || food.sourceType === 'STANDARD_FOOD')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const carb = targets.carbohydrate!;
  const ranked: { score: number; food: BackendFood; values: Record<NutrientKey, Value>; keys: NutrientKey[]; estimated: boolean }[] = [];
  for (const food of candidates) {
    const unit = (food.serving?.unit || '').toLowerCase();
    if (!num(food.serving?.amount) || (unit !== 'g' && unit !== 'ml')) continue;
    const values = readValues(food, 1.0);
    if ([...deficits.keys(), 'kcal' as const].some((key) => values[key].amount === null)) continue;
    if (totalKcal + (values.kcal.amount as number) > calorieCap) continue;
    if (targetEntries.some(([k, t]) => t.dailyUl !== null && totals[k].amount !== null
      && (values[k].amount === null || (totals[k].amount as number) + (values[k].amount as number) > t.dailyUl))) continue;
    if (totals.carbohydrate.amount !== null && (values.carbohydrate.amount === null
      || totals.carbohydrate.amount + values.carbohydrate.amount > carb.planningRange![1])) continue;
    const gains = new Map<NutrientKey, number>();
    for (const [k, gap] of deficits) gains.set(k, Math.min(values[k].amount as number, gap) / targets[k]!.perMeal);
    const score = pySum([...gains.values()]) / deficits.size;
    if (score <= 0) continue;
    const keys = [...gains].filter(([, gain]) => gain > 0).map(([k]) => k).sort();
    const estimated = KEYS.some((k) => values[k].amount !== null && values[k].quality !== 'CONFIRMED');
    ranked.push({ score, food, values, keys, estimated });
  }
  ranked.sort((a, b) => b.score - a.score || (a.food.id < b.food.id ? -1 : a.food.id > b.food.id ? 1 : 0));
  return ranked.slice(0, 3).map(({ score, food, values, keys, estimated }) => ({
    food: foodResponse(food, values), reasonNutrients: keys, score: rounded(score, 4) as number,
    message: `1회 제공량 기준 ${keys.join(', ')}의 남은 한 끼 계획량을 보완합니다. `
      + (estimated ? '추정 성분값을 포함한 추천입니다.' : '확인된 성분값으로 비교했습니다.'),
  }));
}

// 4. 분석 진입점

function validate(request: AnalyzeRequest) {
  const { profile, items } = request;
  if (!items.length || items.length > 30) throw new Error('한 끼에는 1-30개 음식을 담을 수 있어요.');
  if (items.some((item) => !(item.quantity > 0 && item.quantity <= 10000))) throw new Error('섭취량은 0보다 커야 합니다.');
  if (!(profile.heightCm > 80 && profile.heightCm <= 230)) throw new Error('키 값을 다시 확인해 주세요.');
  if (!(profile.weightKg > 20 && profile.weightKg <= 250)) throw new Error('몸무게 값을 다시 확인해 주세요.');
}

export function analyzeMealLocally(request: AnalyzeRequest, catalog: BackendFood[]): EngineResult {
  validate(request);
  const foodsById = new Map(catalog.map((food) => [food.id, food]));
  const missingIds = [...new Set(request.items.map((item) => item.foodId))].filter((id) => !foodsById.has(id)).sort();
  if (missingIds.length) throw new Error(`등록되지 않은 상품입니다: ${missingIds.join(', ')}`);

  const { targets, trace } = buildTargets(request.profile);
  const warning = (code: string, message: string, foodId: string | null = null): AnalysisWarning => ({ code, message, foodId });
  const warnings: AnalysisWarning[] = [
    warning('REFERENCE_VERSION', REFERENCE_VERSION),
    warning('ACTIVITY_ASSUMED', `활동량 입력이 없어 저활동적 PA=${pyFloat(trace.pa)}를 가정했습니다. `
      + '개인의 실제 활동량을 측정한 값이 아닙니다.'),
    warning('ENERGY_CALCULATION', `EER = ${trace.formula} = ${pyFloat(rounded(trace.dailyKcal) as number)} kcal/일; `
      + `한 끼 목표 = 일일 목표 / ${request.profile.mealsPerDay}.`),
    warning('MEAL_PLANNING_POLICY', '한 끼 균등 배분은 서비스 정책입니다. LOW/ADEQUATE/HIGH는 계획량 비교이며 '
      + '영양 결핍이나 과잉 진단이 아닙니다. 에너지 80-120% 범위도 서비스 정책입니다.'),
    warning('DAILY_UL_NOT_MEAL_LIMIT', '칼슘, 비타민 C와 D의 upperLimit은 하루 상한섭취량입니다. '
      + '다른 식사와 보충제는 합산되지 않아 하루 초과 여부를 확정할 수 없습니다.'),
    warning('VITAMIN_A_UL_NOT_ASSESSED', '비타민 A 총 RAE에는 카로티노이드가 포함될 수 있어 레티놀 상한과 직접 비교하지 않습니다. '
      + 'upperLimit=null은 상한이 없다는 의미가 아닙니다.'),
    warning('OUT_OF_SCOPE_REFERENCE', '철분과 나트륨은 기존 JSON 키와 섭취량만 유지합니다. 이번 평가 기준 범위 밖이므로 '
      + 'target/ratio/upperLimit=null, status=UNKNOWN입니다.'),
    warning('CARBOHYDRATE_PLANNING_RANGE', '탄수화물 target은 EER의 50-65%를 4 kcal/g으로 환산한 계획범위 중간값입니다. '
      + '실제 섭취 에너지 비율이나 130g/일 권장섭취량과는 구분합니다.'),
  ];
  const carbConflict = targets.carbohydrate!.daily < CARBOHYDRATE_RNI;
  if (carbConflict) {
    warnings.push(warning('ENERGY_REFERENCE_CONFLICT', '입력 체위로 계산한 탄수화물 계획량이 130g/일 권장섭취량보다 낮습니다. '
      + '키와 몸무게를 확인하고 개별 식사계획을 검토해야 합니다. 탄수화물 상태 판정과 자동 추천을 보류합니다.'));
  }

  const itemValues: Record<NutrientKey, Value>[] = [];
  const prices: (number | null)[] = [];
  const items: EngineResult['items'] = [];
  for (const item of request.items) {
    const food = foodsById.get(item.foodId)!;
    const { factor, amount, unit } = servingFactor(food, item);
    const values = readValues(food, factor);
    itemValues.push(values);
    const price = num(food.price);
    const linePrice = price !== null && factor !== null ? Math.trunc(rounded(price * factor, 0) as number) : null;
    prices.push(linePrice);
    items.push({
      foodId: item.foodId, name: food.name, quantity: item.quantity, quantityUnit: item.quantityUnit,
      resolvedAmount: { amount: rounded(amount, 3), unit, countUnit: food.serving?.countUnit, label: food.serving?.label },
      price: linePrice,
    });
    if (factor === null) {
      warnings.push(warning('QUANTITY_CONVERSION_UNAVAILABLE',
        '제공량 또는 단위가 맞지 않아 환산할 수 없습니다. g와 ml를 동일시하지 않습니다.', food.id));
    }
    const missing = KEYS.filter((key) => values[key].amount === null).map((key) => `${key}: ${values[key].problem}`);
    if (missing.length) warnings.push(warning('NUTRIENT_DATA_MISSING', missing.join('; '), food.id));
  }

  const totals = Object.fromEntries(KEYS.map((key) => [key, aggregate(itemValues.map((v) => v[key]))])) as Record<NutrientKey, Value>;
  const nutrients = {} as Record<NutrientKey, NutrientAssessment>;
  for (const key of KEYS) {
    const value = totals[key];
    const t = targets[key];
    const [ratio, assessed] = assess(value, t);
    const status = key === 'carbohydrate' && carbConflict ? 'UNKNOWN' : assessed;
    nutrients[key] = {
      actual: rounded(value.amount), target: t ? rounded(t.perMeal) : null, upperLimit: t ? t.dailyUl : null,
      unit: NUTRIENT_UNITS[key], ratio: rounded(ratio, 4), status, quality: value.quality,
    };
  }
  if (totals.vitaminD.amount !== null && nutrients.vitaminD.status === 'UNKNOWN') {
    warnings.push(warning('AI_BELOW_NOT_DIAGNOSIS', '비타민 D 섭취량이 배분된 충분섭취량보다 낮지만, 이것만으로 부족을 판정할 수 없습니다.'));
  }
  if (KEYS.some((key) => totals[key].quality === 'ESTIMATED' || totals[key].quality === 'MIXED')) {
    warnings.push(warning('ESTIMATED_NUTRIENTS', '추정 성분값이 포함됩니다. quality는 섭취 성분 데이터 품질이며 목표량의 정확도를 뜻하지 않습니다.'));
  }
  const recommendations = carbConflict ? [] : recommend(catalog, request, totals, targets);
  if (recommendations.length) {
    warnings.push(warning('RECOMMENDATION_POLICY', '추천 점수는 부족한 계획량을 보완하는 비율의 평균(서비스 정책)입니다. '
      + '각 후보 1회 제공량을 개별 비교하며 여러 후보의 동시 섭취를 제안하지 않습니다. '
      + '철분과 나트륨, 알레르기, 질환, 재고는 평가하지 않습니다.'));
  } else if (KEYS.some((key) => nutrients[key].status === 'LOW')) {
    warnings.push(warning('NO_ELIGIBLE_RECOMMENDATION', '보완이 가능한 계획량이 있으나 데이터, 범위와 추가 열량 조건을 만족하는 추천 후보가 없습니다.'));
  }
  if (prices.some((p) => p === null)) {
    warnings.push(warning('PRICE_UNAVAILABLE', '일부 가격 또는 섭취량 환산이 미확인되어 totalPrice=null입니다.'));
  }
  return {
    analysisId: `analysis_${crypto.randomUUID().replace(/-/g, '')}`, mealType: request.mealType, items,
    totalPrice: prices.every((p) => p !== null) ? prices.reduce<number>((sum, p) => sum + (p as number), 0) : null,
    nutrients, recommendations, warnings,
  };
}
