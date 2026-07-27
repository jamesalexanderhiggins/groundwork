'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function createPrivilege(fd: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('user_id', user.id)
    .single();
  if (!profile || !['parent', 'admin'].includes(profile.role)) {
    return { error: 'Only parents can create privileges.' };
  }

  await supabase.from('privileges').insert({
    family_id:   profile.family_id,
    title:       fd.get('title') as string,
    description: (fd.get('description') as string) || null,
    cost_large:  parseInt(fd.get('cost_large') as string) || 0,
    cost_small:  parseInt(fd.get('cost_small') as string) || 0,
    type:        (fd.get('type') as string) || 'custom',
    active:      true,
  });

  revalidatePath('/privileges');
  return { success: true };
}
