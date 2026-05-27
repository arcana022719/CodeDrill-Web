-- Patch v2: explicitly supply every NOT-NULL column in submit_essay_answer
-- Fixes: "null value in column total_questions violates not-null constraint"
-- Safe to re-run after v1.

-- ============================================================================
-- 1. Guarantee defaults on all potentially-NOT-NULL numeric columns
-- ============================================================================
DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'total_questions', 'max_points', 'correct_answers',
    'total_points', 'time_spent_seconds'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_exam_progress' AND column_name = col
    ) THEN
      EXECUTE format(
        'ALTER TABLE user_exam_progress ALTER COLUMN %I SET DEFAULT 0', col
      );
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_exam_progress' AND column_name = 'accuracy'
  ) THEN
    ALTER TABLE user_exam_progress ALTER COLUMN accuracy SET DEFAULT 0.00;
  END IF;
END $$;

-- ============================================================================
-- 2. Drop all overloads of submit_essay_answer so we can recreate cleanly
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'submit_essay_answer'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Create the definitive submit_essay_answer
--    - p_question_type_category is TEXT so it works with both ENUM and TEXT columns
--    - Every NOT-NULL column is explicitly supplied (no reliance on defaults)
--    - EXCEPTION WHEN OTHERS returns the real error for debugging
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_essay_answer(
  p_user_id                UUID,
  p_question_id            UUID,
  p_course_id              UUID,
  p_question_type_category TEXT,
  p_essay_answer           TEXT,
  p_word_count             INTEGER,
  p_time_spent             INTEGER DEFAULT 0,
  p_hints_used             INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_progress_id UUID;
  v_answer_id   UUID;
BEGIN

  -- ── 1. Look up existing progress record ────────────────────────────────────
  SELECT id INTO v_progress_id
  FROM user_exam_progress
  WHERE user_id   = p_user_id
    AND course_id = p_course_id
    AND question_type_category::TEXT = p_question_type_category;

  -- ── 2. Create it if missing ─────────────────────────────────────────────────
  IF v_progress_id IS NULL THEN
    BEGIN
      -- Full INSERT: explicitly supply 0 for every NOT-NULL numeric column
      -- so the statement never depends on column defaults being set.
      INSERT INTO user_exam_progress (
        user_id,
        course_id,
        question_type_category,
        status,
        started_at,
        total_questions,
        max_points,
        correct_answers,
        total_points,
        accuracy,
        time_spent_seconds
      )
      VALUES (
        p_user_id,
        p_course_id,
        p_question_type_category,   -- implicit TEXT → ENUM cast if column is ENUM
        'in_progress',
        NOW(),
        0, 0, 0, 0, 0.00, 0
      )
      RETURNING id INTO v_progress_id;

    EXCEPTION
      -- If some columns don't exist on this schema version, retry with minimal set
      WHEN undefined_column THEN
        BEGIN
          INSERT INTO user_exam_progress (
            user_id,
            course_id,
            question_type_category,
            status,
            started_at,
            total_questions,
            max_points
          )
          VALUES (
            p_user_id,
            p_course_id,
            p_question_type_category,
            'in_progress',
            NOW(),
            0, 0
          )
          RETURNING id INTO v_progress_id;
        EXCEPTION
          -- Another session created the row between our SELECT and INSERT
          WHEN unique_violation THEN
            SELECT id INTO v_progress_id
            FROM user_exam_progress
            WHERE user_id   = p_user_id
              AND course_id = p_course_id
              AND question_type_category::TEXT = p_question_type_category;
        END;

      -- Race condition on full INSERT
      WHEN unique_violation THEN
        SELECT id INTO v_progress_id
        FROM user_exam_progress
        WHERE user_id   = p_user_id
          AND course_id = p_course_id
          AND question_type_category::TEXT = p_question_type_category;
    END;
  END IF;

  -- ── 3. Save / upsert the essay answer ──────────────────────────────────────
  INSERT INTO user_exam_answers (
    user_id,
    question_id,
    progress_id,
    essay_answer,
    word_count,
    time_spent_seconds,
    hints_used,
    is_correct,
    points_earned,
    auto_graded,
    manually_reviewed,
    requires_grading,
    first_attempted_at,
    last_attempted_at,
    submitted_at
  )
  VALUES (
    p_user_id,
    p_question_id,
    v_progress_id,
    p_essay_answer,
    p_word_count,
    p_time_spent,
    p_hints_used,
    NULL,   -- essays cannot be auto-graded
    0,      -- points assigned after manual grading
    false,
    false,
    true,   -- flagged for manual grading
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, question_id) DO UPDATE
    SET essay_answer       = EXCLUDED.essay_answer,
        word_count         = EXCLUDED.word_count,
        time_spent_seconds = user_exam_answers.time_spent_seconds
                             + EXCLUDED.time_spent_seconds,
        hints_used         = GREATEST(user_exam_answers.hints_used,
                                      EXCLUDED.hints_used),
        attempt_count      = user_exam_answers.attempt_count + 1,
        last_attempted_at  = NOW(),
        submitted_at       = NOW(),
        requires_grading   = true,
        updated_at         = NOW()
  RETURNING id INTO v_answer_id;

  RETURN jsonb_build_object(
    'success',          true,
    'answer_id',        v_answer_id,
    'progress_id',      v_progress_id,
    'requires_grading', true,
    'message',          'Essay submitted successfully. Your professor will grade it soon.'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM
  );
END;
$$;

COMMENT ON FUNCTION submit_essay_answer IS
  'Saves a student essay answer for manual grading. '
  'Works with all schema versions (explicit 0s for NOT-NULL numerics).';
