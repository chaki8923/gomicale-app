-- Create gemini_usage_limits table to restrict daily Gemini API usage per user
CREATE TABLE public.gemini_usage_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, date) -- One record per user per day
);

-- Add RLS policies for gemini_usage_limits
ALTER TABLE public.gemini_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage limits"
  ON public.gemini_usage_limits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage limits"
  ON public.gemini_usage_limits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage limits"
  ON public.gemini_usage_limits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gemini_usage_limits_updated_at
  BEFORE UPDATE ON public.gemini_usage_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
