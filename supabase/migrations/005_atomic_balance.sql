-- 005 — ATOMIC BALANCE ADJUSTMENTS
-- Replaces read-then-write balance updates to eliminate race conditions.
-- Returns TRUE if the update succeeded (balance was sufficient), FALSE if not.

create or replace function adjust_balance(
  p_profile_id            uuid,
  p_small_delta           integer default 0,
  p_large_delta           integer default 0,
  p_golden_delta          integer default 0,
  p_lifetime_large_delta  integer default 0,
  p_lifetime_golden_delta integer default 0
) returns boolean
language plpgsql
security definer
as $$
declare
  v_rows integer;
begin
  update balance_accounts set
    small_balance   = small_balance   + p_small_delta,
    large_balance   = large_balance   + p_large_delta,
    golden_balance  = golden_balance  + p_golden_delta,
    lifetime_large  = lifetime_large  + greatest(0, p_lifetime_large_delta),
    lifetime_golden = lifetime_golden + greatest(0, p_lifetime_golden_delta),
    updated_at      = now()
  where profile_id = p_profile_id
    and (small_balance  + p_small_delta)  >= 0
    and (large_balance  + p_large_delta)  >= 0
    and (golden_balance + p_golden_delta) >= 0;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
