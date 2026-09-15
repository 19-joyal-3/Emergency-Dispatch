-- ==============================================================================
-- KERALA EMERGENCY DISPATCH (VANGUARD GEO) — ROW LEVEL SECURITY (RLS) POLICIES
-- Target Database: Supabase PostgreSQL (Project: emergenzy)
-- ==============================================================================

-- 1. Ensure the incidents table exists with necessary columns
CREATE TABLE IF NOT EXISTS public.incidents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    priority TEXT DEFAULT 'high',
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners as well (best practice to prevent bypass)
ALTER TABLE public.incidents FORCE ROW LEVEL SECURITY;

-- Clean up any existing policies to ensure clean idempotent execution
DROP POLICY IF EXISTS "Public Read Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow Incident Insertion" ON public.incidents;
DROP POLICY IF EXISTS "Authenticated Update Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow Incident Update" ON public.incidents;
DROP POLICY IF EXISTS "Authenticated Delete Incidents" ON public.incidents;

-- ==============================================================================
-- 3. DEFINE GRANULAR ACCESS CONTROL POLICIES
-- ==============================================================================

-- POLICY A: PUBLIC READ (SELECT)
-- Allows all users (civilians, rescue squads, dispatchers) to view active incidents
-- Critical for offline navigation routing and hazard avoidance to function without login.
CREATE POLICY "Public Read Incidents"
ON public.incidents
FOR SELECT
TO public
USING (true);

-- POLICY B: INSERTION / REPORTING (INSERT)
-- Allows citizens, IoT sensors, and field responders to report new emergency incidents.
-- Enforces basic coordinate validity check (Kerala bounds: Lat 8.0-13.0, Lng 74.5-78.0 or general GPS).
CREATE POLICY "Allow Incident Insertion"
ON public.incidents
FOR INSERT
TO public
WITH CHECK (
    lat >= -90.0 AND lat <= 90.0 AND
    lng >= -180.0 AND lng <= 180.0 AND
    type IS NOT NULL AND
    length(type) > 0
);

-- POLICY C: RESOLVE & STATUS UPDATES (UPDATE)
-- Option 1 (Recommended): Authenticated administrators/dispatchers can update any incident.
-- Option 2: Public clients can update status when syncing resolved tickets.
CREATE POLICY "Allow Incident Update"
ON public.incidents
FOR UPDATE
TO public
USING (true)
WITH CHECK (
    status IN ('open', 'investigating', 'in_progress', 'resolved', 'closed', 'escalated')
);

-- POLICY D: DELETION (DELETE)
-- STRICTLY RESTRICTED: Only authenticated dispatchers/administrators can permanently delete records.
-- Unauthenticated / anonymous users cannot delete disaster records.
CREATE POLICY "Authenticated Delete Incidents"
ON public.incidents
FOR DELETE
TO authenticated
USING (true);


-- ==============================================================================
-- 4. OPTIONAL AUDIT & BLOCKAGE TABLES RLS (IF CREATED IN SUPABASE)
-- ==============================================================================

-- Blockages Table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blockages') THEN
        EXECUTE 'ALTER TABLE public.blockages ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Public Read Blockages" ON public.blockages;';
        EXECUTE 'CREATE POLICY "Public Read Blockages" ON public.blockages FOR SELECT TO public USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Authenticated Modify Blockages" ON public.blockages;';
        EXECUTE 'CREATE POLICY "Authenticated Modify Blockages" ON public.blockages FOR ALL TO authenticated USING (true);';
    END IF;
END $$;

-- Responders Table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'responders') THEN
        EXECUTE 'ALTER TABLE public.responders ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Public Read Responders" ON public.responders;';
        EXECUTE 'CREATE POLICY "Public Read Responders" ON public.responders FOR SELECT TO public USING (true);';
        EXECUTE 'DROP POLICY IF EXISTS "Authenticated Modify Responders" ON public.responders;';
        EXECUTE 'CREATE POLICY "Authenticated Modify Responders" ON public.responders FOR ALL TO authenticated USING (true);';
    END IF;
END $$;

-- ==============================================================================
-- 5. VERIFICATION QUERY
-- ==============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('incidents', 'blockages', 'responders');
