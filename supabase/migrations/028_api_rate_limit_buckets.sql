-- Per-user sliding-window counters for expensive API routes (LLM / external agent calls).
-- Used by check_and_increment_api_rate_limit via service role only.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature text NOT NULL,
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, bucket_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_bucket_start_idx
  ON public.api_rate_limit_buckets (bucket_start);

COMMENT ON TABLE public.api_rate_limit_buckets IS
  'Server-side rate limit buckets; not exposed to clients.';

REVOKE ALL ON TABLE public.api_rate_limit_buckets FROM PUBLIC;
GRANT ALL ON TABLE public.api_rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.check_and_increment_api_rate_limit(
  p_user_id uuid,
  p_feature text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz;
  v_count integer;
  v_reset timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_feature IS NULL OR length(trim(p_feature)) = 0 THEN
    RAISE EXCEPTION 'invalid parameters';
  END IF;
  IF p_limit < 1 OR p_window_seconds < 60 THEN
    RAISE EXCEPTION 'invalid parameters';
  END IF;

  v_bucket := to_timestamp(
    floor(extract(epoch FROM timezone('utc', now())) / p_window_seconds) * p_window_seconds
  ) AT TIME ZONE 'UTC';

  v_reset := v_bucket + (p_window_seconds::text || ' seconds')::interval;

  INSERT INTO public.api_rate_limit_buckets (user_id, feature, bucket_start, count)
  VALUES (p_user_id, p_feature, v_bucket, 0)
  ON CONFLICT (user_id, feature, bucket_start) DO NOTHING;

  SELECT b.count INTO v_count
  FROM public.api_rate_limit_buckets b
  WHERE b.user_id = p_user_id
    AND b.feature = p_feature
    AND b.bucket_start = v_bucket
  FOR UPDATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'count', v_count,
      'limit', p_limit,
      'reset_at', to_jsonb(v_reset)
    );
  END IF;

  UPDATE public.api_rate_limit_buckets
  SET
    count = count + 1,
    updated_at = now()
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND bucket_start = v_bucket
  RETURNING count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'count', v_count,
    'limit', p_limit,
    'reset_at', to_jsonb(v_reset)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_api_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_api_rate_limit(uuid, text, integer, integer) TO service_role;
