import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppContext } from './appContextObject';
import { getDailyGoals, getMealGoals } from '../data/goals';
import {
  clearDraftMeal, loadDraftMeal, loadMealsByDate, loadProfile, saveConfirmedMeal,
  saveDraftMeal, saveProfile, loadDraftIdentity, saveDraftIdentity,
} from '../utils/storage';
import { addTotals, sumNutrients } from '../utils/nutrition';
import {
  getAccount, getAuthConfig, logoutAccount, saveAccountProfile, startGoogleLogin,
  toUiGoals, toUiProfile, type AccountResponse,
} from '../services/accountApi';
import {
  getDailyMeals, koreanDate, saveMeal, toConfirmedMeal, toEvaluation, type DailyResponse,
} from '../services/mealApi';
import type { AppContextValue, ConfirmedMeal, Food, MealAnalysis, MealItem, Profile, Stage } from '../types';

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stage, setStage] = useState<Stage>('welcome');
  const [dateKey, setDateKey] = useState(koreanDate);
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [lastConfirmedMeal, setLastConfirmedMeal] = useState<ConfirmedMeal | null>(null);
  const [dailyMeals, setDailyMeals] = useState<ConfirmedMeal[]>([]);
  const [serverDaily, setServerDaily] = useState<DailyResponse | null>(null);
  const [dailyError, setDailyError] = useState('');
  const [dailyLoading, setDailyLoading] = useState(false);
  const saving = useRef<Promise<ConfirmedMeal> | null>(null);
  const dailyRequest = useRef(0);
  const scope = account?.user.id ?? 'guest';

  const applyDaily = useCallback((result: DailyResponse) => {
    setServerDaily(result);
    setDailyMeals(result.meals.map(toConfirmedMeal));
    setDateKey(result.date);
    setDailyError('');
    setDailyLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getAccount(), getAuthConfig()]).then(async ([result, config]) => {
      if (!active) return;
      setGoogleEnabled(config.googleEnabled);
      setAccount(result);
      const storedProfile = result?.profile ? toUiProfile(result.profile) : result ? null : loadProfile();
      setProfile(storedProfile);
      setMealItems(loadDraftMeal(koreanDate(), result?.user.id ?? 'guest'));
      setStage(storedProfile ? 'search' : result ? 'profile' : 'welcome');
      setAuthReady(true);
      if (result?.profile) {
        setDailyLoading(true);
        const requestId = ++dailyRequest.current;
        try {
          const daily = await getDailyMeals(koreanDate());
          if (active && dailyRequest.current === requestId) applyDaily(daily);
        } catch (error) {
          if (active && dailyRequest.current === requestId) setDailyError(error instanceof Error ? error.message : '기록을 불러오지 못했어요.');
        } finally {
          if (active && dailyRequest.current === requestId) setDailyLoading(false);
        }
      } else if (!result) {
        setDailyMeals(loadMealsByDate(koreanDate()));
      }
    }).catch((error: Error) => {
      if (active) { setAuthError(error.message); setAuthReady(true); }
    });
    return () => { active = false; };
  }, [applyDaily]);

  useEffect(() => {
    if (authReady && !authError) saveDraftMeal(koreanDate(), mealItems, scope);
  }, [mealItems, scope, authReady, authError]);

  const dailyGoals = useMemo(() => account?.goals ? toUiGoals(account.goals.daily)
    : profile ? getDailyGoals(profile) : null, [account, profile]);
  const mealGoals = useMemo(() => account?.goals ? toUiGoals(account.goals.perMeal)
    : dailyGoals && profile ? getMealGoals(dailyGoals, profile.mealsPerDay) : null,
  [account, dailyGoals, profile]);

  async function completeProfile(newProfile: Profile) {
    if (account) {
      const result = await saveAccountProfile(newProfile);
      setAccount(result);
      setProfile(result.profile ? toUiProfile(result.profile) : null);
      // 프로필 저장이 성공한 뒤 기록 재조회에 실패하면 별도 오류로 표시한다.
      try { applyDaily(await getDailyMeals(dateKey)); }
      catch (error) { setDailyError(error instanceof Error ? error.message : '기록을 불러오지 못했어요.'); }
    } else {
      if (!saveProfile(newProfile)) throw new Error('프로필을 저장하지 못했어요.');
      setProfile(newProfile);
    }
    setStage('goals');
  }

  function addFoodToMeal(food: Food, qty: number) {
    setMealItems((prev) => [...prev, { food, qty, key: crypto.randomUUID() }]);
  }

  function undoLastFood() { setMealItems((prev) => prev.slice(0, -1)); }

  function resetMealDraft() {
    setMealItems([]);
    clearDraftMeal(koreanDate(), scope);
    saveDraftIdentity(scope, null);
  }

  const refreshDaily = useCallback(async (date = koreanDate()) => {
    const requestId = ++dailyRequest.current;
    setDailyError('');
    setDateKey(date);
    setDailyLoading(true);
    if (account) {
      try {
        const result = await getDailyMeals(date);
        if (dailyRequest.current === requestId) applyDaily(result);
      }
      catch (error) {
        if (dailyRequest.current === requestId) setDailyError(error instanceof Error ? error.message : '기록을 불러오지 못했어요.');
      } finally {
        if (dailyRequest.current === requestId) setDailyLoading(false);
      }
    } else {
      setDateKey(date);
      setDailyMeals(loadMealsByDate(date));
      setDailyLoading(false);
    }
  }, [account, applyDaily]);

  async function persistMeal(analysis?: MealAnalysis): Promise<ConfirmedMeal> {
    if (!profile || mealItems.length === 0) throw new Error('저장할 식사가 없어요.');
    const signature = JSON.stringify(mealItems.map(({ food, qty }) => [food.id, qty]));
    const previous = loadDraftIdentity(scope);
    const identity = previous?.signature === signature ? previous
      : { id: crypto.randomUUID(), eatenAt: new Date().toISOString(), signature };
    if (!saveDraftIdentity(scope, identity)) throw new Error('임시 저장에 실패했어요. 다시 시도해 주세요.');
    const day = koreanDate(new Date(identity.eatenAt));
    const record: ConfirmedMeal = { clientMealId: identity.id, dateKey: day,
      items: mealItems.map(({ food, qty }) => ({ foodId: food.id, name: food.name, qty })),
      totals: sumNutrients(mealItems), confirmedAt: identity.eatenAt, analysis };
    const saved = account ? await saveMeal(profile, mealItems, identity.id, identity.eatenAt)
      : await saveConfirmedMeal(day, record);
    setLastConfirmedMeal(saved);
    setDateKey(saved.dateKey);
    setDailyMeals((prev) => [...prev.filter((meal) => meal.clientMealId !== saved.clientMealId), saved]);
    resetMealDraft();
    // 확정 저장은 성공했으므로 재조회 실패 때문에 같은 식사를 다시 저장하지 않는다.
    await refreshDaily(saved.dateKey);
    return saved;
  }

  function confirmMeal(analysis?: MealAnalysis): Promise<ConfirmedMeal> {
    if (saving.current) return saving.current;
    const pending = persistMeal(analysis).finally(() => { saving.current = null; });
    saving.current = pending;
    return pending;
  }

  async function logout() {
    await logoutAccount();
    window.location.assign('/');
  }

  const dailyTotals = useMemo(() => dailyMeals.reduce<ReturnType<typeof sumNutrients> | null>(
    (acc, meal) => acc ? addTotals(acc, meal.totals) : meal.totals, null), [dailyMeals]);

  const value: AppContextValue = {
    user: account?.user ?? null, authReady, authError, googleEnabled, startGoogleLogin, logout,
    profile, stage, setStage, dateKey, completeProfile, dailyGoals, mealGoals, mealItems,
    addFoodToMeal, undoLastFood, resetMealDraft, confirmMeal, lastConfirmedMeal, dailyMeals, dailyTotals,
    dailyAnalysis: serverDaily ? toEvaluation(serverDaily.dailyAnalysis.nutrients) : null,
    dailyWarnings: serverDaily?.dailyAnalysis.warnings ?? [],
    dailyIsPartial: serverDaily?.isPartial ?? dailyMeals.length < (profile?.mealsPerDay ?? 3),
    dailyError, dailyLoading, refreshDaily,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
