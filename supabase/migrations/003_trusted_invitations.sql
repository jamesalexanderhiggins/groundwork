-- Trusted adult invitation tokens
create table trusted_invitations (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid references families not null,
  email      text not null,
  token      text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '7 days',
  used       boolean default false
);

alter table trusted_invitations enable row level security;
create policy "Parents can manage invitations" on trusted_invitations
  for all using (
    family_id in (
      select family_id from family_members
      where user_id = auth.uid() and role in ('parent','admin')
    )
  );

-- Pending cashout requests (child-initiated, logged to transactions with a flag)
-- We use a dedicated table for clarity
create table cashout_requests (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles not null,
  large_amount integer not null default 0,
  golden_amount integer not null default 0,
  cash_value   numeric not null,
  status       text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  window_id    uuid references cashout_windows,
  approved_by  uuid references profiles,
  approved_at  timestamptz,
  created_at   timestamptz default now()
);

alter table cashout_requests enable row level security;
create policy "Own family cashout requests" on cashout_requests
  for all using (
    profile_id in (
      select id from profiles where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
  );
