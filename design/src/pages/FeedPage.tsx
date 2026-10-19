import PostFeed from '../components/PostFeed';
import FeedSidebar from '../components/FeedSidebar';

export default function FeedPage() {
  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'flex-start', gap: 20 }}>
      <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        <PostFeed />
      </div>
      <FeedSidebar />
    </div>
  );
}
