import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { anthropic, AI_ENABLED, buildSystemPrompt, type UserContext } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!AI_ENABLED) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const { text, context }: { text: string; context: UserContext } = await request.json();
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const message = await anthropic!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: buildSystemPrompt(context),
    messages: [
      {
        role: 'user',
        content: `Parse this into a structured life item. Return JSON only with keys: title, category, due_at (ISO string or null), recurrence_pattern (object or null), body (optional detail).\n\nInput: ${text}`,
      },
    ],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw }, { status: 422 });
  }
}
