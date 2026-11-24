import { forwardRef } from 'react';
import type { HTMLAttributes, KeyboardEvent, SyntheticEvent } from 'react';

interface PressableProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  as?: 'div' | 'span';
  onClick?: (e: SyntheticEvent<HTMLElement>) => void;
  disabled?: boolean;
}

// 버튼처럼 동작하지만 레이아웃은 div/span 그대로 두고 싶은 곳에 쓴다.
// <button>은 display:block이어도 폭이 내용에 맞춰 줄어드는 등 기존 배치가 깨지기 쉬워서,
// 카드·목록 행처럼 블록으로 늘어나야 하는 요소는 이 컴포넌트로 키보드 조작을 붙인다.
// Tab으로 포커스되고 Enter/Space로 눌리며, 스크린리더에는 버튼으로 읽힌다.
const Pressable = forwardRef<HTMLElement, PressableProps>(function Pressable(
  { as: Tag = 'div', onClick, onKeyDown, disabled, ...rest },
  ref,
) {
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;
    // 안쪽 버튼에서 올라온 키 입력으로 바깥 행까지 눌리지 않게 자기 자신일 때만 처리한다
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e);
    }
  };
  return (
    <Tag
      // div/span 모두 받을 수 있게 ref 타입을 넓혀서 넘긴다
      ref={ref as never}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
});

export default Pressable;
