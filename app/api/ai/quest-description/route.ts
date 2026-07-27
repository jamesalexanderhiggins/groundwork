import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { anthropic, AI_ENABLED } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!AI_ENABLED) return NextResponse.json({ description: '' }, { status: 200 });

  const { questTitle, familyContext, locale }: {
    questTitle: string;
    familyContext: string;
    locale: string;
  } = await request.json();

  const message = await anthropic!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `You write dramatic, age-appropriate quest descriptions for a family habit app. Make them exciting and adventurous. Always respond in the ${locale} language.`,
    messages: [
      {
        role: 'user',
        content: `Write a short dramatic quest description (2-3 sentences) for this quest title. Family context: ${familyContext}\n\nQuest: ${questTitle}`,
      },
    ],
  });

  const description = message.content[0].type === 'text' ? message.content[0].text : '';
  return NextResponse.json({ description });
}
