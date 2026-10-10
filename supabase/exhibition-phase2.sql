-- ProductMaster — Exhibition & B2B sales, phase 2.
-- Apply once in the Supabase SQL editor. Additive and re-runnable: no existing rows are changed
-- except filling the new products.category column where it is empty.
--
-- Adds: team roles, product categories, exhibitions, buyer leads, enquiries + items,
-- product analytics events, public rate limiting, and the public RPCs used by QR pages.

-- ── shared helpers ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ── team & roles ──────────────────────────────────────────────────────────────
-- Business data stays owned by the account that owns the products (owner_id).
-- team_members links each login to that owner with a role.

CREATE TABLE IF NOT EXISTS public.team_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
  display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_members_owner_idx ON public.team_members(owner_id);

-- Every account that owns products becomes the admin of its own workspace.
INSERT INTO public.team_members (user_id, owner_id, role)
SELECT DISTINCT p.user_id, p.user_id, 'admin' FROM public.products p
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_staff_of(p_owner UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members t WHERE t.user_id = auth.uid() AND t.owner_id = p_owner);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(p_owner UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members t
    WHERE t.user_id = auth.uid() AND t.owner_id = p_owner AND t.role = 'admin'
  );
$$;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read their team" ON public.team_members;
CREATE POLICY "Staff read their team" ON public.team_members
  FOR SELECT TO authenticated USING (public.is_staff_of(owner_id));
DROP POLICY IF EXISTS "Admins manage their team" ON public.team_members;
CREATE POLICY "Admins manage their team" ON public.team_members
  FOR ALL TO authenticated USING (public.is_admin_of(owner_id)) WITH CHECK (public.is_admin_of(owner_id));

-- ── product categories ────────────────────────────────────────────────────────

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(user_id, category);

-- Keep in sync with categorizeProduct() in src/lib/productCategories.ts.
UPDATE public.products SET category = CASE
  WHEN upper(description) ~ '(HANGING|PENDANT|CHANDELIER|CEILING)' THEN 'Hanging Lamp'
  WHEN upper(description) ~ 'FLOOR' THEN 'Floor Lamp'
  WHEN upper(description) ~ 'WALL' THEN 'Wall Lamp'
  WHEN upper(description) ~ '(TABLE LAMP|DESK LAMP|BEDSIDE)' THEN 'Table Lamp'
  WHEN upper(description) ~ '(LAMP|LIGHT|LANTERN|SCONCE)' THEN 'Other Lighting'
  WHEN upper(description) ~ '(CHAIR|STOOL|BENCH|TABLE|SHELF|CABINET|CONSOLE|SOFA|DESK|RACK|TROLLEY|SIDEBOARD)' THEN 'Furniture'
  ELSE 'Décor'
END
WHERE category IS NULL;

-- ── exhibitions ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 160),
  venue TEXT CHECK (venue IS NULL OR char_length(venue) <= 200),
  city TEXT CHECK (city IS NULL OR char_length(city) <= 120),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  tracking_code TEXT NOT NULL UNIQUE CHECK (tracking_code ~ '^[a-z0-9-]{3,40}$'),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'live', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS exhibitions_owner_dates_idx ON public.exhibitions(owner_id, start_date DESC);

CREATE TABLE IF NOT EXISTS public.exhibition_members (
  exhibition_id UUID NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (exhibition_id, user_id)
);

DROP TRIGGER IF EXISTS exhibitions_updated_at ON public.exhibitions;
CREATE TRIGGER exhibitions_updated_at BEFORE UPDATE ON public.exhibitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── enquiry pipeline ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.enquiry_statuses (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_won BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO public.enquiry_statuses (key, label, sort_order, is_closed, is_won) VALUES
  ('new', 'New', 10, false, false),
  ('contacted', 'Contacted', 20, false, false),
  ('qualified', 'Qualified', 30, false, false),
  ('quotation_requested', 'Quotation Requested', 40, false, false),
  ('quotation_sent', 'Quotation Sent', 50, false, false),
  ('negotiation', 'Negotiation', 60, false, false),
  ('won', 'Won', 70, true, true),
  ('lost', 'Lost', 80, true, false)
ON CONFLICT (key) DO NOTHING;

-- ── buyer leads ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 2 AND 120),
  company_name TEXT CHECK (company_name IS NULL OR char_length(company_name) <= 160),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 254),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 32),
  whatsapp TEXT CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 32),
  buyer_type TEXT CHECK (buyer_type IN (
    'retailer', 'wholesaler', 'distributor', 'interior_designer', 'architect',
    'hospitality', 'importer', 'project_buyer', 'other'
  )),
  city TEXT CHECK (city IS NULL OR char_length(city) <= 120),
  country TEXT CHECK (country IS NULL OR char_length(country) <= 120),
  interested_categories TEXT[] NOT NULL DEFAULT '{}',
  order_scale TEXT CHECK (order_scale IS NULL OR char_length(order_scale) <= 300),
  requirements TEXT CHECK (requirements IS NULL OR char_length(requirements) <= 2000),
  consent_to_contact BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  source TEXT NOT NULL CHECK (source IN ('shortlist', 'manual', 'exhibition_qr')),
  exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_normalized TEXT,
  email_normalized TEXT,
  merged_into UUID REFERENCES public.buyer_leads(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A lead needs a name or a company, and a phone/WhatsApp number or an email.
-- (ALTERs keep re-runs of this script in step with the definition above.)
ALTER TABLE public.buyer_leads ALTER COLUMN buyer_type DROP NOT NULL;
ALTER TABLE public.buyer_leads ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.buyer_leads ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.buyer_leads ALTER COLUMN phone_normalized DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_leads_identity_chk') THEN
    ALTER TABLE public.buyer_leads ADD CONSTRAINT buyer_leads_identity_chk
      CHECK (full_name IS NOT NULL OR company_name IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_leads_contact_chk') THEN
    ALTER TABLE public.buyer_leads ADD CONSTRAINT buyer_leads_contact_chk
      CHECK (phone_normalized IS NOT NULL OR email_normalized IS NOT NULL);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS buyer_leads_owner_created_idx ON public.buyer_leads(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buyer_leads_phone_idx ON public.buyer_leads(owner_id, phone_normalized);
CREATE INDEX IF NOT EXISTS buyer_leads_email_idx ON public.buyer_leads(owner_id, email_normalized);
CREATE INDEX IF NOT EXISTS buyer_leads_exhibition_idx ON public.buyer_leads(exhibition_id);

DROP TRIGGER IF EXISTS buyer_leads_updated_at ON public.buyer_leads;
CREATE TRIGGER buyer_leads_updated_at BEFORE UPDATE ON public.buyer_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── enquiries ─────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.enquiry_reference_seq;

CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  lead_id UUID NOT NULL REFERENCES public.buyer_leads(id) ON DELETE RESTRICT,
  exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' REFERENCES public.enquiry_statuses(key),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_follow_up_at TIMESTAMPTZ,
  buyer_notes TEXT CHECK (buyer_notes IS NULL OR char_length(buyer_notes) <= 2000),
  internal_notes TEXT,
  lost_reason TEXT,
  source TEXT NOT NULL CHECK (source IN ('shortlist', 'manual', 'exhibition_qr')),
  client_submission_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_owner_created_idx ON public.enquiries(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_owner_status_idx ON public.enquiries(owner_id, status);
CREATE INDEX IF NOT EXISTS enquiries_lead_idx ON public.enquiries(lead_id);
CREATE INDEX IF NOT EXISTS enquiries_exhibition_idx ON public.enquiries(exhibition_id);
CREATE INDEX IF NOT EXISTS enquiries_follow_up_idx ON public.enquiries(owner_id, next_follow_up_at);

DROP TRIGGER IF EXISTS enquiries_updated_at ON public.enquiries;
CREATE TRIGGER enquiries_updated_at BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.enquiry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL,
  product_description TEXT,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  requested_finish TEXT CHECK (requested_finish IS NULL OR char_length(requested_finish) <= 300),
  customization TEXT CHECK (customization IS NULL OR char_length(customization) <= 1000),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiry_items_enquiry_idx ON public.enquiry_items(enquiry_id, sort_order);
CREATE INDEX IF NOT EXISTS enquiry_items_product_idx ON public.enquiry_items(product_id);

-- ── saved buyer shortlists ────────────────────────────────────────────────────
-- Created when a buyer leaves their name + phone before sending a quotation request.
-- The buyer holds a random token (only its hash is stored) to sync and reopen the list.

CREATE TABLE IF NOT EXISTS public.buyer_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.buyer_leads(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_count INTEGER NOT NULL DEFAULT 0,
  submitted_enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS buyer_shortlists_owner_updated_idx ON public.buyer_shortlists(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS buyer_shortlists_lead_idx ON public.buyer_shortlists(lead_id);

DROP TRIGGER IF EXISTS buyer_shortlists_updated_at ON public.buyer_shortlists;
CREATE TRIGGER buyer_shortlists_updated_at BEFORE UPDATE ON public.buyer_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── product analytics ─────────────────────────────────────────────────────────
-- No personal data: session_id is a random ID generated in the visitor's browser.

CREATE TABLE IF NOT EXISTS public.product_events (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'shortlist_add')),
  source TEXT NOT NULL DEFAULT 'product_qr',
  referrer_host TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_events_owner_created_idx ON public.product_events(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_product_idx ON public.product_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_exhibition_idx ON public.product_events(exhibition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_session_idx ON public.product_events(session_id, product_id, created_at DESC);

-- ── public rate limiting ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- Hashed client address, so raw IPs are never stored.
CREATE OR REPLACE FUNCTION public._request_ip_hash() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT md5(coalesce(split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1
  ), '') || ':productmaster');
$$;

-- Counts a hit and returns true when the limit for the current window is exceeded.
CREATE OR REPLACE FUNCTION public._hit_rate_limit(p_key TEXT, p_limit INTEGER, p_window INTERVAL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seconds DOUBLE PRECISION := extract(epoch FROM p_window);
  v_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / v_seconds) * v_seconds);
  v_hits INTEGER;
BEGIN
  INSERT INTO public.public_rate_limits AS r (key, window_start, hits) VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO v_hits;

  IF random() < 0.01 THEN
    DELETE FROM public.public_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;
  RETURN v_hits > p_limit;
END $$;

-- Returns the first invalid contact field, or NULL. A buyer must give a name or a company,
-- and a phone/WhatsApp number or an email. Mirrors contactErrors() in src/lib/enquiryValidation.ts.
CREATE OR REPLACE FUNCTION public._contact_error(p_name TEXT, p_company TEXT, p_phone TEXT, p_email TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_name IS NOT NULL AND char_length(p_name) NOT BETWEEN 2 AND 120 THEN 'full_name'
    WHEN p_company IS NOT NULL AND char_length(p_company) > 160 THEN 'company_name'
    WHEN p_name IS NULL AND p_company IS NULL THEN 'full_name'
    WHEN p_phone IS NOT NULL AND (char_length(p_phone) > 32
      OR char_length(regexp_replace(p_phone, '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 15) THEN 'phone'
    WHEN p_email IS NOT NULL AND (char_length(p_email) > 254 OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN 'email'
    WHEN p_phone IS NULL AND p_email IS NULL THEN 'phone'
  END;
$$;

-- An explicit tracking code wins; otherwise the exhibition that is live today (India time).
CREATE OR REPLACE FUNCTION public._resolve_exhibition(p_owner UUID, p_tracking_code TEXT) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM (
    SELECT e.id, 0 AS priority, e.start_date FROM public.exhibitions e
    WHERE e.owner_id = p_owner AND p_tracking_code IS NOT NULL
      AND e.tracking_code = lower(p_tracking_code) AND e.status <> 'cancelled'
    UNION ALL
    SELECT e.id, 1, e.start_date FROM public.exhibitions e
    WHERE e.owner_id = p_owner AND e.status = 'live'
      AND (now() AT TIME ZONE 'Asia/Kolkata')::date BETWEEN e.start_date AND e.end_date
  ) candidates
  ORDER BY priority, start_date DESC
  LIMIT 1;
$$;

-- ── row level security for new tables ─────────────────────────────────────────

ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibition_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_shortlists ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_members, public.exhibitions, public.exhibition_members, public.enquiry_statuses,
  public.buyer_leads, public.enquiries, public.enquiry_items, public.product_events, public.public_rate_limits,
  public.buyer_shortlists
  FROM anon;

DROP POLICY IF EXISTS "Staff manage buyer shortlists" ON public.buyer_shortlists;
CREATE POLICY "Staff manage buyer shortlists" ON public.buyer_shortlists
  FOR ALL TO authenticated USING (public.is_staff_of(owner_id)) WITH CHECK (public.is_staff_of(owner_id));

DROP POLICY IF EXISTS "Staff read exhibitions" ON public.exhibitions;
CREATE POLICY "Staff read exhibitions" ON public.exhibitions
  FOR SELECT TO authenticated USING (public.is_staff_of(owner_id));
DROP POLICY IF EXISTS "Admins manage exhibitions" ON public.exhibitions;
CREATE POLICY "Admins manage exhibitions" ON public.exhibitions
  FOR ALL TO authenticated USING (public.is_admin_of(owner_id)) WITH CHECK (public.is_admin_of(owner_id));

DROP POLICY IF EXISTS "Staff read exhibition members" ON public.exhibition_members;
CREATE POLICY "Staff read exhibition members" ON public.exhibition_members
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exhibitions e WHERE e.id = exhibition_id AND public.is_staff_of(e.owner_id)));
DROP POLICY IF EXISTS "Admins manage exhibition members" ON public.exhibition_members;
CREATE POLICY "Admins manage exhibition members" ON public.exhibition_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exhibitions e WHERE e.id = exhibition_id AND public.is_admin_of(e.owner_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exhibitions e WHERE e.id = exhibition_id AND public.is_admin_of(e.owner_id)));

DROP POLICY IF EXISTS "Staff read enquiry statuses" ON public.enquiry_statuses;
CREATE POLICY "Staff read enquiry statuses" ON public.enquiry_statuses
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage enquiry statuses" ON public.enquiry_statuses;
CREATE POLICY "Admins manage enquiry statuses" ON public.enquiry_statuses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members t WHERE t.user_id = auth.uid() AND t.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_members t WHERE t.user_id = auth.uid() AND t.role = 'admin'));

DROP POLICY IF EXISTS "Staff manage buyer leads" ON public.buyer_leads;
CREATE POLICY "Staff manage buyer leads" ON public.buyer_leads
  FOR ALL TO authenticated USING (public.is_staff_of(owner_id)) WITH CHECK (public.is_staff_of(owner_id));

DROP POLICY IF EXISTS "Staff manage enquiries" ON public.enquiries;
CREATE POLICY "Staff manage enquiries" ON public.enquiries
  FOR ALL TO authenticated USING (public.is_staff_of(owner_id)) WITH CHECK (public.is_staff_of(owner_id));

DROP POLICY IF EXISTS "Staff manage enquiry items" ON public.enquiry_items;
CREATE POLICY "Staff manage enquiry items" ON public.enquiry_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enquiries e WHERE e.id = enquiry_id AND public.is_staff_of(e.owner_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.enquiries e WHERE e.id = enquiry_id AND public.is_staff_of(e.owner_id)));

DROP POLICY IF EXISTS "Staff read product events" ON public.product_events;
CREATE POLICY "Staff read product events" ON public.product_events
  FOR SELECT TO authenticated USING (public.is_staff_of(owner_id));
-- product_events and public_rate_limits are written only through the functions below.

-- ── public product lookups (no price, no internal fields) ─────────────────────

DROP FUNCTION IF EXISTS public.get_public_product(UUID);
DROP FUNCTION IF EXISTS public.get_public_products(UUID[]);
DROP FUNCTION IF EXISTS public.get_public_product_by_code(TEXT);

CREATE FUNCTION public.get_public_products(product_uuids UUID[])
RETURNS TABLE (
  id UUID, product_code TEXT, description TEXT, category TEXT, dimensions TEXT,
  length TEXT, width TEXT, height TEXT, cbm TEXT, finish TEXT,
  packing_length TEXT, packing_width TEXT, packing_height TEXT, net_weight TEXT, image_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.product_code, p.description, p.category, p.dimensions,
         p.length, p.width, p.height, p.cbm, p.finish,
         p.packing_length, p.packing_width, p.packing_height, p.net_weight,
         (SELECT pi.image_url FROM public.product_images pi
          WHERE pi.product_code = p.product_code AND pi.user_id = p.user_id
          ORDER BY pi.created_at DESC LIMIT 1)
  FROM public.products p
  WHERE p.id = ANY (product_uuids[1:100]);
$$;

CREATE FUNCTION public.get_public_product(product_uuid UUID)
RETURNS TABLE (
  id UUID, product_code TEXT, description TEXT, category TEXT, dimensions TEXT,
  length TEXT, width TEXT, height TEXT, cbm TEXT, finish TEXT,
  packing_length TEXT, packing_width TEXT, packing_height TEXT, net_weight TEXT, image_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.get_public_products(ARRAY[product_uuid]);
$$;

-- Older printed QR codes link to /public/product?code=<product code>.
CREATE FUNCTION public.get_public_product_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID, product_code TEXT, description TEXT, category TEXT, dimensions TEXT,
  length TEXT, width TEXT, height TEXT, cbm TEXT, finish TEXT,
  packing_length TEXT, packing_width TEXT, packing_height TEXT, net_weight TEXT, image_url TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.get_public_products(ARRAY(
    SELECT p.id FROM public.products p
    WHERE p.product_code = btrim(p_code)
    ORDER BY p.created_at DESC LIMIT 1
  ));
$$;

-- ── public analytics ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.track_product_event(
  p_product_id UUID,
  p_session_id TEXT,
  p_event_type TEXT DEFAULT 'view',
  p_tracking_code TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_referrer_host TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner UUID;
  v_source TEXT := CASE WHEN p_source IN ('product_qr', 'exhibition_qr', 'catalog', 'shortlist', 'direct')
                        THEN p_source ELSE 'product_qr' END;
BEGIN
  IF p_session_id IS NULL OR p_session_id !~ '^[0-9a-f-]{36}$' OR p_event_type NOT IN ('view', 'shortlist_add') THEN
    RETURN;
  END IF;

  SELECT p.user_id INTO v_owner FROM public.products p WHERE p.id = p_product_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  IF public._hit_rate_limit('event:s:' || p_session_id, 300, interval '1 hour')
     OR public._hit_rate_limit('event:ip:' || public._request_ip_hash(), 3000, interval '1 hour') THEN
    RETURN;
  END IF;

  -- Ignore immediate repeats (page reloads, double renders).
  IF EXISTS (
    SELECT 1 FROM public.product_events e
    WHERE e.session_id = p_session_id AND e.product_id = p_product_id AND e.event_type = p_event_type
      AND e.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.product_events (owner_id, product_id, exhibition_id, session_id, event_type, source, referrer_host)
  VALUES (
    v_owner, p_product_id, public._resolve_exhibition(v_owner, p_tracking_code), p_session_id, p_event_type,
    v_source, left(nullif(btrim(p_referrer_host), ''), 120)
  );
END $$;

-- ── public shortlist enquiry submission ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_shortlist_enquiry(p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead JSONB := coalesce(p_payload -> 'lead', '{}'::jsonb);
  v_items JSONB := p_payload -> 'items';
  v_item JSONB;
  v_submission UUID;
  v_session TEXT := p_payload ->> 'session_id';
  v_reference TEXT;
  v_name TEXT := nullif(btrim(v_lead ->> 'full_name'), '');
  v_company TEXT := nullif(btrim(v_lead ->> 'company_name'), '');
  v_email TEXT := nullif(lower(btrim(v_lead ->> 'email')), '');
  v_phone TEXT := nullif(btrim(v_lead ->> 'phone'), '');
  v_whatsapp TEXT := nullif(btrim(v_lead ->> 'whatsapp'), '');
  v_buyer_type TEXT := v_lead ->> 'buyer_type';
  v_city TEXT := nullif(btrim(v_lead ->> 'city'), '');
  v_country TEXT := nullif(btrim(v_lead ->> 'country'), '');
  v_scale TEXT := nullif(btrim(v_lead ->> 'order_scale'), '');
  v_requirements TEXT := nullif(btrim(v_lead ->> 'requirements'), '');
  v_consent BOOLEAN := coalesce(v_lead ->> 'consent_to_contact', '') = 'true';
  v_notes TEXT := nullif(btrim(p_payload ->> 'notes'), '');
  v_categories TEXT[];
  v_phone_norm TEXT;
  v_field TEXT;
  v_product_ids UUID[];
  v_missing UUID[];
  v_owner UUID;
  v_owner_count INTEGER;
  v_exhibition UUID;
  v_lead_id UUID;
  v_enquiry_id UUID;
BEGIN
  BEGIN
    v_submission := (p_payload ->> 'submission_id')::uuid;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END;
  IF v_submission IS NULL OR v_session IS NULL OR v_session !~ '^[0-9a-f-]{36}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  -- Retried submission: return the enquiry that was already created.
  SELECT reference INTO v_reference FROM public.enquiries WHERE client_submission_id = v_submission;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reference', v_reference);
  END IF;

  IF public._hit_rate_limit('enquiry:s:' || v_session, 5, interval '1 hour')
     OR public._hit_rate_limit('enquiry:ip:' || public._request_ip_hash(), 30, interval '1 hour') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  -- Lead validation (mirrors validateEnquiryForm in src/lib/enquiryValidation.ts).
  v_phone_norm := nullif(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), '');
  v_field := public._contact_error(v_name, v_company, v_phone, v_email);
  IF v_field IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', v_field);
  ELSIF v_whatsapp IS NOT NULL AND (char_length(regexp_replace(v_whatsapp, '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 15 OR char_length(v_whatsapp) > 32) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'whatsapp');
  ELSIF v_buyer_type IS NULL OR v_buyer_type NOT IN (
    'retailer', 'wholesaler', 'distributor', 'interior_designer', 'architect',
    'hospitality', 'importer', 'project_buyer', 'other'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'buyer_type');
  ELSIF v_city IS NULL OR char_length(v_city) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'city');
  ELSIF v_country IS NULL OR char_length(v_country) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'country');
  ELSIF char_length(coalesce(v_scale, '')) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'order_scale');
  ELSIF char_length(coalesce(v_requirements, '')) > 2000 OR char_length(coalesce(v_notes, '')) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'requirements');
  END IF;

  IF jsonb_typeof(v_lead -> 'interested_categories') = 'array' THEN
    SELECT coalesce(array_agg(DISTINCT left(btrim(c), 60)), '{}') INTO v_categories
    FROM (SELECT jsonb_array_elements_text(v_lead -> 'interested_categories') AS c LIMIT 20) cats
    WHERE btrim(c) <> '';
  ELSE
    v_categories := '{}';
  END IF;

  -- Items validation.
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
  END IF;
  BEGIN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
      IF (v_item ->> 'product_id')::uuid IS NULL
         OR (v_item ->> 'quantity')::integer NOT BETWEEN 1 AND 100000
         OR char_length(coalesce(v_item ->> 'finish', '')) > 300
         OR char_length(coalesce(v_item ->> 'customization', '')) > 1000
         OR char_length(coalesce(v_item ->> 'notes', '')) > 1000 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
      END IF;
    END LOOP;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
  END;

  SELECT array_agg((value ->> 'product_id')::uuid) INTO v_product_ids FROM jsonb_array_elements(v_items);
  IF (SELECT count(DISTINCT x) FROM unnest(v_product_ids) x) <> cardinality(v_product_ids) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
  END IF;

  SELECT array_agg(x) INTO v_missing
  FROM unnest(v_product_ids) x
  WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = x);
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unavailable_products', 'product_ids', to_jsonb(v_missing));
  END IF;

  SELECT count(DISTINCT p.user_id), min(p.user_id::text)::uuid INTO v_owner_count, v_owner
  FROM public.products p WHERE p.id = ANY (v_product_ids);
  IF v_owner_count <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;

  v_exhibition := public._resolve_exhibition(v_owner, p_payload ->> 'tracking_code');

  -- Reuse an existing lead with the same phone or email; fill in details it was missing.
  SELECT l.id INTO v_lead_id FROM public.buyer_leads l
  WHERE l.owner_id = v_owner AND l.merged_into IS NULL
    AND (l.phone_normalized = v_phone_norm OR (v_email IS NOT NULL AND l.email_normalized = v_email))
  ORDER BY l.created_at
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.buyer_leads (
      owner_id, full_name, company_name, email, phone, whatsapp, buyer_type, city, country,
      interested_categories, order_scale, requirements, consent_to_contact, consent_at, source,
      exhibition_id, phone_normalized, email_normalized
    ) VALUES (
      v_owner, v_name, v_company, v_email, v_phone, v_whatsapp, v_buyer_type, v_city, v_country,
      v_categories, v_scale, v_requirements, v_consent, CASE WHEN v_consent THEN now() END, 'shortlist',
      v_exhibition, v_phone_norm, v_email
    ) RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.buyer_leads l SET
      full_name = coalesce(l.full_name, v_name),
      phone = coalesce(l.phone, v_phone),
      phone_normalized = coalesce(l.phone_normalized, v_phone_norm),
      buyer_type = coalesce(l.buyer_type, v_buyer_type),
      company_name = coalesce(l.company_name, v_company),
      email = coalesce(l.email, v_email),
      email_normalized = coalesce(l.email_normalized, v_email),
      whatsapp = coalesce(l.whatsapp, v_whatsapp),
      city = coalesce(l.city, v_city),
      country = coalesce(l.country, v_country),
      order_scale = coalesce(l.order_scale, v_scale),
      requirements = coalesce(l.requirements, v_requirements),
      interested_categories = ARRAY(SELECT DISTINCT unnest(l.interested_categories || v_categories)),
      consent_to_contact = l.consent_to_contact OR v_consent,
      consent_at = CASE WHEN v_consent AND NOT l.consent_to_contact THEN now() ELSE l.consent_at END,
      exhibition_id = coalesce(l.exhibition_id, v_exhibition)
    WHERE l.id = v_lead_id;
  END IF;

  BEGIN
    INSERT INTO public.enquiries (
      owner_id, reference, lead_id, exhibition_id, status, source, buyer_notes, client_submission_id
    ) VALUES (
      v_owner,
      'ENQ-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('public.enquiry_reference_seq')::text, 5, '0'),
      v_lead_id, v_exhibition, 'quotation_requested', 'shortlist', coalesce(v_notes, v_requirements), v_submission
    ) RETURNING id, reference INTO v_enquiry_id, v_reference;
  EXCEPTION WHEN unique_violation THEN
    SELECT reference INTO v_reference FROM public.enquiries WHERE client_submission_id = v_submission;
    RETURN jsonb_build_object('ok', true, 'reference', v_reference);
  END;

  INSERT INTO public.enquiry_items (
    enquiry_id, product_id, product_code, product_description, quantity,
    requested_finish, customization, notes, sort_order
  )
  SELECT v_enquiry_id, p.id, p.product_code, p.description, (i.value ->> 'quantity')::integer,
         nullif(btrim(i.value ->> 'finish'), ''), nullif(btrim(i.value ->> 'customization'), ''),
         nullif(btrim(i.value ->> 'notes'), ''), i.ordinality
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS i(value, ordinality)
  JOIN public.products p ON p.id = (i.value ->> 'product_id')::uuid
  ORDER BY i.ordinality;

  IF coalesce(p_payload ->> 'shortlist_token', '') ~ '^[0-9a-f]{64}$' THEN
    UPDATE public.buyer_shortlists s
    SET submitted_enquiry_id = v_enquiry_id
    WHERE s.token_hash = md5(p_payload ->> 'shortlist_token') AND s.owner_id = v_owner;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reference', v_reference);
END $$;

-- ── saved shortlists (public, token based) ────────────────────────────────────

-- Keeps only well-formed items for existing products of the given owner, in the buyer's order.
CREATE OR REPLACE FUNCTION public._clean_shortlist_items(p_items JSONB, p_owner UUID) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id,
    'quantity', CASE WHEN i.value ->> 'quantity' ~ '^[0-9]{1,6}$'
                     THEN least(greatest((i.value ->> 'quantity')::integer, 1), 100000) ELSE 1 END,
    'finish', left(coalesce(i.value ->> 'finish', ''), 300),
    'customization', left(coalesce(i.value ->> 'customization', ''), 1000),
    'notes', left(coalesce(i.value ->> 'notes', ''), 1000)
  ) ORDER BY i.ordinality), '[]'::jsonb)
  FROM (
    SELECT value, ordinality FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
    ) WITH ORDINALITY
    LIMIT 100
  ) i
  JOIN public.products p
    ON p.id = CASE WHEN i.value ->> 'product_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   THEN (i.value ->> 'product_id')::uuid END
   AND p.user_id = p_owner;
$$;

-- Quick "save my shortlist": name or company + phone or email. Creates (or reuses) the lead
-- and returns a private token.
CREATE OR REPLACE FUNCTION public.save_buyer_shortlist(p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session TEXT := p_payload ->> 'session_id';
  v_name TEXT := nullif(btrim(p_payload ->> 'full_name'), '');
  v_company TEXT := nullif(btrim(p_payload ->> 'company_name'), '');
  v_phone TEXT := nullif(btrim(p_payload ->> 'phone'), '');
  v_email TEXT := nullif(lower(btrim(p_payload ->> 'email')), '');
  v_phone_norm TEXT := nullif(regexp_replace(coalesce(p_payload ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  v_field TEXT;
  v_consent BOOLEAN := coalesce(p_payload ->> 'consent_to_contact', '') = 'true';
  v_first_id TEXT := p_payload -> 'items' -> 0 ->> 'product_id';
  v_owner UUID;
  v_items JSONB;
  v_exhibition UUID;
  v_lead_id UUID;
  v_token TEXT := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF v_session IS NULL OR v_session !~ '^[0-9a-f-]{36}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_request');
  END IF;
  IF public._hit_rate_limit('save:s:' || v_session, 5, interval '1 hour')
     OR public._hit_rate_limit('save:ip:' || public._request_ip_hash(), 30, interval '1 hour') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  v_field := public._contact_error(v_name, v_company, v_phone, v_email);
  IF v_field IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', v_field);
  END IF;

  IF v_first_id IS NULL OR v_first_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
  END IF;
  SELECT p.user_id INTO v_owner FROM public.products p WHERE p.id = v_first_id::uuid;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'validation', 'field', 'items');
  END IF;

  v_items := public._clean_shortlist_items(p_payload -> 'items', v_owner);
  v_exhibition := public._resolve_exhibition(v_owner, p_payload ->> 'tracking_code');

  SELECT l.id INTO v_lead_id FROM public.buyer_leads l
  WHERE l.owner_id = v_owner AND l.merged_into IS NULL
    AND (l.phone_normalized = v_phone_norm OR l.email_normalized = v_email)
  ORDER BY l.created_at
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.buyer_leads (
      owner_id, full_name, company_name, phone, email, consent_to_contact, consent_at, source, exhibition_id,
      phone_normalized, email_normalized
    ) VALUES (
      v_owner, v_name, v_company, v_phone, v_email, v_consent, CASE WHEN v_consent THEN now() END, 'shortlist',
      v_exhibition, v_phone_norm, v_email
    ) RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.buyer_leads l SET
      full_name = coalesce(l.full_name, v_name),
      company_name = coalesce(l.company_name, v_company),
      phone = coalesce(l.phone, v_phone),
      phone_normalized = coalesce(l.phone_normalized, v_phone_norm),
      email = coalesce(l.email, v_email),
      email_normalized = coalesce(l.email_normalized, v_email),
      consent_to_contact = l.consent_to_contact OR v_consent,
      consent_at = CASE WHEN v_consent AND NOT l.consent_to_contact THEN now() ELSE l.consent_at END
    WHERE l.id = v_lead_id;
  END IF;

  INSERT INTO public.buyer_shortlists (owner_id, lead_id, token_hash, exhibition_id, items, item_count)
  VALUES (v_owner, v_lead_id, md5(v_token), v_exhibition, v_items, jsonb_array_length(v_items));

  RETURN jsonb_build_object('ok', true, 'token', v_token);
END $$;

-- Replaces the saved items of a shortlist (called whenever the buyer changes it).
CREATE OR REPLACE FUNCTION public.sync_buyer_shortlist(p_token TEXT, p_items JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_owner UUID;
  v_items JSONB;
BEGIN
  IF coalesce(p_token, '') !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT s.id, s.owner_id INTO v_id, v_owner FROM public.buyer_shortlists s WHERE s.token_hash = md5(p_token);
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF public._hit_rate_limit('sync:' || v_id::text, 600, interval '1 hour') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  v_items := public._clean_shortlist_items(p_items, v_owner);
  UPDATE public.buyer_shortlists SET items = v_items, item_count = jsonb_array_length(v_items) WHERE id = v_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Lets the buyer reopen their list on another browser. Returns only their items and first name.
CREATE OR REPLACE FUNCTION public.get_buyer_shortlist(p_token TEXT) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF coalesce(p_token, '') !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT jsonb_build_object(
    'ok', true,
    'first_name', coalesce(split_part(l.full_name, ' ', 1), l.company_name),
    'items', s.items,
    'submitted', s.submitted_enquiry_id IS NOT NULL
  ) INTO v_result
  FROM public.buyer_shortlists s
  JOIN public.buyer_leads l ON l.id = s.lead_id
  WHERE s.token_hash = md5(p_token);
  RETURN coalesce(v_result, jsonb_build_object('ok', false, 'error', 'not_found'));
END $$;

-- ── function permissions ──────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public._request_ip_hash() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._hit_rate_limit(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._resolve_exhibition(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._clean_shortlist_items(JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._contact_error(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_staff_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_products(UUID[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_product(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_product_by_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_product_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shortlist_enquiry(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_buyer_shortlist(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_buyer_shortlist(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_buyer_shortlist(TEXT) TO anon, authenticated;
