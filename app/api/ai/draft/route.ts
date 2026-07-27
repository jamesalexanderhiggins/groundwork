import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { anthropic, AI_ENABLED, buildSystemPrompt, type UserContext } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!AI_ENABLED) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const { prompt, type, context }: { prompt: string; type?: string; context: UserContext } = await request.json();
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  const message = await anthropic!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages: [
      {
        role: 'user',
        content: `Draft a ${type ?? 'message'} based on this request. Return the draft text only, no commentary.\n\nRequest: ${prompt}`,
      },
    ],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  return NextResponse.json({ content, type: type ?? 'message' });
}
