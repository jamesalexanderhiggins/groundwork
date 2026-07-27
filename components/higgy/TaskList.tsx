'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TaskTapButton } from './TaskTapButton';

interface Task {
  id:           string;
  title:        string;
  reward_small:  number;
  reward_large:  number;
  is_gateway:   boolean;
  time_block:   'am' | 'pm' | 'any';
}

interface TaskListProps {
  amTasks:       Task[];
  pmTasks:       Task[];
  completedIds:  string[];
  profileId:     string;
  smallName:     string;
  largeName:     string;
  cognitiveMode: string;
  skin?:         string;
}

export function TaskList({ amTasks, pmTasks, completedIds, profileId, smallName, largeName, cognitiveMode, skin }: TaskListProps) {
  const t = useTranslations('higgy');
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set(completedIds));

  const adhdMode = cognitiveMode === 'adhd';
  const hour     = new Date().getHours();
  const isPm     = hour >= 12;

  function handleComplete(taskId: string) {
    setLocalCompleted(prev => new Set([...prev, taskId]));
  }

  function renderTasks(tasks: Task[], label: string) {
    const visible = adhdMode
      ? tasks.filter(t => !localCompleted.has(t.id)).slice(0, 1)
      : tasks;

    const allDone  = tasks.every(t => localCompleted.has(t.id));
    const doneCount = tasks.filter(t => localCompleted.has(t.id)).length;

    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{label}</h2>
          <span className="text-sm opacity-50 text-[var(--color-text)]">
            {doneCount}/{tasks.length}
          </span>
        </div>

        {allDone ? (
          <div className="text-center py-6 text-[var(--color-primary)] font-semibold text-lg">
            {t('all_done')} ✓
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map(task => (
              <TaskTapButton
                key={task.id}
                task={task}
                profileId={profileId}
                smallName={smallName}
                largeName={largeName}
                skin={(skin as import('@/lib/skins').SkinKey) ?? 'cloud_kingdom'}
                adhdMode={adhdMode}
                onComplete={handleComplete}
              />
            ))}
            {adhdMode && tasks.filter(t => !localCompleted.has(t.id)).length > 1 && (
              <p className="text-center text-sm opacity-50 text-[var(--color-text)] mt-2">
                {tasks.filter(t => !localCompleted.has(t.id)).length - 1} more after this
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div>
      {(!isPm || amTasks.some(t => !localCompleted.has(t.id))) &&
        renderTasks(amTasks, t('am_tasks'))}
      {isPm &&
        renderTasks(pmTasks, t('pm_tasks'))}
      {!isPm && amTasks.every(t => localCompleted.has(t.id)) &&
        <p className="text-center text-sm opacity-50 py-4 text-[var(--color-text)]">
          PM tasks unlock after noon.
        </p>
      }
    </div>
  );
}
