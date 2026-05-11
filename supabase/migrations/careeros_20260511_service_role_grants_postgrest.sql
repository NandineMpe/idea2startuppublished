-- PostgREST requires table-level privileges for the JWT role. Phase 1 granted
-- user-facing tables to `authenticated` only; `service_role` had schema USAGE
-- but not table GRANTs — hence "permission denied for table …" after exposing
-- `careeros` in the Data API.

grant select, insert, update, delete on all tables in schema careeros to service_role;
grant usage, select on all sequences in schema careeros to service_role;

alter default privileges for role postgres in schema careeros
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema careeros
  grant usage, select on sequences to service_role;
