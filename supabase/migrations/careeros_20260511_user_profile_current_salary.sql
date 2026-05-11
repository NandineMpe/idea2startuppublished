alter table if exists careeros.user_profiles
  add column if not exists current_salary_usd numeric(12,2);

alter table if exists careeros.user_profiles
  drop constraint if exists careeros_user_profiles_current_salary_usd_check;

alter table if exists careeros.user_profiles
  add constraint careeros_user_profiles_current_salary_usd_check
  check (current_salary_usd is null or current_salary_usd >= 0);
