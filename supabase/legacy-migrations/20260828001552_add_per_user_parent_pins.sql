-- Per-user parent PIN credentials. The table is deliberately inaccessible to
-- Data API clients: only server-side service-role code may read or mutate it.
CREATE TABLE public.user_parent_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_parent_pins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_parent_pins FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_parent_pins TO service_role;

COMMENT ON TABLE public.user_parent_pins IS
  'Server-only salted hashes for per-user parent PINs. A missing row means the default PIN 666666.';
