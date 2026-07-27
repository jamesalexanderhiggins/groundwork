import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { anthropic, AI_ENABLED, buildSystemPrompt, type UserContext } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!AI_ENABLED) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const { pendingItems, context }: { pendingItems: Array<{ title: string; due_at?: string }>; context: UserContext } = await request.json();

  const itemList = pendingItems.map(i => `- ${i.title}${i.due_at ? ` (due ${i.due_at})` : ''}`).join('\n');

  const message = await anthropic!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: buildSystemPrompt(context),
    messages: [
      {
        role: 'user',
        content: `Generate one nudge for this user. Return JSON with keys: body (string), action_label (string or null), action_type (string or null).\n\nPending items:\n${itemList}`,
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
