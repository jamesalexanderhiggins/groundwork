'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { QuestReveal } from './QuestReveal';

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

interface QuestBoardProps {
  quests:     Quest[];
  profileId:  string;
  largeName:  string;
  smallName:  string;
  goldenName: string;
}

export function QuestBoard({ quests, profileId, largeName, smallName, goldenName }: QuestBoardProps) {
  const [selected, setSelected] = useState<Quest | null>(null);

  if (quests.length === 0) {
    return (
      <div className="text-center py-16 opacity-50 text-[var(--color-text)]">
        <p className="text-4xl mb-3">🗺️</p>
        <p className="font-semibold">No quests yet.</p>
        <p className="text-sm mt-1">Check back or ask a parent!</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {quests.map(quest => {
          const rewardLabel = quest.reward_golden > 0
            ? `${quest.reward_golden} ${goldenName}`
            : quest.reward_large > 0
              ? `${quest.reward_large} ${largeName}`
              : `${quest.reward_small} ${smallName}`;

          const isAccepted = quest.assigned_to === profileId;

          return (
            <button
              key={quest.id}
              onClick={() => setSelected(quest)}
              className="w-full text-left bg-[var(--color-bg-card)] rounded-[var(--border-radius)] p-4 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-[var(--color-primary)]/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--color-text)]">{quest.title}</p>
                  {quest.description && (
                    <p className="text-sm opacity-60 text-[var(--color-text)] mt-1 line-clamp-2">
                      {quest.description}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-[var(--color-primary)]">{rewardLabel}</p>
                  {isAccepted && (
                    <p className="text-xs text-green-600 mt-0.5">✓ Accepted</p>
                  )}
                  {quest.quest_expires_at && (
                    <p className="text-xs text-red-500 mt-0.5">⏰ Limited</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <QuestReveal
            quest={selected}
            profileId={profileId}
            largeName={largeName}
            smallName={smallName}
            goldenName={goldenName}
            isNew={selected.assigned_to === null}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
