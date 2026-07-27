'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { acceptQuest, completeQuest } from '@/app/actions/quests';
import { Button } from '@/components/shared/Button';

interface Quest {
  id:              string;
  title:           string;
  description:     string | null;
  reward_large:    number;
  reward_small:    number;
  reward_golden:   number;
  quest_expires_at: string | null;
  assigned_to:     string | null;
}

interface QuestRevealProps {
  quest:      Quest;
  profileId:  string;
  largeName:  string;
  smallName:  string;
  goldenName: string;
  isNew:      boolean;
  onClose:    () => void;
}

function useTypewriter(text: string, speed = 40) {
  const [index, setIndex]       = useState(0);
  const [prevText, setPrevText] = useState(text);

  // Reset during render when the text changes. This is the supported way to
  // adjust state from props — resetting inside an effect caused a cascading
  // re-render on every reveal.
  if (prevText !== text) {
    setPrevText(text);
    setIndex(0);
  }

  useEffect(() => {
    if (index >= text.length) return;
    const timer = setTimeout(() => setIndex(n => n + 1), speed);
    return () => clearTimeout(timer);
  }, [index, text, speed]);

  return text.slice(0, index);
}

function useCountdown(expiresAt: string | null) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => {
      const rem = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecs(rem);
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);
  return secs;
}

export function QuestReveal({ quest, profileId, largeName, smallName, goldenName, isNew, onClose }: QuestRevealProps) {
  const title    = useTypewriter(quest.title, 50);
  const countdown = useCountdown(quest.quest_expires_at);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const rewardLabel = quest.reward_golden > 0
    ? `${quest.reward_golden} ${goldenName}`
    : quest.reward_large > 0
      ? `${quest.reward_large} ${largeName}`
      : `${quest.reward_small} ${smallName}`;

  async function handleAccept() {
    setLoading(true);
    await acceptQuest(quest.id, profileId);
    setLoading(false);
    onClose();
  }

  async function handleComplete() {
    setLoading(true);
    const result = await completeQuest(quest.id, profileId);
    setLoading(false);
    if ('pendingApproval' in result) {
      setDone(true);
      setTimeout(onClose, 2000);
    } else {
      onClose();
    }
  }

  const fmtCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 250, damping: 22 }}
        className="w-full max-w-sm bg-[var(--color-bg-card)] rounded-[var(--border-radius)] overflow-hidden shadow-2xl"
      >
        <div className="bg-[var(--color-primary)] px-6 py-5 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/80 text-sm font-medium uppercase tracking-widest mb-2"
          >
            ⚔️ A Quest Has Arrived
          </motion.p>
          <h2 className="text-white font-bold text-2xl leading-tight min-h-[3rem]">
            {title}
            <span className="animate-pulse">|</span>
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {quest.description && (
            <p className="text-[var(--color-text)] opacity-70 text-sm leading-relaxed">
              {quest.description}
            </p>
          )}

          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center justify-center gap-2 py-3 bg-[var(--color-reward)]/10 rounded-[var(--border-radius)]"
          >
            <span className="text-2xl">🏆</span>
            <span className="font-bold text-[var(--color-text)]">{rewardLabel}</span>
          </motion.div>

          {countdown !== null && countdown > 0 && (
            <p className="text-center text-sm text-red-500 font-medium">
              ⏰ Expires in {fmtCountdown(countdown)}
            </p>
          )}

          {done ? (
            <p className="text-center text-green-600 font-semibold py-2">
              ✓ Submitted for approval!
            </p>
          ) : quest.assigned_to === profileId ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Later
              </Button>
              <Button onClick={handleComplete} loading={loading} className="flex-1">
                Complete
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Ask parent
              </Button>
              <Button onClick={handleAccept} loading={loading} className="flex-1">
                Accept quest
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
