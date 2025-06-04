// supabase/functions/email-weekly-summary/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createTransport } from 'npm:nodemailer'

serve(async (req) => {
  try {
    const { summary, userEmail } = await req.json()

    if (!summary || !Array.isArray(summary)) {
      return new Response(JSON.stringify({ message: 'Invalid summary' }), { status: 400 })
    }

    const csv = 'week,count\n' + summary.map(([w, c]: [string, number]) => `${w},${c}`).join('\n')

    const transporter = createTransport({
      host: Deno.env.get('EMAIL_SERVER_HOST'),
      port: Number(Deno.env.get('EMAIL_SERVER_PORT')),
      auth: {
        user: Deno.env.get('EMAIL_SERVER_USER'),
        pass: Deno.env.get('EMAIL_SERVER_PASS'),
      },
    })

    await transporter.sendMail({
      from: 'Weekly Reports <noreply@yourapp.com>',
      to: Deno.env.get('REPORT_RECIPIENT_EMAIL') || 'admin@yourapp.com',
      subject: '📊 Weekly Deployment Summary',
      html: `<p>Weekly summary sent by: <strong>${userEmail}</strong></p><p>See attached CSV.</p>`,
      attachments: [{ filename: 'weekly-summary.csv', content: csv }],
    })

    return new Response(JSON.stringify({ message: 'Email sent via Supabase function!' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Function Error:', e)
    return new Response(JSON.stringify({ message: 'Internal Error' }), { status: 500 })
  }
})
