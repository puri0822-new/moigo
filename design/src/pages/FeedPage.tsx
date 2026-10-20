import PostFeed from '../components/PostFeed';
import FeedSidebar from '../components/FeedSidebar';
import { useViewport } from '../lib/useViewport';

export default function FeedPage() {
  const { isMobile } = useViewport();
  // 휴대폰에서는 인기 글·종목 사이드바를 피드 아래로 내린다
  return (
    <div style={{
      padding: isMobile ? 16 : 24, display: 'flex', gap: 20,
      flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        <PostFeed />
      </div>
      <FeedSidebar fullWidth={isMobile} />
    </div>
  );
}
