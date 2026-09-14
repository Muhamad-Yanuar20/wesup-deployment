-- Wesup migration 0019: batch pickup contact + extended audit actions
-- Captures live-schema parity applied to the deployed database:
--   * batches.pickup_name (NOT NULL text) - named pickup/contact point for
--     the self-service pickup flow; existing rows backfill to a neutral default.
--   * audit_action grows create_batch / update_batch / delete_batch so the
--     supplier batch lifecycle is fully auditable.

alter type public.audit_action add value 'create_batch';
alter type public.audit_action add value 'update_batch';
alter type public.audit_action add value 'delete_batch';

alter table public.batches
  add column pickup_name text not null default 'Pickup';