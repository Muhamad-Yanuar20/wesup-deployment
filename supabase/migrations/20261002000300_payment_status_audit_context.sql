-- Preserve the existing RPC signatures and validation/locking bodies. Consume a
-- server-authored audit envelope before storing the provider payload.
do $$
declare v_function record; v_definition text; v_patched text;
begin
 for v_function in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('apply_midtrans_payment_event','finalize_payment') and p.prokind='f'
 loop
  v_definition:=replace(pg_get_functiondef(v_function.oid),chr(13),'');
  v_patched:=regexp_replace(v_definition,E'\n[Bb][Ee][Gg][Ii][Nn]\n',E'\nbegin\n'
   || $injection$
  perform set_config('app.operation',case when p_payload->'_wesup_audit'->>'source' in ('payment_webhook','payment_reconciliation') then p_payload->'_wesup_audit'->>'source' else 'payment_provider' end,true);
  perform set_config('app.request_id',case when p_payload->'_wesup_audit'->>'requestId' ~ '^[0-9a-fA-F-]{36}$' then p_payload->'_wesup_audit'->>'requestId' else 'dbtx:'||txid_current()::text end,true);
  p_payload:=coalesce(p_payload,'{}'::jsonb)-'_wesup_audit';
  $injection$);
  if v_patched=v_definition then raise exception 'payment audit context injection failed for %',v_function.proname;end if;
  execute v_patched;
 end loop;
end$$;
