-- Simple admin analytics source for per-student activity.
-- Returns one row per student with aggregates based on real answer data.

DROP FUNCTION IF EXISTS get_admin_student_analytics(uuid);

CREATE OR REPLACE FUNCTION get_admin_student_analytics(
  p_course_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  student_name VARCHAR(255),
  student_email VARCHAR(255),
  total_submissions INTEGER,
  total_points INTEGER,
  avg_accuracy NUMERIC,
  last_submission_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id::UUID AS user_id,
    u.name::VARCHAR(255) AS student_name,
    u.email::VARCHAR(255) AS student_email,
    COALESCE(
      SUM(
        CASE
          WHEN p_course_id IS NULL OR eq.course_id = p_course_id THEN 1
          ELSE 0
        END
      ),
      0
    )::INTEGER AS total_submissions,
    COALESCE(
      SUM(
        CASE
          WHEN p_course_id IS NULL OR eq.course_id = p_course_id THEN COALESCE(ua.points_earned, 0)
          ELSE 0
        END
      ),
      0
    )::INTEGER AS total_points,
    COALESCE(
      ROUND(
        AVG(
          CASE
            WHEN (p_course_id IS NULL OR eq.course_id = p_course_id) AND eq.points > 0 THEN (COALESCE(ua.points_earned, 0)::NUMERIC / eq.points::NUMERIC) * 100
            ELSE NULL
          END
        ),
        2
      ),
      0::NUMERIC
    )::NUMERIC AS avg_accuracy,
    MAX(
      CASE
        WHEN p_course_id IS NULL OR eq.course_id = p_course_id THEN ua.submitted_at
        ELSE NULL
      END
    )::TIMESTAMP WITH TIME ZONE AS last_submission_at
  FROM users u
  LEFT JOIN user_exam_answers ua
    ON ua.user_id = u.id
  LEFT JOIN exam_questions eq
    ON eq.id = ua.question_id
  WHERE u.role = 'student'
  GROUP BY u.id, u.name, u.email
  ORDER BY u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;