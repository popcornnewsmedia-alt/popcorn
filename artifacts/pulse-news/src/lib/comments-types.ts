// Database row shapes for comments + notifications tables.
// Mirrors supabase/schema.sql.

export interface DBComment {
  id: number;
  article_id: number;
  parent_id: number | null;
  author_id: string;
  author_name: string;
  author_initials: string;
  body: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export interface DBNotification {
  id: number;
  recipient_id: string;
  kind: "reply";
  article_id: number;
  parent_comment_id: number;
  reply_comment_id: number;
  actor_id: string;
  actor_name: string;
  preview: string;
  read_at: string | null;
  created_at: string;
}
