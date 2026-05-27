import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (process.env.E2E_TEST_MODE === 'true' && code === 'test-google-login') {
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set('e2e-role', 'student', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    return response;
  }

  if (process.env.E2E_TEST_MODE === 'true' && code === 'test-professor-login') {
    const response = NextResponse.redirect(`${origin}${next}`);
    response.cookies.set('e2e-role', 'professor', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    return response;
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Wait a moment for the session cookies to settle before reading the user row
      await new Promise(resolve => setTimeout(resolve, 500));

      const metadata = data.user.user_metadata as Record<string, unknown> | null;
      const fallbackName = data.user.email?.split('@')[0] || 'Student';
      const displayName =
        typeof metadata?.full_name === 'string' && metadata.full_name.trim()
          ? metadata.full_name.trim()
          : typeof metadata?.name === 'string' && metadata.name.trim()
            ? metadata.name.trim()
            : fallbackName;

      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', data.user.id)
        .maybeSingle();

      if (userError) {
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }

      if (!userRecord) {
        const { error: insertError } = await supabase.from('users').insert([
          {
            id: data.user.id,
            email: data.user.email,
            name: displayName,
            total_points: 0,
            problems_solved: 0,
            current_streak: 0,
            avg_score: 0,
          },
        ]);

        if (insertError) {
          return NextResponse.redirect(`${origin}/login?error=auth`);
        }
      } else if (!userRecord.name || userRecord.name.trim() === '') {
        const { error: updateError } = await supabase
          .from('users')
          .update({ name: displayName })
          .eq('id', data.user.id);

        if (updateError) {
          return NextResponse.redirect(`${origin}/login?error=auth`);
        }
      }

      // Redirect to dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
