-- RPCs own mutations; row policies restrict reads to the transaction participants.
grant select on public.supplier_offer_drafts, public.pickup_replacements,
  public.pickup_replacement_decisions, public.transaction_support_requests to authenticated;
grant all on public.supplier_offer_drafts, public.pickup_replacements,
  public.pickup_replacement_decisions, public.transaction_support_requests to service_role;
notify pgrst, 'reload schema';
