import PostFeed from '../components/PostFeed';
import FeedSidebar from '../components/FeedSidebar';

export default function FeedPage() {
  return (
    <div style={{
      padding: '24px 28px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 300px',
      gap: 24,
      alignItems: 'start',
      width: '100%',
      maxWidth: 1120,
      margin: '0 auto',
      boxSizing: 'border-box',
    }}>
      <PostFeed />
      <FeedSidebar />
    </div>
  );
}
