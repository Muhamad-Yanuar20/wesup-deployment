create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
          new.phone, 'umkm')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;

create or replace function public.is_admin() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_supplier() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'supplier' and status = 'active');
$$;

create or replace function public.promote_supplier_on_approval() returns trigger
  language plpgsql security definer as $$
begin
  if new.verification_status = 'approved' then
    update public.profiles set role = 'supplier' where id = new.user_id and role = 'umkm';
  end if;
  return new;
end;
$$;

create trigger promote_supplier_on_approval
  after insert or update of verification_status on public.supplier_profiles
  for each row execute function public.promote_supplier_on_approval();
