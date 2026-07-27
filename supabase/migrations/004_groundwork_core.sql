-- Life items (adult life admin tasks)
create table if not exists life_items (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references profiles not null,
  title              text not null,
  body               text,
  category           text,
  status             text default 'pending'
    check (status in ('pending','snoozed','done','dismissed')),
  due_at             timestamptz,
  snoozed_until      timestamptz,
  recurrence_pattern jsonb,
  ai_generated       boolean default false,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table life_items enable row level security;
create policy "Own profile life items" on life_items
  for all using (
    profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

-- AI-generated nudges
create table if not exists nudges (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles not null,
  body           text not null,
  action_label   text,
  action_type    text,
  action_payload jsonb,
  delivered_at   timestamptz,
  dismissed_at   timestamptz,
  created_at     timestamptz default now()
);

alter table nudges enable row level security;
create policy "Own profile nudges" on nudges
  for all using (
    profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

-- AI-generated draft communications
create table if not exists drafts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles not null,
  prompt     text not null,
  content    text not null,
  type       text,
  status     text default 'draft'
    check (status in ('draft','sent','discarded')),
  created_at timestamptz default now()
);

alter table drafts enable row level security;
create policy "Own profile drafts" on drafts
  for all using (
    profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );
