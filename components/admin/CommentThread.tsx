import { useEffect, useState } from 'react';
import { Input } from '@/components/admin/ui/input';
import { Button } from '@/components/admin/ui/button';
import { Textarea } from '@/components/admin/ui/textarea';

type Comment = {
  id: string;
  message: string;
  author_email: string;
  created_at: string;
};

export default function CommentThread({ snapshotId }: { snapshotId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [author, setAuthor] = useState('');

  const loadComments = async () => {
    const res = await fetch(`/api/comments?snapshot_id=${snapshotId}`);
    const data = await res.json();
    setComments(data);
  };

  useEffect(() => {
    if (snapshotId) loadComments();
  }, [snapshotId]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshot_id: snapshotId,
        author_email: author || 'anonymous',
        message: newComment,
      }),
    });
    if (res.ok) {
      setNewComment('');
      loadComments();
    }
  };

  return (
    <div className="p-4 border-t mt-4 bg-muted/20 rounded">
      <h3 className="text-lg font-semibold mb-2">Comments</h3>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground mb-4">No comments yet.</p>
      )}

      <ul className="space-y-3 mb-4">
        {comments.map((c) => (
          <li key={c.id} className="bg-white p-3 rounded shadow-sm">
            <p className="text-sm">{c.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {c.author_email} – {new Date(c.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <Input
          placeholder="Your email (optional)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        />
        <Textarea
          placeholder="Leave a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <Button onClick={submitComment} size="sm">
          Post Comment
        </Button>
      </div>
    </div>
  );
}
