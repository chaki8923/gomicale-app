-- ──────────────────────────────────────────────────────────
-- inquiry_posts: ユーザーの問い合わせ投稿
-- ──────────────────────────────────────────────────────────
CREATE TABLE inquiry_posts (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX inquiry_posts_user_id_idx    ON inquiry_posts(user_id);
CREATE INDEX inquiry_posts_created_at_idx ON inquiry_posts(created_at DESC);

-- ──────────────────────────────────────────────────────────
-- inquiry_replies: 管理者のみが投稿できる返信
-- ──────────────────────────────────────────────────────────
CREATE TABLE inquiry_replies (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id        uuid        NOT NULL REFERENCES inquiry_posts(id) ON DELETE CASCADE,
  admin_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at     timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX inquiry_replies_post_id_idx    ON inquiry_replies(post_id);
CREATE INDEX inquiry_replies_created_at_idx ON inquiry_replies(created_at DESC);

-- ──────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────
ALTER TABLE inquiry_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_replies  ENABLE ROW LEVEL SECURITY;

-- inquiry_posts: SELECT
CREATE POLICY "inquiry_posts_select"
  ON inquiry_posts FOR SELECT
  TO authenticated
  USING (true);

-- inquiry_posts: INSERT（自分の投稿のみ）
CREATE POLICY "inquiry_posts_insert"
  ON inquiry_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- inquiry_posts: DELETE（自分の投稿 OR 管理者）
CREATE POLICY "inquiry_posts_delete"
  ON inquiry_posts FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.email() = 'REDACTED'
  );

-- inquiry_replies: SELECT
CREATE POLICY "inquiry_replies_select"
  ON inquiry_replies FOR SELECT
  TO authenticated
  USING (true);

-- inquiry_replies: INSERT（管理者のみ）
CREATE POLICY "inquiry_replies_insert"
  ON inquiry_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.email() = 'REDACTED'
    AND auth.uid() = admin_user_id
  );

-- inquiry_replies: DELETE（管理者のみ）
CREATE POLICY "inquiry_replies_delete"
  ON inquiry_replies FOR DELETE
  TO authenticated
  USING (auth.email() = 'REDACTED');
