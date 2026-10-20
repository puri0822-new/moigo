import { useEffect, useState } from 'react';
import { apiGet } from './api';

/** ai_models.code. 모델은 코드가 아니라 DB에서 추가하므로 문자열로 둔다 */
export type AiModel = string;

export interface AiProfile {
  model: AiModel;
  name: string;
  color: string;
  // false면 더 이상 새 추천을 내지 않는 모델 (지난 성적표에만 남는다)
  isActive: boolean;
}

interface ApiAiModel {
  code: string;
  display_name: string;
  provider: string;
  color: string;
  is_active: boolean;
}

// API를 받기 전이나 실패했을 때 쓰는 목록 (DB 시드 값과 같다)
const FALLBACK_MODELS: AiProfile[] = [
  { model: 'CLAUDE', name: 'Claude', color: '#D4714F', isActive: true },
  { model: 'GEMINI', name: 'Gemini', color: '#4285F4', isActive: true },
];

// 목록에 없는 모델(예: 삭제된 모델의 지난 추천)에 쓰는 색
const UNKNOWN_COLOR = '#8B8F98';

// 여러 컴포넌트가 동시에 불러도 요청은 한 번만 보낸다
let cache: AiProfile[] | null = null;
let pending: Promise<AiProfile[]> | null = null;

function loadAiModels(): Promise<AiProfile[]> {
  pending ??= apiGet<ApiAiModel[]>('/ai/models')
    .then(res => {
      cache = res.data.map(m => ({ model: m.code, name: m.display_name, color: m.color, isActive: m.is_active }));
      return cache;
    })
    .catch(() => {
      pending = null; // 다음에 다시 시도한다
      return FALLBACK_MODELS;
    });
  return pending;
}

/** 모든 AI 모델 (중단된 모델 포함, 표시 순서대로) */
export function useAiModels(): AiProfile[] {
  const [models, setModels] = useState<AiProfile[]>(cache ?? FALLBACK_MODELS);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadAiModels().then(m => { if (alive) setModels(m); });
    return () => { alive = false; };
  }, []);

  return models;
}

/** 코드로 모델을 찾는다. 목록에 없으면 코드를 이름으로 쓰는 회색 모델을 돌려준다 */
export function findAiProfile(models: AiProfile[], code: AiModel): AiProfile {
  return models.find(m => m.model === code) ?? { model: code, name: code, color: UNKNOWN_COLOR, isActive: false };
}
