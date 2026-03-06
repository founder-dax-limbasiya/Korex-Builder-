import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase.server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('generations')
    .select('id,template_id,tier_id,description,model_used,tokens_used,created_at,result')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ generations: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await supabase.from('generations').delete().eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok: true });
}
