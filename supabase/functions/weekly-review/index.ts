// Supabase Edge Function — runs every Sunday at 18:00 via cron `0 18 * * 0`
// Generates a weekly review email per adult profile and sends via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.107.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

function buildSystemPrompt(cognitiveMode: string, locale: string): string {
  const tones: Record<string, string> = {
    standard: 'Warm, clear, direct. Conversational.',
    adhd:     'Ultra-short. Bullet points. High energy. Celebrate wins loudly.',
    autism:   'Structured sections. Literal language. Consistent format every week.',
    dyslexia: 'Short sentences. Simple words. Lots of whitespace.',
    calm:     'Gentle and acknowledging. Emphasise what went well. No pressure.',
  };
  return `You are Kempt — a calm, supportive personal life assistant writing a weekly review.
ALWAYS respond in the user's language: ${locale}.
Tone: ${tones[cognitiveMode] ?? tones.standard}
Format: Use clear sections with emoji headers. Keep it under 300 words.
End with one gentle, achievable suggestion for next week.`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) { console.log('Resend not configured — skipping email.'); return; }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Kempt <hello@kempt.life>',
      to:      [to],
      subject,
      html,
    }),
  });
}

function markdownToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^## (.+)$/gm, '<h2 style="margin-top:1.5em;margin-bottom:0.5em">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="margin-top:1.2em;margin-bottom:0.4em">$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul style="margin:0.5em 0;padding-left:1.5em">$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|l])(.+)$/gm, '<p>$1</p>');
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, cognitive_mode, locale, life_stage, user_id')
    .in('life_stage', ['adult', 'elder']);

  if (!profiles?.length) return new Response(JSON.stringify({ sent: 0 }));

  let sent = 0;

  for (const profile of profiles) {
    // Gather week's activity
    const [
      { data: doneItems },
      { data: createdItems },
      { data: sentDrafts },
      { data: familyActivity },
    ] = await Promise.all([
      supabase.from('life_items')
        .select('title, category')
        .eq('profile_id', profile.id)
        .eq('status', 'done')
        .gte('updated_at', weekAgo),
      supabase.from('life_items')
        .select('title')
        .eq('profile_id', profile.id)
        .gte('created_at', weekAgo),
      supabase.from('drafts')
        .select('type, prompt')
        .eq('profile_id', profile.id)
        .eq('status', 'sent')
        .gte('created_at', weekAgo),
      // Child task completions for family context
      supabase.from('task_completions')
        .select('profiles!inner(display_name, family_id)', { count: 'exact', head: false })
        .gte('completed_at', weekAgo),
    ]);

    const summary = [
      doneItems?.length    ? `Completed ${doneItems.length} life admin task${doneItems.length > 1 ? 's' : ''}: ${doneItems.map(i => i.title).join(', ')}.` : '',
      createdItems?.length ? `Added ${createdItems.length} new item${createdItems.length > 1 ? 's' : ''} to the list.` : '',
      sentDrafts?.length   ? `Sent ${sentDrafts.length} draft${sentDrafts.length > 1 ? 's' : ''}: ${sentDrafts.map(d => d.type).join(', ')}.` : '',
    ].filter(Boolean).join('\n');

    if (!summary) continue; // No activity — skip this user

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: buildSystemPrompt(profile.cognitive_mode ?? 'standard', profile.locale ?? 'en'),
        messages: [{
          role: 'user',
          content: `Write a weekly review for ${profile.display_name}.\n\nThis week:\n${summary}\n\nKeep it warm, brief, and end with one gentle suggestion.`,
        }],
      });

      const reviewText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Get user email
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
      const email = authUser?.user?.email;

      if (email) {
        await sendEmail(
          email,
          `Your Kempt week in review ✓`,
          `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:2em;color:#1a1a1a">
            <h1 style="font-size:1.5em;margin-bottom:0.25em">Your week, ${profile.display_name}</h1>
            <p style="color:#888;margin-top:0">Kempt Weekly Review</p>
            <hr style="border:none;border-top:1px solid #eee;margin:1.5em 0">
            ${markdownToHtml(reviewText)}
            <hr style="border:none;border-top:1px solid #eee;margin:2em 0">
            <p style="color:#bbb;font-size:0.8em">Kempt · <a href="${Deno.env.get('NEXT_PUBLIC_APP_URL')}/life" style="color:#bbb">Open app</a></p>
          </body></html>`,
        );
        sent++;
      }
    } catch (err) {
      console.error(`Weekly review failed for ${profile.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
