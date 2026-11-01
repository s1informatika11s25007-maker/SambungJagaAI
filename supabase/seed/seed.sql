-- SambungJaga intentionally ships without demo/seed records.
-- Do not truncate or populate production tables with fabricated residents, staff, evidence,
-- handovers, or audit hashes. Create user accounts through Supabase Auth and enter real
-- facility records through authenticated supervisor/admin workflows.
-- This file is intentionally a no-op.
SELECT 'No demo data was inserted.' AS seed_status;
