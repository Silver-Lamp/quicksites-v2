# Phase 0 Runbook — gracepointcollective.com email cutover (manual proof)

> Companion to [`EMAIL_HOSTING_PLAN.md`](EMAIL_HOSTING_PLAN.md). Goal: prove Tier A
> (forwarding + Gmail send-as via Forward Email) on ONE real domain, by hand, before
> writing any code. Phase 1 stays a *potential* until this run says it's worth it.
>
> **Do not start until Amy confirms she's ready to move email off Workspace.**
> Cutting MX stops NEW mail arriving in her Workspace inbox — that is the point,
> but it must be her call, on her timeline.

## 0. Current state (verified live 2026-07-16 via DNS)

| Record | Live value today | Meaning |
|---|---|---|
| NS | `ns-cloud-e{1..4}.googledomains.com` | DNS is on Google's nameservers (legacy Google Domains — the console is now Squarespace Domains, or Google Admin → Domains) |
| MX | `1 smtp.google.com` | **Live Google Workspace email** ← the thing we're replacing |
| A @ | `198.185.159.144` | Squarespace parking / "under construction" page |
| CNAME www | `ext-sq.squarespace.com` | Same parking page |
| TXT (SPF) | `v=spf1 include:_spf.google.com ~all` | Authorizes Google to send for the domain |
| DMARC | *(none)* | No policy today |

**Rollback is these values.** If anything goes wrong, restoring `MX 1 smtp.google.com`
and the SPF above returns email to exactly today's state (Workspace keeps the mailbox
as long as the subscription is active).

Note the site (A/www → Squarespace parking) is a SEPARATE, independent change — the
`/bring-your-domain` flow handles that. This runbook touches **email records only**.

## 1. Pre-flight (with Amy, before touching anything)

- [ ] **Destination inbox**: forwarding needs a personal `@gmail.com` (or any non-Workspace
      inbox) as the target. If her only inbox today is `…@gracepointcollective.com`
      (Workspace), create/choose the free personal Gmail FIRST.
- [ ] **Inventory the addresses that exist today** (ask her / check Google Admin):
      which of `amy@`, `info@`, `hello@`, group aliases actually receive mail? Each
      becomes a Forward Email alias.
- [ ] **Archive**: run [Google Takeout](https://takeout.google.com) (or Gmail IMAP copy)
      for every Workspace mailbox BEFORE cancellation is even discussed. Old mail does
      not survive Workspace cancellation.
- [ ] **Console access**: confirm she can see DNS records for the domain (Squarespace →
      Domains → DNS, or admin.google.com → Domains). If she can see the MX table, we're good.

## 2. Forward Email account (this becomes the platform account if Phase 1 happens)

- [ ] Create the account at [forwardemail.net](https://forwardemail.net) **on our
      credentials, not Amy's** — Tier A is our product; unlimited domains ride this one
      account later.
- [ ] Plan: **Enhanced Protection ($3/mo)** — gets private (non-public-DNS) aliases,
      their outbound SMTP (clean SPF/DKIM alignment for send-as), and the REST API
      Phase 1 would use.
- [ ] Add domain `gracepointcollective.com` → the dashboard shows the exact
      verification TXT record for the domain.

## 3. DNS changes (at her DNS console — see §0 for where)

Add / replace, per the Forward Email dashboard (canonical values below, but trust the
dashboard if it disagrees):

| Action | Type | Host | Value | Priority |
|---|---|---|---|---|
| **Replace** `1 smtp.google.com` | MX | @ | `mx1.forwardemail.net` | 0 |
| add second | MX | @ | `mx2.forwardemail.net` | 0 |
| add | TXT | @ | *(verification record from the dashboard)* | — |
| **Replace** SPF | TXT | @ | `v=spf1 a include:spf.forwardemail.net -all` | — |
| add (from dashboard, Outbound SMTP config) | DKIM TXT + Return-Path | — | *(generated per-domain)* | — |
| optional | TXT | `_dmarc` | `v=DMARC1; p=none;` (monitor first) | — |

Sequencing: create the **aliases first (§4), MX second** — then no window exists where
mail arrives with nowhere to go. During DNS propagation some mail may still land in the
old Workspace inbox (fine — it's still active until she cancels).

## 4. Aliases + send-as

- [ ] In Forward Email → domain → Aliases: `hello@` → her personal Gmail (+ every
      address from the §1 inventory; optionally a catch-all).
- [ ] Generate the alias password (alias settings → generate password).
- [ ] In her Gmail: Settings → Accounts → "Send mail as" → add `hello@gracepointcollective.com`
      with SMTP `smtp.forwardemail.net`, port `465` (SSL), username = full alias
      address, password = the generated one. Confirm via the verification mail (it
      forwards to her Gmail).

## 5. Test matrix (the actual proof)

- [ ] External address → `hello@gracepointcollective.com` arrives in her Gmail (check spam folder too).
- [ ] Reply from Gmail: recipient sees **From: hello@gracepointcollective.com**, no "via" suffix.
- [ ] In the received reply, "Show original": **SPF pass, DKIM pass** for gracepointcollective.com.
- [ ] Cold-send test to a Microsoft address (outlook.com) — inbox, not junk.
- [ ] Something sent to a non-existent alias bounces (or lands in catch-all, per config).

## 6. Soak, then the money moment

- [ ] Run 1–2 weeks: Workspace stays paid (archive access), all NEW mail flows through
      forwarding. Any misses/spam complaints → note in §7.
- [ ] Takeout export confirmed complete → Amy cancels Workspace.
- [ ] She keeps: the domain registration (~$12–20/yr, wherever it's registered today).
      **~$50/mo → ~$1.50/mo equivalent.** That delta is the product.

## 7. What this run must teach us (fill in during/after)

- Time-to-working, in minutes, for a non-technical owner with us on the phone: ____
- Steps that needed hand-holding (candidates for Phase 1 automation): ____
- Deliverability observations (spam placement, alignment): ____
- Verdict: does Tier A feel like a product, or a support trap? → **go / no-go on Phase 1**

## Rollback (any point before Workspace cancellation)

Restore at her DNS console: `MX @ 1 smtp.google.com` (delete the two forwardemail MX),
SPF TXT back to `v=spf1 include:_spf.google.com ~all`. Propagation ≤ 1 hour typical.
