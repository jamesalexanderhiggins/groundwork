import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { anthropic, AI_ENABLED, buildSystemPrompt, type UserContext } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!AI_ENABLED) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const { summary, context }: { summary: string; context: UserContext } = await request.json();

  const message = await anthropic!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages: [
      {
        role: 'user',
        content: `Generate a warm, encouraging weekly life review based on this week's activity. Be sensitive to the user's cognitive mode.\n\nActivity summary:\n${summary}`,
      },
    ],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  return NextResponse.json({ content });
}
