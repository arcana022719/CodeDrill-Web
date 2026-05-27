-- Patch v3: explicitly cast TEXT → question_type_category ENUM on INSERT
-- Fixes: "column question_type_category is of type question_type_category
--         but expression is of type text"
-- PostgreSQL never implicitly casts TEXT to a custom ENUM in INSERT/UPDATE
-- statements — an explicit ::question_type_category cast is required.

-- ============================================================================
-- 1. Drop all overloads of submit_essay_answer
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
-- 2. Recreate submit_essay_answer with explicit ENUM cast
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
        p_question_type_category::question_type_category,  -- explicit ENUM cast
        'in_progress',
        NOW(),
        0, 0, 0, 0, 0.00, 0
      )
      RETURNING id INTO v_progress_id;

    EXCEPTION
      -- Race condition: another session inserted the same row between SELECT and INSERT
      WHEN unique_violation THEN
        SELECT id INTO v_progress_id
        FROM user_exam_progress
        WHERE user_id   = p_user_id
          AND course_id = p_course_id
          AND question_type_category::TEXT = p_question_type_category;

      -- Fallback for schema variants missing some columns
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
            p_question_type_category::question_type_category,  -- explicit ENUM cast
            'in_progress',
            NOW(),
            0, 0
          )
          RETURNING id INTO v_progress_id;
        EXCEPTION
          WHEN unique_violation THEN
            SELECT id INTO v_progress_id
            FROM user_exam_progress
            WHERE user_id   = p_user_id
              AND course_id = p_course_id
              AND question_type_category::TEXT = p_question_type_category;
        END;
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
  'Uses explicit ::question_type_category cast to avoid TEXT→ENUM implicit cast failure.';
