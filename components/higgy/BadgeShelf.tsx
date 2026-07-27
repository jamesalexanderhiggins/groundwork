'use client';

import { motion } from 'framer-motion';

interface Badge {
  key:   string;
  icon:  string;
  title: string;
  desc:  string;
}

interface ProfileBadge {
  earned_at: string;
  badges: Badge | null;
}

interface BadgeShelfProps {
  earned:  ProfileBadge[];
  all:     Badge[];
}

export function BadgeShelf({ earned, all }: BadgeShelfProps) {
  const earnedKeys = new Set(earned.map(e => e.badges?.key).filter(Boolean));

  return (
    <div className="grid grid-cols-3 gap-3">
      {all.map((badge, i) => {
        const isEarned = earnedKeys.has(badge.key);
        return (
          <motion.div
            key={badge.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex flex-col items-center gap-1 rounded-xl p-3 border text-center ${
              isEarned
                ? 'bg-[var(--color-bg-card)] border-[var(--color-accent)]/30'
                : 'bg-[var(--color-border)]/20 border-transparent opacity-40'
            }`}
          >
            <span className={`text-3xl ${!isEarned ? 'grayscale' : ''}`}>
              {badge.icon}
            </span>
            <p className="text-xs font-semibold text-[var(--color-text)] leading-tight">
              {badge.title}
            </p>
            {isEarned && (
              <p className="text-[10px] text-[var(--color-text)] opacity-50 leading-tight">
                {badge.desc}
              </p>
            )}
            {!isEarned && (
              <p className="text-[10px] text-[var(--color-text)] opacity-40">Locked</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
