import { NextRequest, NextResponse } from 'next/server';
import { completeTask } from '@/app/actions/tasks';

export async function POST(req: NextRequest) {
  try {
    const { taskId, profileId } = await req.json() as { taskId: string; profileId: string };
    if (!taskId || !profileId) {
      return NextResponse.json({ error: 'taskId and profileId required' }, { status: 400 });
    }
    const result = await completeTask(taskId, profileId);
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
