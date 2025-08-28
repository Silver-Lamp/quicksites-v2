import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

type InvitePayload = {
  emails: string[];         // required
  role: 'admin'|'reseller'|'affiliate_referrer'|'viewer';
  name?: string;            // optional (single name applies to all)
  sendEmail?: boolean;      // when true and RESEND_API_KEY set, send via Resend
};

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InvitePayload;
    const emails = Array.from(new Set((body.emails || []).map(e => String(e).trim()).filter(Boolean)));
    const role = body.role || 'viewer';
    const sendEmail = !!body.sendEmail;

    if (!emails.length) {
      return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
    }

    const supa = await getServerSupabase({ serviceRole: true });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const base = process.env.QS_PUBLIC_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const results: Array<{ email: string, status: 'invited'|'link'|'exists'|'error', message?: string, userId?: string, inviteUrl?: string }> = [];

    for (const email of emails) {
      try {
        // First, see if a user already exists
        let existingId: string | null = null;
        try {
          const { data: list } = await supa.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
          if (found) existingId = found.id;
        } catch {/* non-fatal */}

        // Try inviteUserByEmail when available
        let invitedUserId: string | null = null;
        let inviteLink: string | null = null;

        const adminAny = (supa.auth.admin as any);
        if (adminAny?.inviteUserByEmail) {
          const res = await adminAny.inviteUserByEmail(email, {
            data: { invited_by: u.user.id, default_role: role },
          });
          if (res?.error) throw new Error(res.error.message);
          invitedUserId = res?.data?.user?.id || existingId;
        } else {
          // Fall back: generate an invite link
          const gen = await supa.auth.admin.generateLink({
            type: 'invite',
            email,
            options: { data: { invited_by: u.user.id, default_role: role } }
          } as any);
          if ((gen as any)?.error) throw new Error((gen as any).error.message);
          inviteLink = (gen as any)?.data?.properties?.action_link || (gen as any)?.data?.action_link || null;
          // If generateLink created a user, id may be present
          invitedUserId = (gen as any)?.data?.user?.id || existingId;
        }

        // Upsert user_profiles with role when we have a user id
        if (invitedUserId) {
          await supa.from('user_profiles').upsert({ user_id: invitedUserId, role }, { onConflict: 'user_id' });
        }

        // Optional: send email via Resend if we had to return a link ourselves
        if (sendEmail && inviteLink && process.env.RESEND_API_KEY) {
          try {
            const { Resend } = await import('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: process.env.INVITE_FROM || 'QuickSites <noreply@quicksites.ai>',
              to: email,
              subject: 'You’re invited to QuickSites',
              html: inviteEmailHtml(inviteLink, base),
            });
            results.push({ email, status: 'link', userId: invitedUserId || undefined, inviteUrl: inviteLink, message: 'Invite link sent via email.' });
          } catch (e: any) {
            results.push({ email, status: 'link', userId: invitedUserId || undefined, inviteUrl: inviteLink, message: 'Invite link created (email send failed—copy manually).' });
          }
        } else if (inviteLink) {
          results.push({ email, status: 'link', userId: invitedUserId || undefined, inviteUrl: inviteLink, message: 'Invite link created.' });
        } else {
          results.push({ email, status: 'invited', userId: invitedUserId || undefined, message: 'Email invite sent by Supabase.' });
        }
      } catch (e: any) {
        results.push({ email, status: 'error', message: e?.message || 'Failed to invite' });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 400 });
  }
}

function inviteEmailHtml(link: string, base: string) {
  return `
  <div style="font-family:Inter,system-ui,Segoe UI,sans-serif;max-width:560px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="margin:0 0 12px;color:#111">You’re invited to QuickSites</h2>
    <p style="color:#444;line-height:1.6">Click the button below to accept your invite and finish setting up your account.</p>
    <p style="margin:20px 0"><a href="${link}" style="background:#6b46ff;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Accept invite</a></p>
    <p style="color:#666;font-size:12px">If the button doesn’t work, copy & paste this URL into your browser: <br/><a href="${link}">${link}</a></p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
    <p style="color:#999;font-size:12px">This invite was generated for ${base}.</p>
  </div>`;
}
