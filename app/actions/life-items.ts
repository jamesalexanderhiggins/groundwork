'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export type LifeItemStatus = 'pending' | 'snoozed' | 'done' | 'dismissed';

export interface LifeItemInput {
  title:              string;
  body?:              string;
  category?:          string;
  due_at?:            string | null;
  recurrence_pattern?: object | null;
  ai_generated?:      boolean;
}

export async function createLifeItem(profileId: string, item: LifeItemInput) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('life_items')
    .insert({
      profile_id:         profileId,
      title:              item.title,
      body:               item.body ?? null,
      category:           item.category ?? null,
      due_at:             item.due_at ?? null,
      recurrence_pattern: item.recurrence_pattern ?? null,
      ai_generated:       item.ai_generated ?? false,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/life");
  return { item: data };
}

export async function updateLifeItemStatus(itemId: string, status: LifeItemStatus, snoozedUntil?: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('life_items')
    .update({
      status,
      snoozed_until: snoozedUntil ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) return { error: error.message };
  revalidatePath("/life");
  return { success: true };
}

export async function getLifeItems(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('life_items')
    .select('*')
    .eq('profile_id', profileId)
    .in('status', ['pending', 'snoozed'])
    .order('due_at', { ascending: true, nullsFirst: false });

  return data ?? [];
}

export async function seedTemplateItems(profileId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const templates: LifeItemInput[] = [
    { title: 'Schedule dentist appointment',        category: 'health',    ai_generated: false },
    { title: 'Renew car registration',              category: 'admin',     ai_generated: false },
    { title: 'Review household insurance policy',   category: 'finance',   ai_generated: false },
    { title: 'Check and update emergency contacts', category: 'admin',     ai_generated: false },
    { title: 'Service smoke alarms',                category: 'home',      ai_generated: false },
    { title: 'Organise tax receipts',               category: 'finance',   ai_generated: false },
    { title: 'Book annual health checkup',          category: 'health',    ai_generated: false },
    { title: 'Update household passwords',          category: 'security',  ai_generated: false },
    { title: 'Create/review family budget',         category: 'finance',   ai_generated: false },
    { title: 'Write or update a will',              category: 'admin',     ai_generated: false },
  ];

  const { error } = await supabase.from('life_items').insert(
    templates.map(t => ({ profile_id: profileId, ...t })),
  );

  if (error) return { error: error.message };
  revalidatePath("/life");
  return { success: true, count: templates.length };
}
