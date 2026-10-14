-- ==============================================================================
-- MIGRATION: CADET ROTC SUBJECT & ACADEMIC TERM AUTO-LINKING
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Table:    public.cadets
-- Target Trigger:  trg_sync_academic_term_cadet_count
--
-- Description:
--   1. Adds rotc_subject (MS1 vs MS2) to the cadets table.
--   2. Links each cadet to the active academic_term (academic_term_id).
--   3. Automatically updates academic_terms.enrolled_cadets count via trigger.
-- ==============================================================================

-- 1. Add rotc_subject (MS1 or MS2)
ALTER TABLE public.cadets
    ADD COLUMN IF NOT EXISTS rotc_subject VARCHAR(20) DEFAULT 'MS1'
    CHECK (rotc_subject IN ('MS1', 'MS2', 'MS 1', 'MS 2'));

-- 2. Link cadets to academic_terms table
ALTER TABLE public.cadets
    ADD COLUMN IF NOT EXISTS academic_term_id UUID
    REFERENCES public.academic_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cadets_academic_term_id ON public.cadets(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_cadets_rotc_subject ON public.cadets(rotc_subject);

-- 3. Backfill existing cadets to the CURRENT active academic term if one exists
DO $$
DECLARE
    v_active_term_id UUID;
BEGIN
    SELECT id INTO v_active_term_id
    FROM public.academic_terms
    WHERE status = 'current'
    LIMIT 1;

    IF v_active_term_id IS NOT NULL THEN
        UPDATE public.cadets
        SET academic_term_id = v_active_term_id
        WHERE academic_term_id IS NULL;

        -- Update enrolled cadet count on the active term
        UPDATE public.academic_terms
        SET enrolled_cadets = (
            SELECT COUNT(*) FROM public.cadets WHERE academic_term_id = v_active_term_id
        )
        WHERE id = v_active_term_id;
    END IF;
END;
$$;

-- 4. Auto-synchronize academic_terms.enrolled_cadets count upon cadet registration/updates
CREATE OR REPLACE FUNCTION public.sync_academic_term_cadet_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.academic_term_id IS NOT NULL THEN
            UPDATE public.academic_terms
            SET enrolled_cadets = (
                SELECT COUNT(*) FROM public.cadets WHERE academic_term_id = NEW.academic_term_id
            )
            WHERE id = NEW.academic_term_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.academic_term_id IS DISTINCT FROM NEW.academic_term_id) THEN
        IF OLD.academic_term_id IS NOT NULL THEN
            UPDATE public.academic_terms
            SET enrolled_cadets = (
                SELECT COUNT(*) FROM public.cadets WHERE academic_term_id = OLD.academic_term_id
            )
            WHERE id = OLD.academic_term_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_academic_term_cadet_count ON public.cadets;
CREATE TRIGGER trg_sync_academic_term_cadet_count
AFTER INSERT OR UPDATE OF academic_term_id OR DELETE ON public.cadets
FOR EACH ROW EXECUTE FUNCTION public.sync_academic_term_cadet_count();

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
