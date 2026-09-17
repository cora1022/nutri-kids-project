import { useEffect, useMemo, useState } from 'react';
import { AppContext } from './appContextObject';
import { getDailyGoals, getMealGoals } from '../data/goals';
import {
  clearDraftMeal,
  loadDraftMeal,
  loadMealsByDate,
  loadProfile,
  saveConfirmedMeal,
  saveDraftMeal,
  saveProfile,
} from '../utils/storage';
import { addTotals, sumNutrients } from '../utils/nutrition';

function createDraftMealId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }

  return `meal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfile());
  // stage: welcome | consent | profile | goals | search | evaluate | dailySummary
  const [stage, setStage] = useState(() => (loadProfile() ? 'search' : 'welcome'));
  const [dateKey] = useState(todayKey());
  const [mealItems, setMealItems] = useState(() => loadDraftMeal(todayKey()));
  const [draftMealId, setDraftMealId] = useState(createDraftMealId);
  const [lastConfirmedMeal, setLastConfirmedMeal] = useState(null);
  const [dailyMeals, setDailyMeals] = useState(() => loadMealsByDate(todayKey()));

  useEffect(() => {
    saveDraftMeal(dateKey, mealItems);
  }, [mealItems, dateKey]);

  const dailyGoals = useMemo(() => (profile ? getDailyGoals(profile) : null), [profile]);
  const mealGoals = useMemo(
    () => (dailyGoals && profile ? getMealGoals(dailyGoals, profile.mealsPerDay) : null),
    [dailyGoals, profile]
  );

  function completeProfile(newProfile) {
    setProfile(newProfile);
    saveProfile(newProfile);
    setStage('goals');
  }

  function addFoodToMeal(food, qty) {
    setMealItems((prev) => [...prev, { food, qty, key: `${food.id}-${Date.now()}` }]);
  }

  function undoLastFood() {
    setMealItems((prev) => prev.slice(0, -1));
  }

  function resetMealDraft() {
    setMealItems([]);
    clearDraftMeal(dateKey);
    setDraftMealId(createDraftMealId());
  }

  async function confirmMeal() {
    const totals = sumNutrients(mealItems);
    const record = {
      clientMealId: draftMealId,
      dateKey,
      items: mealItems.map(({ food, qty }) => ({ foodId: food.id, name: food.name, qty })),
      totals,
      confirmedAt: new Date().toISOString(),
    };
    const saved = await saveConfirmedMeal(dateKey, record); // 실패 시 예외 throw (임시 기록은 유지됨)
    setLastConfirmedMeal(saved);
    setDailyMeals((prev) => {
      const idx = prev.findIndex((m) => m.clientMealId === saved.clientMealId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    resetMealDraft();
    return saved;
  }

  const dailyTotals = useMemo(() => {
    if (dailyMeals.length === 0) return null;
    return dailyMeals.reduce((acc, m) => (acc ? addTotals(acc, m.totals) : m.totals), null);
  }, [dailyMeals]);

  const value = {
    profile,
    stage,
    setStage,
    dateKey,
    completeProfile,
    dailyGoals,
    mealGoals,
    mealItems,
    addFoodToMeal,
    undoLastFood,
    resetMealDraft,
    confirmMeal,
    lastConfirmedMeal,
    dailyMeals,
    dailyTotals,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
