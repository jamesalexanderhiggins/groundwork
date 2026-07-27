-- ═══════════════════════════════════════════════
-- HIGGINS CANONICAL TASK SEED
-- This function seeds a newly created family with the default task library.
-- Call after family creation: select seed_higgins_tasks(family_id, parent_profile_id);
-- ═══════════════════════════════════════════════

create or replace function seed_higgins_tasks(
  p_family_id uuid,
  p_created_by uuid
) returns void language plpgsql security definer as $$
begin
  -- AM Routine Tasks (1 Ginsey each)
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, is_recurring, recurrence_days, is_gateway, sort_order) values
    (p_family_id, p_created_by, 'Make bed',                                           'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 10),
    (p_family_id, p_created_by, 'Brush teeth',                                        'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 20),
    (p_family_id, p_created_by, 'Tidy room',                                          'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 30),
    (p_family_id, p_created_by, 'Half clean dishes away',                             'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 40),
    (p_family_id, p_created_by, 'Morning workout with trusted adult',                 'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 50),
    (p_family_id, p_created_by, 'Prepare, eat and clean own breakfast',               'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 60),
    (p_family_id, p_created_by, 'Morning dishes washed or in machine',                'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 70),
    (p_family_id, p_created_by, 'Shower',                                             'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 80),
    (p_family_id, p_created_by, 'Uniform fully on including shoes and socks',         'routine', 'am', 'small', 1, true, '{1,2,3,4,5,6,7}', true,  90);

  -- PM Routine Tasks (1 Ginsey each)
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, is_recurring, recurrence_days, is_gateway, sort_order) values
    (p_family_id, p_created_by, 'Lunchboxes cleaned, uniform hung, civvies on',       'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 10),
    (p_family_id, p_created_by, 'House and room tidy up',                             'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 20),
    (p_family_id, p_created_by, 'Homework 30 mins with trusted adult',                'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 30),
    (p_family_id, p_created_by, 'Clean up after dinner together',                     'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', false, 40),
    (p_family_id, p_created_by, 'Teeth brushed',                                      'routine', 'pm', 'small', 1, true, '{1,2,3,4,5,6,7}', true,  50),
    (p_family_id, p_created_by, 'Peace bonus',                                        'routine', 'pm', 'small', 1, false, '{1,2,3,4,5,6,7}', false, 60);

  -- Bonus Tasks (seeded to bulletin board)
  insert into tasks (family_id, created_by, title, category, time_block, reward_type, reward_small, reward_large, is_recurring, recurrence_days, sort_order) values
    (p_family_id, p_created_by, 'Vacuum lounge room fully and empty into red bin',                      'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 10),
    (p_family_id, p_created_by, 'Play chess together peacefully',                                       'bonus', 'any', 'small', 3, 0, false, '{1,2,3,4,5,6,7}', 20),
    (p_family_id, p_created_by, 'Clean a toilet with liquid and brush, wash hands after',               'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 30),
    (p_family_id, p_created_by, 'Vacuum a car and wipe interior surfaces',                              'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 40),
    (p_family_id, p_created_by, 'Set up old tablet as wall-mounted music/audiobook player (supervised)','bonus', 'any', 'large', 0, 4, false, '{1,2,3,4,5,6,7}', 50),
    (p_family_id, p_created_by, 'Sweep tiles and brush and pan to bin',                                 'bonus', 'any', 'large', 0, 2, false, '{1,2,3,4,5,6,7}', 60),
    (p_family_id, p_created_by, 'De-cobweb a structure',                                                'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 70),
    (p_family_id, p_created_by, 'General peace award',                                                  'bonus', 'any', 'large', 0, 1, false, '{1,2,3,4,5,6,7}', 80);
end;
$$;
