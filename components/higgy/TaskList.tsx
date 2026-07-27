'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TaskTapButton } from './TaskTapButton';
import type { SkinKey } from '@/lib/skins';

interface Task {
  id:           string;
  title:        string;
  reward_small: number;
  reward_large: number;
  is_gateway:   boolean;
  time_block:   'am' | 'pm' | 'any';
}

interface TaskListProps {
  amTasks:       Task[];
  pmTasks:       Task[];
  anyTasks?:     Task[];
  completedIds:  string[];
  profileId:     string;
  smallName:     string;
  largeName:     string;
  cognitiveMode: string;
  skin?:         string;
}

export function TaskList({
  amTasks, pmTasks, anyTasks = [], completedIds, profileId,
  smallName, largeName, cognitiveMode, skin,
}: TaskListProps) {
  const t = useTranslations('higgy');
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set(completedIds));

  const adhdMode = cognitiveMode === 'adhd';
  const isPm     = new Date().getHours() >= 12;

  function handleComplete(taskId: string) {
    setLocalCompleted(prev => new Set([...prev, taskId]));
  }

  function renderGroup(tasks: Task[], label: string) {
    // An empty group previously rendered "All done ✓" because
    // [].every() is true — confusing for a family with no tasks set up.
    if (tasks.length === 0) return null;

    const remaining = tasks.filter(task => !localCompleted.has(task.id));
    const doneCount = tasks.length - remaining.length;
    const allDone   = remaining.length === 0;

    // ADHD mode shows a single task at a time to reduce visual load
    const visible = adhdMode ? remaining.slice(0, 1) : tasks;

    return (
      <section className="mb-8" key={label}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{label}</h2>
          <span className="text-sm opacity-50 text-[var(--color-text)]" aria-live="polite">
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
                skin={(skin as SkinKey) ?? 'cloud_kingdom'}
                adhdMode={adhdMode}
                onComplete={handleComplete}
              />
            ))}
            {adhdMode && remaining.length > 1 && (
              <p className="text-center text-sm opacity-50 text-[var(--color-text)] mt-2">
                {remaining.length - 1} more after this
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  const totalTasks = amTasks.length + pmTasks.length + anyTasks.length;

  if (totalTasks === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3" aria-hidden="true">🌱</p>
        <p className="font-medium text-[var(--color-text)]">No tasks set up yet</p>
        <p className="text-sm opacity-55 text-[var(--color-text)] mt-1">
          A grown-up can add these from Parent tools.
        </p>
      </div>
    );
  }

  const amRemaining = amTasks.some(task => !localCompleted.has(task.id));

  return (
    <div>
      {/* Morning stays visible after noon if anything is outstanding */}
      {(!isPm || amRemaining) && renderGroup(amTasks, t('am_tasks'))}

      {renderGroup(anyTasks, t('anytime_tasks'))}

      {isPm
        ? renderGroup(pmTasks, t('pm_tasks'))
        : pmTasks.length > 0 && (
            <p className="text-center text-sm opacity-50 py-4 text-[var(--color-text)]">
              Evening tasks unlock after noon.
            </p>
          )}
    </div>
  );
}
