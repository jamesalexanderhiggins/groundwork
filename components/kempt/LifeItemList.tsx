'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LifeItemCard } from './LifeItemCard';
import { seedTemplateItems } from '@/app/actions/life-items';
import { Button } from '@/components/shared/Button';

interface LifeItem {
  id:       string;
  title:    string;
  body?:    string | null;
  category?: string | null;
  due_at?:  string | null;
  recurrence_pattern?: object | null;
  status:   string;
}

interface LifeItemListProps {
  items:     LifeItem[];
  profileId: string;
}

const CATEGORIES = ['all', 'health', 'finance', 'admin', 'home', 'security'];

export function LifeItemList({ items: initial, profileId }: LifeItemListProps) {
  const [items,   setItems]   = useState(initial);
  const [filter,  setFilter]  = useState('all');
  const [seeding, setSeeding] = useState(false);
  const [seeded,  setSeeded]  = useState(false);

  function remove(id: string) {
    setItems(p => p.filter(i => i.id !== id));
  }

  async function handleSeed() {
    setSeeding(true);
    await seedTemplateItems(profileId);
    setSeeded(true);
    setSeeding(false);
  }

  const filtered = filter === 'all'
    ? items
    : items.filter(i => i.category === filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Category filter pills */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full capitalize transition-colors ${
                filter === c
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-border)]/30 text-[var(--color-text)] opacity-60 hover:opacity-100'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !seeded && (
        <div className="text-center py-10">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-medium text-[var(--color-text)]">Your list is clear</p>
          <p className="text-sm text-[var(--color-text)] opacity-50 mt-1 mb-5">
            Type anything above to add an item, or start with common life admin tasks.
          </p>
          <Button onClick={handleSeed} loading={seeding} className="mx-auto">
            Load starter checklist
          </Button>
        </div>
      )}

      {/* Item list */}
      <AnimatePresence initial={false}>
        {filtered.map(item => (
          <LifeItemCard key={item.id} item={item} onRemove={remove} />
        ))}
      </AnimatePresence>

      {/* Summary */}
      {items.length > 0 && (
        <p className="text-xs text-center text-[var(--color-text)] opacity-30 mt-2">
          {items.length} item{items.length !== 1 ? 's' : ''} pending
        </p>
      )}
    </div>
  );
}
