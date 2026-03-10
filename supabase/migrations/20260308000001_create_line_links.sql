-- Create line_links table to support multiple LINE accounts/groups per user
CREATE TABLE public.line_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_source_id TEXT NOT NULL, -- LINE user ID, group ID, or room ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(line_source_id) -- One LINE source can only be linked to one user
);

-- Add RLS policies for line_links
ALTER TABLE public.line_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own line links"
  ON public.line_links
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own line links"
  ON public.line_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own line links"
  ON public.line_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing data from user_integrations if any exist
INSERT INTO public.line_links (user_id, line_source_id)
SELECT user_id, line_user_id 
FROM public.user_integrations 
WHERE line_user_id IS NOT NULL
ON CONFLICT (line_source_id) DO NOTHING;

-- Optionally, we could remove the line_user_id from user_integrations here,
-- but let's keep it for now as a fallback or remove it in a future migration 
-- to be safe and avoid breaking running app versions.
