-- Test-only (MigrationTimeoutsIT, L4): runs longer than the app's 5 s statement_timeout, as an
-- index build or backfill might. Never on the production migration path.
SELECT pg_sleep(6);
