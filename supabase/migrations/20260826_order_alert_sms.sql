-- 20260826_order_alert_sms.sql
--
-- The SMS half of the new-order alert.
--
-- ⚠️ ONE ROW PER ORDER, STILL. `order_alerts.order_id` stays the primary key — that uniqueness IS
-- the idempotency guarantee (20260824). Adding SMS as a second ROW would break it: a retried Stripe
-- webhook would find no matching row for the sms channel and text the kitchen again. So the channel
-- becomes columns on the existing row, not a new row.
alter table if exists public.order_alerts
  add column if not exists sms_sent_at timestamptz,
  add column if not exists sms_recipient text,
  add column if not exists sms_error text;

comment on column public.order_alerts.sms_sent_at is
  'Set once the text is accepted by the provider. Null with a null sms_error means SMS was not attempted (not configured / no number on file) — three states, deliberately.';

-- Where to text. Separate from order_notify_email: the address a receipt goes to and the phone in
-- a kitchen are rarely the same person.
alter table if exists public.merchants
  add column if not exists order_notify_sms text;

comment on column public.merchants.order_notify_sms is
  'Optional E.164 mobile for new-order texts. Null => SMS not attempted. Never client-supplied at send time; resolved server-side from the order.';
