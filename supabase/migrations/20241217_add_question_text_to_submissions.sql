-- Add question_text to get_submissions_for_grading return type
-- so professors can see the essay prompt alongside the student's answer.

DROP FUNCTION IF EXISTS get_submissions_for_grading(uuid, question_type_category, text);

CREATE OR REPLACE FUNCTION get_submissions_for_grading(
  p_course_id UUID,
  p_question_type_category question_type_category DEFAULT NULL,
  p_graded_status TEXT DEFAULT 'ungraded' -- 'ungraded', 'graded', 'all'
)
RETURNS TABLE (
  answer_id UUID,
  question_id UUID,
  question_title VARCHAR(255),
  question_text TEXT,
  question_type VARCHAR(50),
  student_id UUID,
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  essay_answer TEXT,
  word_count INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE,
  points_earned INTEGER,
  max_points INTEGER,
  requires_grading BOOLEAN,
  manually_reviewed BOOLEAN,
  reviewer_feedback TEXT,
  graded_by UUID,
  graded_at TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  hints_used INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ua.id as answer_id,
    eq.id as question_id,
    eq.title as question_title,
    eq.question_text,
    eq.question_type::VARCHAR(50) as question_type,
    u.id as student_id,
    u.name::VARCHAR(255) as student_name,
    u.email::VARCHAR(255) as student_email,
    ua.essay_answer,
    ua.word_count,
    ua.submitted_at,
    ua.points_earned,
    eq.points as max_points,
    ua.requires_grading,
    ua.manually_reviewed,
    ua.reviewer_feedback,
    ua.graded_by,
    ua.graded_at,
    ua.time_spent_seconds,
    ua.hints_used
  FROM user_exam_answers ua
  JOIN exam_questions eq ON ua.question_id = eq.id
  JOIN users u ON ua.user_id = u.id
  WHERE eq.course_id = p_course_id
    AND ua.essay_answer IS NOT NULL
    AND (p_question_type_category IS NULL OR eq.question_type_category = p_question_type_category)
    AND (
      (p_graded_status = 'ungraded' AND ua.requires_grading = true) OR
      (p_graded_status = 'graded' AND ua.manually_reviewed = true) OR
      (p_graded_status = 'all')
    )
  ORDER BY
    CASE WHEN p_graded_status = 'ungraded' THEN ua.submitted_at END ASC,
    ua.submitted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
