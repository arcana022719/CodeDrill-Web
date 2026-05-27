-- Add student_answer column to practice_exam_questions
-- This stores the user's raw answer so it can be displayed on the review page.
-- Stored as JSONB to handle all answer types:
--   multiple_choice  → string (choice id, e.g. "a")
--   true_false       → boolean
--   output_tracing   → string (user-typed output)
--   essay            → string (user-typed essay)
--   code_analysis    → object (blank-number → user answer, e.g. {"1":"x","2":"y"})

ALTER TABLE practice_exam_questions
  ADD COLUMN IF NOT EXISTS student_answer JSONB;

COMMENT ON COLUMN practice_exam_questions.student_answer IS
  'Raw student answer stored as JSONB (string, boolean, or object for fill-in-blanks)';
