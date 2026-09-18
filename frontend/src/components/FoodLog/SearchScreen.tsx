import { useState, type FormEvent } from 'react';
import Button from '../common/Button';
import { Card, EmptyState, ScreenShell } from '../common/Card';
import StageTracker from '../common/StageTracker';
import { searchFoods } from '../../services/foodApi';
import { useApp } from '../../hooks/useApp';
import { computeItemNutrients } from '../../utils/nutrition';
import { NUTRIENT_META } from '../../data/goals';
import type { Food, OverallQuality } from '../../types';

const QUALITY_LABEL: Record<OverallQuality, string> = {
  CONFIRMED: '식약처 확인',
  ESTIMATED: '국가표준 추정',
  MIXED: '일부 확인',
  MISSING: '영양 미확인',
};

interface AmountPickerProps {
  food: Food;
  onCancel: () => void;
  onConfirm: (qty: number) => void;
}

function AmountPicker({ food, onCancel, onConfirm }: AmountPickerProps) {
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  function step(delta: number) {
    setQty((q) => Math.max(0.5, Math.round((q + delta) * 2) / 2));
  }

  function handleConfirm() {
    if (!(qty > 0)) {
      setError('먹은 양은 0보다 커야 해요');
      return;
    }
    onConfirm(qty);
  }

  const preview = computeItemNutrients(food, qty);

  return (
    <Card tone="highlight" className="amount-picker">
      <h3>{food.name}</h3>
      <p className="muted-line">{food.brand ? `${food.brand} · ` : ''}기본 1회 제공량 {food.servingLabel}</p>

      <div className="qty-stepper">
        <button type="button" onClick={() => step(-0.5)} aria-label="양 줄이기">
          −
        </button>
        <span>
          {qty}
          {food.unit}
        </span>
        <button type="button" onClick={() => step(0.5)} aria-label="양 늘리기">
          +
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}

      <div className="nutrient-chip-row">
        {NUTRIENT_META.map(({ key, label, unit }) => (
          <span key={key} className={`nutrient-chip ${preview[key] === null ? 'unknown' : ''}`}>
            {label} {preview[key] === null ? '미확인' : `${Math.round(preview[key] as number)}${unit}`}
          </span>
        ))}
      </div>

      <div className="button-row">
        <Button variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={handleConfirm}>이 양으로 담기</Button>
      </div>
    </Card>
  );
}

export default function SearchScreen() {
  const { mealItems, addFoodToMeal, undoLastFood, setStage } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null); // null = 검색 전
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const found = await searchFoods(query);
    setResults(found);
    setSearching(false);
  }

  function handlePick(food: Food) {
    setSelectedFood(food);
  }

  function handleAmountConfirm(qty: number) {
    if (!selectedFood) return;
    addFoodToMeal(selectedFood, qty);
    setSelectedFood(null);
    setResults(null);
    setQuery('');
  }

  return (
    <ScreenShell
      eyebrow="02 상품 검색 · 음식 입력"
      title="오늘 뭘 먹었나요?"
      subtitle="편의점 상품이든 집밥이든 검색해서 담아주세요"
      headerAction={
        <Button variant="ghost" onClick={() => setStage('profile')}>
          ⚙ 목표 수정
        </Button>
      }
    >
      <StageTracker current="search" />

      {selectedFood ? (
        <AmountPicker food={selectedFood} onCancel={() => setSelectedFood(null)} onConfirm={handleAmountConfirm} />
      ) : (
        <>
          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="상품명으로 검색 (예: 삼각김밥, 우유)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={searching}>
              {searching ? '검색 중…' : '검색'}
            </Button>
          </form>

          {results !== null && (
            <div className="result-list">
              {results.length === 0 ? (
                <EmptyState icon="🔍" title="검색 결과가 없어요" description="다른 이름으로 다시 검색해 보세요" />
              ) : (
                results.map((food) => (
                  <button key={food.id} className="result-row" onClick={() => handlePick(food)}>
                    <span className="result-name">{food.name}</span>
                    <span className="result-meta">
                      {food.brand ? `${food.brand} · ` : ''}
                      {food.servingLabel} · {food.nutrients.kcal === null ? '열량 미확인' : `${Math.round(food.nutrients.kcal)}kcal`}
                      {food.itemReportStatus && ` · ${food.itemReportStatus}`}
                      {' · '}{(food.overallQuality && QUALITY_LABEL[food.overallQuality]) || '출처 미확인'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      <div className="meal-stack">
        <h3>지금까지 담은 음식 ({mealItems.length})</h3>
        {mealItems.length === 0 ? (
          <p className="muted-line">아직 담은 음식이 없어요</p>
        ) : (
          <ul>
            {mealItems.map((item) => (
              <li key={item.key}>
                <span>
                  {item.food.name} × {item.qty}{item.food.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="next-action-bar">
        <Button variant="secondary" disabled={mealItems.length === 0} onClick={undoLastFood}>
          최근 취소
        </Button>
        <Button disabled={mealItems.length === 0} onClick={() => setStage('evaluate')}>
          한 끼 평가로 이동
        </Button>
      </div>
    </ScreenShell>
  );
}
