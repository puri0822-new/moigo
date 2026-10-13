import { useTheme } from '../context/ThemeContext';
import PostFeed from '../components/PostFeed';

export default function FeedPage() {
  const { theme } = useTheme();

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>피드</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>다른 투자자들과 생각을 나눠보세요</div>
      </div>
      <PostFeed />
    </div>
  );
}
