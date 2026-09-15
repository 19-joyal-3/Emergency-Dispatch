-- ==============================================================================
-- KERALA EMERGENCY DISPATCH (VANGUARD GEO) — SCHEMA & ROW LEVEL SECURITY (RLS)
-- Target Database: Supabase PostgreSQL (Project: emergenzy)
-- ==============================================================================

-- 1. CREATE THE INCIDENTS TABLE (If not already created)
CREATE TABLE IF NOT EXISTS public.incidents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    priority TEXT DEFAULT 'high',
    status TEXT DEFAULT 'pending',
    proof_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Index for faster spatial and status lookups
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents (created_at DESC);

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Clean up any prior conflicting policies to avoid duplicate errors
DROP POLICY IF EXISTS "Public Read Incidents" ON public.incidents;
DROP POLICY IF EXISTS "Allow Incident Insertion" ON public.incidents;
DROP POLICY IF EXISTS "Allow Incident Update" ON public.incidents;
DROP POLICY IF EXISTS "Authenticated Delete Incidents" ON public.incidents;

-- ==============================================================================
-- 3. DEFINE GRANULAR ACCESS CONTROL POLICIES
-- ==============================================================================

-- POLICY A: PUBLIC READ (SELECT)
-- Civilians and responders can query active hazards without logging in
CREATE POLICY "Public Read Incidents"
ON public.incidents
FOR SELECT
TO public
USING (true);

-- POLICY B: INCIDENT SUBMISSION (INSERT)
-- Allows citizens and sensors to submit distress incidents with valid coordinates
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
-- Allows updating lifecycle statuses (open, pending, in_progress, resolved, closed)
CREATE POLICY "Allow Incident Update"
ON public.incidents
FOR UPDATE
TO public
USING (true)
WITH CHECK (
    status IN ('open', 'pending', 'investigating', 'in_progress', 'resolved', 'closed', 'escalated')
);

-- POLICY D: DELETION (DELETE)
-- STRICTLY RESTRICTED: Only authenticated dispatchers can permanently delete incidents
CREATE POLICY "Authenticated Delete Incidents"
ON public.incidents
FOR DELETE
TO authenticated
USING (true);
