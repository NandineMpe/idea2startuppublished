-- CareerOS: create monthly partitions for generation_runs
-- Resolves verification gap: parent table is partitioned but only default existed.

do $$
declare
  start_month date := date_trunc('month', current_date - interval '12 months')::date;
  end_month date := date_trunc('month', current_date + interval '24 months')::date;
  month_start date;
  month_end date;
  partition_name text;
begin
  month_start := start_month;
  while month_start <= end_month loop
    month_end := (month_start + interval '1 month')::date;
    partition_name := format(
      'generation_runs_%s',
      to_char(month_start, 'YYYYMM')
    );

    execute format(
      'create table if not exists careeros.%I partition of careeros.generation_runs for values from (%L) to (%L)',
      partition_name,
      month_start,
      month_end
    );

    month_start := month_end;
  end loop;
end
$$;
