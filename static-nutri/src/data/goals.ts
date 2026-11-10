import type { Gender, Goals, NutrientMetaEntry, Profile } from '../types';

interface AgeBand {
  min: number;
  max: number;
}

type ReferenceNutrient = 'protein' | 'calcium' | 'vitaminA' | 'vitaminC';

const AGE_BANDS: AgeBand[] = [
  { min: 6, max: 8 },
  { min: 9, max: 11 },
  { min: 12, max: 14 },
  { min: 15, max: 18 },
];

const RECOMMENDED_INTAKE: Record<Gender, Record<ReferenceNutrient, number[]>> = {
  male: {
    protein: [35, 50, 60, 65],
    calcium: [700, 800, 950, 800],
    vitaminA: [450, 600, 750, 850],
    vitaminC: [50, 70, 90, 100],
  },
  female: {
    protein: [35, 45, 55, 55],
    calcium: [700, 800, 850, 700],
    vitaminA: [400, 550, 650, 650],
    vitaminC: [50, 70, 90, 100],
  },
};

const VITAMIN_D_ADEQUATE_INTAKE = [5, 5, 10, 10];
const CARBOHYDRATE_AMDR_MIDPOINT = (0.5 + 0.65) / 2;

export const NUTRIENT_META: NutrientMetaEntry[] = [
  { key: 'kcal', label: '열량', unit: 'kcal', kind: 'target' },
  { key: 'protein', label: '단백질', unit: 'g', kind: 'target' },
  { key: 'carbohydrate', label: '탄수화물', unit: 'g', kind: 'target' },
  { key: 'calcium', label: '칼슘', unit: 'mg', kind: 'target' },
  { key: 'iron', label: '철분', unit: 'mg', kind: 'unassessed' },
  { key: 'vitaminA', label: '비타민 A', unit: 'µg RAE', kind: 'target' },
  { key: 'vitaminC', label: '비타민 C', unit: 'mg', kind: 'target' },
  { key: 'vitaminD', label: '비타민 D', unit: 'µg', kind: 'adequateIntake' },
  { key: 'sodium', label: '나트륨', unit: 'mg', kind: 'unassessed' },
];

function bandIndex(age: number): number {
  const index = AGE_BANDS.findIndex(({ min, max }) => age >= min && age <= max);
  if (index === -1) {
    throw new RangeError('영양 목표는 만 6세부터 18세까지만 계산할 수 있습니다.');
  }
  return index;
}

function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${field} 값은 0보다 큰 숫자여야 합니다.`);
  }
}

function calculateEnergyRequirement(profile: Profile): number {
  const age = Number(profile.age);
  const heightM = Number(profile.height) / 100;
  const weightKg = Number(profile.weight);
  const growthEnergy = age <= 8 ? 20 : 25;

  assertPositive(age, '나이');
  assertPositive(heightM, '키');
  assertPositive(weightKg, '몸무게');

  if (profile.gender === 'female') {
    return 135.3 - 30.8 * age + 1.16 * (10 * weightKg + 934 * heightM) + growthEnergy;
  }

  return 88.5 - 61.9 * age + 1.13 * (26.7 * weightKg + 903 * heightM) + growthEnergy;
}

export function getDailyGoals(profile: Profile): Goals {
  const gender: Gender = profile.gender === 'female' ? 'female' : 'male';
  const index = bandIndex(Number(profile.age));
  const kcal = calculateEnergyRequirement(profile);
  const recommended = RECOMMENDED_INTAKE[gender];

  return {
    kcal,
    protein: recommended.protein[index],
    carbohydrate: (kcal * CARBOHYDRATE_AMDR_MIDPOINT) / 4,
    calcium: recommended.calcium[index],
    iron: null,
    vitaminA: recommended.vitaminA[index],
    vitaminC: recommended.vitaminC[index],
    vitaminD: VITAMIN_D_ADEQUATE_INTAKE[index],
    sodium: null,
  };
}

// 서비스 화면에서는 하루 기준을 사용자가 설정한 식사 횟수만큼 균등하게 나눕니다.
export function getMealGoals(dailyGoals: Goals, mealsPerDay: number): Goals {
  const count = Number(mealsPerDay);
  assertPositive(count, '하루 식사 횟수');

  return Object.fromEntries(
    (Object.entries(dailyGoals) as [keyof Goals, number | null][]).map(([key, value]) => [
      key,
      value === null ? null : value / count,
    ]),
  ) as Goals;
}
