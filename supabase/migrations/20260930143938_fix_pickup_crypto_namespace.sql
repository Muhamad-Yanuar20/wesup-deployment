-- Supabase installs pgcrypto outside public. Resolve its schema instead of
-- widening the search_path of this ownership-gated SECURITY DEFINER function.
do $$
declare crypto_schema name; definition text;
begin
  select n.nspname into crypto_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  -- The local SQL harness supplies a pgcrypto-compatible function in public.
  if crypto_schema is null then
    select n.nspname into crypto_schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.proname='gen_random_bytes' and p.proargtypes='23'::oidvector and n.nspname='public';
  end if;
  if crypto_schema is null then raise exception 'pgcrypto gen_random_bytes is required'; end if;
  select pg_get_functiondef('public.generate_pickup_code(uuid,text,text)'::regprocedure) into definition;
  if position(format('%I.gen_random_bytes(',crypto_schema) in definition)=0 then
    execute replace(definition,'gen_random_bytes(',format('%I.gen_random_bytes(',crypto_schema));
  end if;
end;
$$;
notify pgrst, 'reload schema';
