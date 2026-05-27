-- Fix essay submission failures for standalone practice mode
-- Ensures user_exam_progress and user_exam_answers are compatible with the
-- new submit_essay_answer function regardless of which prior migrations ran.

-- ============================================================================
-- 1. Fix user_exam_progress
-- ============================================================================

-- Make template_id nullable (safe if already dropped by remove_exam_templates migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_exam_progress' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE user_exam_progress ALTER COLUMN template_id DROP NOT NULL;
  END IF;
END $$;

-- Add course_id if not already present
ALTER TABLE user_exam_progress
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES professor_courses(id) ON DELETE CASCADE;

-- Add question_type_category if not already present (check ENUM vs TEXT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_exam_progress' AND column_name = 'question_type_category'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type_category') THEN
      EXECUTE 'ALTER TABLE user_exam_progress ADD COLUMN question_type_category question_type_category';
    ELSE
      ALTER TABLE user_exam_progress
        ADD COLUMN question_type_category TEXT
        CHECK (question_type_category IN (
          'code_analysis','output_tracing','essay','multiple_choice','true_false'
        ));
    END IF;
  END IF;
END $$;

-- Give total_questions a safe default so INSERT doesn't need to supply it
ALTER TABLE user_exam_progress
  ALTER COLUMN total_questions SET DEFAULT 0;

-- Give max_points a safe default so INSERT doesn't need to supply it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_exam_progress' AND column_name = 'max_points'
  ) THEN
    ALTER TABLE user_exam_progress ALTER COLUMN max_points SET DEFAULT 0;
  END IF;
END $$;

-- Partial unique index for standalone practice rows (no template)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_exam_progress_standalone
  ON user_exam_progress(user_id, course_id, question_type_category)
  WHERE course_id IS NOT NULL AND question_type_category IS NOT NULL;

-- ============================================================================
-- 2. Fix user_exam_answers
-- ============================================================================

-- Make progress_id nullable so we can save answers even without a full progress record
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_exam_answers' AND column_name = 'progress_id'
  ) THEN
    ALTER TABLE user_exam_answers ALTER COLUMN progress_id DROP NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. Recreate submit_essay_answer with correct, safe logic
-- ============================================================================

-- Drop both known signatures so we start clean
DROP FUNCTION IF EXISTS submit_essay_answer(uuid, uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS submit_essay_answer(uuid, uuid, uuid, question_type_category, text, integer, integer, integer);
DROP FUNCTION IF EXISTS submit_essay_answer(uuid, uuid, uuid, text, text, integer, integer, integer);

CREATE OR REPLACE FUNCTION submit_essay_answer(
  p_user_id              UUID,
  p_question_id          UUID,
  p_course_id            UUID,
  p_question_type_category TEXT,   -- TEXT so it works with both ENUM and TEXT columns
  p_essay_answer         TEXT,
  p_word_count           INTEGER,
  p_time_spent           INTEGER DEFAULT 0,
  p_hints_used           INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_progress_id UUID;
  v_answer_id   UUID;
BEGIN
  -- Find existing progress record for this user / course / category
  SELECT id INTO v_progress_id
  FROM user_exam_progress
  WHERE user_id                = p_user_id
    AND course_id              = p_course_id
    AND question_type_category::TEXT = p_question_type_category;

  -- Create one if it doesn't exist yet
  IF v_progress_id IS NULL THEN
    INSERT INTO user_exam_progress (
      user_id,
      course_id,
      question_type_category,
      status,
      started_at
    )
    VALUES (
      p_user_id,
      p_course_id,
      p_question_type_category,
      'in_progress',
      NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_progress_id;

    -- ON CONFLICT DO NOTHING means another session beat us; fetch the existing row
    IF v_progress_id IS NULL THEN
      SELECT id INTO v_progress_id
      FROM user_exam_progress
      WHERE user_id                = p_user_id
        AND course_id              = p_course_id
        AND question_type_category::TEXT = p_question_type_category;
    END IF;
  END IF;

  -- Save (or update) the essay answer
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
  ) VALUES (
    p_user_id,
    p_question_id,
    v_progress_id,
    p_essay_answer,
    p_word_count,
    p_time_spent,
    p_hints_used,
    NULL,   -- cannot auto-grade essays
    0,      -- points awarded after manual grading
    false,
    false,
    true,   -- needs manual grading
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, question_id) DO UPDATE
    SET essay_answer        = EXCLUDED.essay_answer,
        word_count          = EXCLUDED.word_count,
        time_spent_seconds  = user_exam_answers.time_spent_seconds + EXCLUDED.time_spent_seconds,
        hints_used          = GREATEST(user_exam_answers.hints_used, EXCLUDED.hints_used),
        attempt_count       = user_exam_answers.attempt_count + 1,
        last_attempted_at   = NOW(),
        submitted_at        = NOW(),
        requires_grading    = true,
        updated_at          = NOW()
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
  'Saves a student essay answer for manual grading. Works with both template-based and standalone practice modes.';
