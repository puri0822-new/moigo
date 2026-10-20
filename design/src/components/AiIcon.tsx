import { findAiProfile, useAiModels } from '../lib/aiModels';
import type { AiModel } from '../lib/aiModels';

interface AiIconProps {
  model: AiModel;
  size?: number;
}

// Claude의 방사형 별 모양 광선. 길이를 조금씩 달리해 손으로 그린 느낌을 낸다
const CLAUDE_RAYS = [10, 8, 9.5, 7.5, 10, 8.5, 9, 7.5, 10, 8, 9.5, 8];

export default function AiIcon({ model, size = 28 }: AiIconProps) {
  const models = useAiModels();

  if (model === 'CLAUDE') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        {CLAUDE_RAYS.map((len, i) => {
          const angle = (i / CLAUDE_RAYS.length) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={12} y1={12}
              x2={12 + Math.cos(angle) * len} y2={12 + Math.sin(angle) * len}
              stroke="#D97757" strokeWidth={2.4} strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  }

  if (model === 'CLOVA') {
    // 로고 이미지 배경이 흰색이라 다크 테마에서도 어색하지 않게 앱 아이콘처럼 모서리를 둥글린다
    return (
      <img
        src="/ai/clova.png"
        alt="CLOVA"
        width={size}
        height={size}
        style={{ flexShrink: 0, borderRadius: Math.round(size * 0.28), display: 'block' }}
      />
    );
  }

  if (model !== 'GEMINI') {
    // 전용 로고가 없는 모델은 모델 색 바탕에 이름 첫 글자를 쓴다
    const ai = findAiProfile(models, model);
    return (
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
        background: ai.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.55), fontWeight: 800, lineHeight: 1,
      }}>
        {ai.name[0]?.toUpperCase()}
      </div>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="gemini-gradient" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1C7DFF" />
          <stop offset="0.5" stopColor="#4285F4" />
          <stop offset="1" stopColor="#A87FFE" />
        </linearGradient>
      </defs>
      <path
        d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"
        fill="url(#gemini-gradient)"
      />
    </svg>
  );
}
