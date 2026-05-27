import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { E2E_TEST_USER_ID } from '@/lib/e2e';

export async function GET() {
  if (process.env.E2E_TEST_MODE !== 'true') {
    return NextResponse.json({ error: 'E2E mode disabled' }, { status: 403 });
  }

  try {
    const supabase = await createClient();

    // Query for answers that belong to other students; RLS should return no rows.
    const { data, error } = await supabase
      .from('user_exam_answers')
      .select('id,user_id')
      .neq('user_id', E2E_TEST_USER_ID)
      .limit(10);

    if (error) {
      console.error('E2E RLS check error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rowCount: (data || []).length,
      rows: data || [],
    });
  } catch (err) {
    console.error('E2E RLS route error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
