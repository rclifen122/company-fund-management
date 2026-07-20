-- The payment form offers "Khác" (other) as a payment method, but the V10
-- constraint only allowed cash/bank_transfer/e_wallet, so those inserts failed.
-- Recreate the constraint with 'other' included. Safe to run on databases that
-- already applied V10 and on fresh installs where V10 now includes 'other'.

begin;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.fund_payments'::regclass
      and conname = 'fund_payments_method_check'
  ) then
    alter table public.fund_payments
      drop constraint fund_payments_method_check;
  end if;

  alter table public.fund_payments
    add constraint fund_payments_method_check
    check (payment_method in ('cash', 'bank_transfer', 'e_wallet', 'other')) not valid;
end;
$$;

commit;
