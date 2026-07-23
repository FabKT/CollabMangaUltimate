-- A Stripe invoice must never create more than one paid credit period,
-- including when distinct webhook event IDs refer to the same invoice.
create unique index if not exists subscription_periods_stripe_invoice_id_key
  on public.subscription_periods (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- Credit mutations are performed only by the trusted server. Users can read
-- their own ledger through RLS, but must never settle or refund it directly.
revoke all on function public.reserve_credits(uuid, integer, text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.settle_credits(uuid, integer, integer, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_credits(uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, integer, text, text, text, text, integer)
  to service_role;
grant execute on function public.settle_credits(uuid, integer, integer, text, jsonb)
  to service_role;
grant execute on function public.release_credits(uuid)
  to service_role;
