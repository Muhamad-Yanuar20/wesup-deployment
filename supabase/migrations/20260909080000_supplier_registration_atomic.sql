-- Commit a newly registered Supplier's role and pending business profile in one transaction.
-- This function is intentionally callable only by the service role after auth signup and photo upload.
create or replace function public.create_supplier_registration(
  p_user_id uuid,
  p_business_name text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_business_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null
     or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'supplier registration user does not exist';
  end if;

  update public.profiles
     set role = 'supplier', updated_at = now()
   where id = p_user_id;
  if not found then
    raise exception 'supplier registration profile does not exist';
  end if;

  insert into public.supplier_profiles (
    user_id,
    business_name,
    address,
    latitude,
    longitude,
    business_photo_url,
    verification_status
  ) values (
    p_user_id,
    p_business_name,
    p_address,
    p_latitude,
    p_longitude,
    p_business_photo_url,
    'pending'
  );
end;
$$;

revoke execute on function public.create_supplier_registration(uuid, text, text, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.create_supplier_registration(uuid, text, text, numeric, numeric, text)
  to service_role;
