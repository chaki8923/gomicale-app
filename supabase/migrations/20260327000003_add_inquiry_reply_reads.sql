CREATE TABLE inquiry_reply_reads (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz DEFAULT '1970-01-01' NOT NULL
);

ALTER TABLE inquiry_reply_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiry_reply_reads_select"
  ON inquiry_reply_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "inquiry_reply_reads_insert"
  ON inquiry_reply_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inquiry_reply_reads_update"
  ON inquiry_reply_reads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
