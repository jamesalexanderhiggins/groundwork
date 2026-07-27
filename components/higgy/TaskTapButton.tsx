'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { completeTask } from '@/app/actions/tasks';
import { GateEvent }   from './GateEvent';
import { BadgeToast }  from './BadgeToast';
import { SoundManager } from '@/lib/sounds';
import type { SkinKey }  from '@/lib/skins';

// Static badge icon/title lookup (avoids an extra DB fetch)
const BADGE_META: Record<string, { icon: string; title: string; desc: string }> = {
  first_steps:     { icon: '👟', title: 'First Steps',     desc: 'The journey begins.' },
  keeper_of_order: { icon: '🏅', title: 'Keeper of Order', desc: 'Seven days. Unbroken.' },
  streak_legend:   { icon: '🔥', title: 'Streak Legend',   desc: 'Thirty days of excellence.' },
  community_hero:  { icon: '🦸', title: 'Community Hero',  desc: 'Three acts of service.' },
  big_saver:       { icon: '🏦', title: 'Big Saver',       desc: 'One hundred coins saved.' },
  virtue_rising:   { icon: '⭐', title: 'Virtue Rising',   desc: 'Virtue Level 5 reached.' },
  golden_moment:   { icon: '✨', title: 'Golden Moment',   desc: 'Your first Golden coin.' },
};

interface Task {
  id:           string;
  title:        string;
  reward_small: number;
  reward_large: number;
  is_gateway:   boolean;
  time_block:   'am' | 'pm' | 'any';
}

interface TaskTapButtonProps {
  task:       Task;
  profileId:  string;
  smallName:  string;
  largeName:  string;
  skin?:      SkinKey;
  adhdMode?:  boolean;
  onComplete?: (taskId: string, bonus: boolean) => void;
}

export function TaskTapButton({
  task, profileId, smallName, largeName, skin = 'cloud_kingdom', adhdMode = false, onComplete,
}: TaskTapButtonProps) {
  const [done,      setDone]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [showGate,  setShowGate]  = useState(false);
  const [gateBlock, setGateBlock] = useState<'am' | 'pm'>('am');
  const [pendingBadges, setPendingBadges] = useState<string[]>([]);
  const [currentBadge,  setCurrentBadge] = useState<{ icon: string; title: string; desc: string } | null>(null);

  const showNextBadge = useCallback((queue: string[]) => {
    if (!queue.length) return;
    const [first, ...rest] = queue;
    const meta = BADGE_META[first];
    if (!meta) { showNextBadge(rest); return; }
    setCurrentBadge(meta);
    SoundManager.play('badge', skin);
    setPendingBadges(rest);
  }, [skin]);

  async function handleTap() {
    if (done || loading) return;
    setLoading(true);
    if ('vibrate' in navigator) navigator.vibrate(30);

    const result = await completeTask(task.id, profileId);
    setLoading(false);
    if ('error' in result) return;

    SoundManager.play('complete', skin);
    setDone(true);
    onComplete?.(task.id, result.bonusApplied);

    if (result.bonusApplied) {
      setShowBonus(true);
      SoundManager.play('bonus', skin);
      setTimeout(() => setShowBonus(false), 2000);
    }

    if (result.gateTriggered) {
      const block = (task.time_block === 'am' || task.time_block === 'pm') ? task.time_block : 'pm';
      setGateBlock(block);
      setTimeout(() => {
        setShowGate(true);
        SoundManager.play('gate', skin);
      }, 400);
    }

    if (result.virtue?.levelUp) {
      SoundManager.play('level_up', skin);
    }

    if (result.virtue?.badgesAwarded?.length) {
      showNextBadge(result.virtue.badgesAwarded);
    }
  }

  const rewardLabel = task.reward_large > 0
    ? `+${task.reward_large} ${largeName}`
    : `+${task.reward_small} ${smallName}`;

  return (
    <>
      <motion.button
        onClick={handleTap}
        disabled={done || loading}
        whileTap={{ scale: done ? 1 : 0.95 }}
        className={`
          w-full flex items-center justify-between gap-4
          min-h-[64px] px-5 py-4 rounded-[var(--border-radius)]
          transition-all duration-200 text-left
          ${done
            ? 'bg-[var(--color-primary)]/15 opacity-60'
            : 'bg-[var(--color-bg-card)] shadow-sm active:shadow-none hover:shadow-md'
          }
        `}
        aria-label={`${task.title} — ${rewardLabel}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.div
            animate={done ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`
              w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center
              transition-colors duration-200
              ${done
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                : 'border-[var(--color-accent)] bg-transparent'
              }
            `}
          >
            {done && (
              <motion.svg
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-4 h-4 text-white"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </motion.svg>
            )}
          </motion.div>

          <span className={`font-medium text-[var(--color-text)] truncate ${done ? 'line-through opacity-60' : ''}`}>
            {task.title}
          </span>
        </div>

        <div className="flex-shrink-0">
          <AnimatePresence mode="wait">
            {showBonus ? (
              <motion.span
                key="bonus"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-bold text-[var(--color-reward)]"
              >
                BONUS!
              </motion.span>
            ) : (
              <motion.span
                key="reward"
                className={`text-sm font-semibold ${done ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] opacity-50'}`}
              >
                {rewardLabel}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      <GateEvent
        open={showGate}
        timeBlock={gateBlock}
        adhdMode={adhdMode}
        onDone={() => setShowGate(false)}
      />

      <BadgeToast
        badge={currentBadge}
        onDone={() => {
          setCurrentBadge(null);
          showNextBadge(pendingBadges);
        }}
      />
    </>
  );
}
