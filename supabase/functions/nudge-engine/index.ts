// Supabase Edge Function — runs daily at 09:00 via cron `0 9 * * *`
// Generates one AI nudge per adult profile that has pending life items.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.107.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

function buildSystemPrompt(cognitiveMode: string, locale: string): string {
  const tones: Record<string, string> = {
    standard: 'Warm, clear, direct. Conversational.',
    adhd:     'Ultra-short sentences. One action per message. Lead with the action.',
    autism:   'Literal and precise. No idioms. No ambiguity. Numbered steps where helpful.',
    dyslexia: 'Short sentences. Simple vocabulary. No dense paragraphs.',
    calm:     'Very gentle. Low pressure. Always give permission to do less. Never shame.',
  };
  return `You are Kempt — a calm, non-judgmental personal life assistant.
ALWAYS respond in the user's language: ${locale}.
Tone: ${tones[cognitiveMode] ?? tones.standard}
Never shame. Never overwhelm. One nudge at a time.`;
}

Deno.serve(async (req) => {
  // Allow Supabase cron scheduler or manual trigger
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find all adult profiles that have pending life items and no nudge today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, cognitive_mode, locale, life_stage')
    .in('life_stage', ['adult', 'elder']);

  if (!profiles?.length) return new Response(JSON.stringify({ nudged: 0 }));

  let nudged = 0;

  for (const profile of profiles) {
    // Skip if already nudged today
    const { data: todayNudge } = await supabase
      .from('nudges')
      .select('id')
      .eq('profile_id', profile.id)
      .gte('created_at', today.toISOString())
      .limit(1)
      .maybeSingle();

    if (todayNudge) continue;

    // Get pending life items
    const { data: items } = await supabase
      .from('life_items')
      .select('title, due_at, category')
      .eq('profile_id', profile.id)
      .eq('status', 'pending')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(5);

    if (!items?.length) continue;

    const itemList = items.map(i =>
      `- ${i.title}${i.due_at ? ` (due ${new Date(i.due_at).toLocaleDateString()})` : ''}${i.category ? ` [${i.category}]` : ''}`,
    ).join('\n');

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: buildSystemPrompt(profile.cognitive_mode ?? 'standard', profile.locale ?? 'en'),
        messages: [{
          role: 'user',
          content: `Generate one gentle nudge for ${profile.display_name}. Return JSON only with keys: body (string, 1-2 sentences max), action_label (string or null), action_type (string or null).\n\nPending items:\n${itemList}`,
        }],
      });

      const raw = message.content[0].type === 'text' ? message.content[0].text : '';
      const nudgeData = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());

      await supabase.from('nudges').insert({
        profile_id:   profile.id,
        body:         nudgeData.body,
        action_label: nudgeData.action_label ?? null,
        action_type:  nudgeData.action_type  ?? null,
        delivered_at: new Date().toISOString(),
      });

      nudged++;
    } catch (err) {
      console.error(`Nudge failed for ${profile.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ nudged }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
