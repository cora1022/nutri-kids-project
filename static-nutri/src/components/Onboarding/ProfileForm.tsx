import { useState, type FormEvent } from 'react';
import Button from '../common/Button';
import { ScreenShell } from '../common/Card';
import { useApp } from '../../hooks/useApp';
import type { Gender } from '../../types';

const MIN_AGE = 6;
const MAX_AGE = 18;
// 백엔드 AnalysisProfile 검증 범위와 같게 유지한다.
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 230;
const MIN_WEIGHT = 20;
const MAX_WEIGHT = 250;

interface FormState {
  nickname: string;
  gender: Gender;
  age: string;
  height: string;
  weight: string;
  mealsPerDay: string;
}

interface FormErrors {
  nickname?: string;
  age?: string;
  height?: string;
  weight?: string;
  mealsPerDay?: string;
}

export default function ProfileForm() {
  const { profile, user, completeProfile, cancelProfileEdit } = useApp();
  const isEditing = Boolean(profile);
  const [form, setForm] = useState<FormState>(() =>
    profile
      ? {
          nickname: profile.nickname ?? user?.nickname ?? '',
          gender: profile.gender,
          age: String(profile.age),
          height: String(profile.height),
          weight: String(profile.weight),
          mealsPerDay: String(profile.mealsPerDay),
        }
      : { nickname: user?.nickname ?? '', gender: 'female', age: '', height: '', weight: '', mealsPerDay: '3' }
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (user && (!form.nickname.trim() || form.nickname.trim().length > 40)) next.nickname = '닉네임은 1~40자로 입력해 주세요';
    const age = Number(form.age);
    const height = Number(form.height);
    const weight = Number(form.weight);

    if (!form.age || Number.isNaN(age)) next.age = '나이를 입력해 주세요';
    else if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) next.age = `나이는 ${MIN_AGE}~${MAX_AGE}세 정수로 입력해 주세요`;

    if (!form.height || Number.isNaN(height) || height <= 0) next.height = '키를 정확히 입력해 주세요 (cm)';
    else if (height <= MIN_HEIGHT || height > MAX_HEIGHT) next.height = `키는 ${MIN_HEIGHT}cm보다 크고 ${MAX_HEIGHT}cm 이하로 입력해 주세요`;
    if (!form.weight || Number.isNaN(weight) || weight <= 0) next.weight = '몸무게를 정확히 입력해 주세요 (kg)';
    else if (weight <= MIN_WEIGHT || weight > MAX_WEIGHT) next.weight = `몸무게는 ${MIN_WEIGHT}kg보다 크고 ${MAX_WEIGHT}kg 이하로 입력해 주세요`;
    if (!form.mealsPerDay) next.mealsPerDay = '하루 식사 횟수를 선택해 주세요';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try { await completeProfile({
      nickname: form.nickname.trim(),
      gender: form.gender,
      age: Number(form.age),
      height: Number(form.height),
      weight: Number(form.weight),
      mealsPerDay: Number(form.mealsPerDay),
    }); }
    catch (error) { setSaveError(error instanceof Error ? error.message : '프로필을 저장하지 못했어요.'); }
    finally { setSaving(false); }
  }

  return (
    <ScreenShell
      eyebrow="가입과 목표 설정"
      title={isEditing ? '정보를 수정해 주세요' : '몇 가지만 알려주세요'}
      subtitle="목표를 계산하는 데만 사용해요"
    >
      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="nickname">닉네임</label>
          <input id="nickname" maxLength={40} value={form.nickname} onChange={(e) => update('nickname', e.target.value)} />
          {errors.nickname && <p className="field-error">{errors.nickname}</p>}
        </div>
        <fieldset>
          <legend>성별</legend>
          <div className="segmented">
            <label className={form.gender === 'female' ? 'active' : ''}>
              <input type="radio" name="gender" value="female" checked={form.gender === 'female'} onChange={() => update('gender', 'female')} />
              여자
            </label>
            <label className={form.gender === 'male' ? 'active' : ''}>
              <input type="radio" name="gender" value="male" checked={form.gender === 'male'} onChange={() => update('gender', 'male')} />
              남자
            </label>
          </div>
        </fieldset>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="age">나이(세)</label>
            <input id="age" type="number" inputMode="numeric" value={form.age} onChange={(e) => update('age', e.target.value)} />
            {errors.age && <p className="field-error">{errors.age}</p>}
          </div>
          <div className="field">
            <label htmlFor="height">키(cm)</label>
            <input id="height" type="number" inputMode="decimal" value={form.height} onChange={(e) => update('height', e.target.value)} />
            {errors.height && <p className="field-error">{errors.height}</p>}
          </div>
          <div className="field">
            <label htmlFor="weight">몸무게(kg)</label>
            <input id="weight" type="number" inputMode="decimal" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
            {errors.weight && <p className="field-error">{errors.weight}</p>}
          </div>
        </div>

        <fieldset>
          <legend>하루에 몇 끼 기록할까요?</legend>
          <div className="segmented">
            {['2', '3', '4'].map((n) => (
              <label key={n} className={form.mealsPerDay === n ? 'active' : ''}>
                <input type="radio" name="meals" value={n} checked={form.mealsPerDay === n} onChange={() => update('mealsPerDay', n)} />
                {n}끼
              </label>
            ))}
          </div>
          {errors.mealsPerDay && <p className="field-error">{errors.mealsPerDay}</p>}
        </fieldset>

        {saveError && <p className="field-error" role="alert">{saveError}</p>}
        <Button type="submit" size="lg" fullWidth disabled={saving}>
          {saving ? '저장 중…' : isEditing ? '수정한 정보로 목표 다시 계산하기' : '목표 계산하기'}
        </Button>
        <Button type="button" variant="ghost" size="lg" fullWidth onClick={cancelProfileEdit}>취소하고 돌아가기</Button>
      </form>
    </ScreenShell>
  );
}
