// ⚠️ 간이 참고값입니다.
// 보건복지부 "한국인 영양소 섭취기준(KDRIs)"을 단순화해 표시용으로만 구성했습니다.
// 실제 서비스 적용 전, 영양 전공 팀원이 연령 구간별 공식 수치로 반드시 검증·교체해야 합니다.
// (하한/권장/상한 구분, 성장기 특이사항 등은 여기 반영되어 있지 않습니다.)

import type { Gender, Goals, NutrientMetaEntry, Profile } from '../types';

interface AgeBand {
  min: number;
  max: number;
}

const AGE_BANDS: AgeBand[] = [
  { min: 6, max: 8 },
  { min: 9, max: 11 },
  { min: 12, max: 14 },
  { min: 15, max: 18 },
];

// kcal, protein(g), calcium(mg), iron(mg), vitaminA(µgRAE), vitaminC(mg) 는 "권장/목표"
// sodium(mg) 은 "상한(이 값을 넘지 않는 것이 목표)"
const TABLE: Record<Gender, Goals[]> = {
  male: [
    { kcal: 1700, protein: 35, calcium: 700, iron: 9, vitaminA: 450, vitaminC: 50, sodium: 1600 },
    { kcal: 1900, protein: 40, calcium: 800, iron: 10, vitaminA: 550, vitaminC: 55, sodium: 1900 },
    { kcal: 2500, protein: 55, calcium: 1000, iron: 14, vitaminA: 750, vitaminC: 70, sodium: 2100 },
    { kcal: 2700, protein: 65, calcium: 900, iron: 14, vitaminA: 850, vitaminC: 100, sodium: 2300 },
  ],
  female: [
    { kcal: 1500, protein: 35, calcium: 700, iron: 9, vitaminA: 400, vitaminC: 50, sodium: 1600 },
    { kcal: 1700, protein: 40, calcium: 800, iron: 10, vitaminA: 450, vitaminC: 55, sodium: 1900 },
    { kcal: 2000, protein: 50, calcium: 900, iron: 16, vitaminA: 650, vitaminC: 70, sodium: 1900 },
    { kcal: 2000, protein: 55, calcium: 800, iron: 14, vitaminA: 650, vitaminC: 100, sodium: 1900 },
  ],
};

export const NUTRIENT_META: NutrientMetaEntry[] = [
  { key: 'kcal', label: '칼로리', unit: 'kcal', kind: 'target' },
  { key: 'protein', label: '단백질', unit: 'g', kind: 'target' },
  { key: 'calcium', label: '칼슘', unit: 'mg', kind: 'target' },
  { key: 'iron', label: '철분', unit: 'mg', kind: 'target' },
  { key: 'vitaminA', label: '비타민A', unit: 'µgRAE', kind: 'target' },
  { key: 'vitaminC', label: '비타민C', unit: 'mg', kind: 'target' },
  { key: 'sodium', label: '나트륨', unit: 'mg', kind: 'upperLimit' },
];

function bandIndex(age: number): number {
  const idx = AGE_BANDS.findIndex((b) => age >= b.min && age <= b.max);
  if (idx !== -1) return idx;
  return age < 6 ? 0 : AGE_BANDS.length - 1;
}

export function getDailyGoals(profile: Pick<Profile, 'gender' | 'age'>): Goals {
  const g: Gender = profile.gender === 'female' ? 'female' : 'male';
  const idx = bandIndex(Number(profile.age) || 9);
  return { ...TABLE[g][idx] };
}

// 하루 목표를 식사 횟수로 배분 (하루 목표 자체를 늘리지 않고 나누기만 함)
export function getMealGoals(dailyGoals: Goals, mealsPerDay: number): Goals {
  const n = Math.max(1, Number(mealsPerDay) || 3);
  const mealGoals = {} as Goals;
  (Object.keys(dailyGoals) as (keyof Goals)[]).forEach((k) => {
    mealGoals[k] = dailyGoals[k] / n;
  });
  return mealGoals;
}
