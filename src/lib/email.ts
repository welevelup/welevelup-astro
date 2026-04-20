import { Resend } from 'resend';

const FROM = 'Level Up <hello@welevelup.org>';

function getResend() {
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Level Up</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:'DM Sans',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#0C0A3E;padding:28px 40px;">
          <p style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#CCFF33;">Level Up</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#0C0A3E;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(238,235,211,0.5);">Level Up · New Derwent House, 69–73 Theobalds Road, London WC1X 8TA</p>
          <p style="margin:8px 0 0;font-size:12px;"><a href="https://welevelup.org" style="color:#CCFF33;text-decoration:none;">welevelup.org</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDonationConfirmation({
  to,
  name,
  amount,
  recurring,
  giftAid,
}: {
  to: string;
  name: string;
  amount: string;
  recurring: boolean;
  giftAid: boolean;
}): Promise<void> {
  const resend = getResend();
  const displayName = name ? `, ${name.split(' ')[0]}` : '';
  const typeLabel = recurring ? 'monthly donation' : 'donation';
  const giftAidNote = giftAid
    ? `<p style="margin:16px 0 0;font-size:14px;color:#555;background:#f9f9e8;border-left:3px solid #CCFF33;padding:12px 16px;">✓ <strong>Gift Aid registered.</strong> We will claim an additional 25p for every £1 you donate at no extra cost to you.</p>`
    : '';

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#0C0A3E;letter-spacing:-0.03em;">Thank you${displayName}!</h1>
    <p style="margin:0 0 24px;font-size:16px;color:#555;line-height:1.6;">Your ${typeLabel} of <strong>£${amount}${recurring ? '/month' : ''}</strong> has been received. Every contribution directly powers Level Up's feminist campaigns for gender justice in the UK.</p>
    ${giftAidNote}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0C0A3E;text-transform:uppercase;letter-spacing:0.06em;">What your donation supports</p>
    <ul style="margin:12px 0 0;padding:0 0 0 20px;font-size:14px;color:#555;line-height:1.8;">
      <li>Campaigns for abortion decriminalisation in England and Wales</li>
      <li>Ending the imprisonment of pregnant women</li>
      <li>Dignified media coverage of domestic abuse deaths</li>
      <li>Community bystander training — We Protect Us</li>
    </ul>
    ${recurring ? `<p style="margin:28px 0 0;font-size:13px;color:#888;">To cancel your monthly donation, email <a href="mailto:hello@welevelup.org" style="color:#0C0A3E;">hello@welevelup.org</a> or visit your <a href="https://welevelup.org/donor-portal" style="color:#0C0A3E;">donor portal</a>.</p>` : ''}
    <p style="margin:${recurring ? '8px' : '28px'} 0 0;font-size:13px;color:#888;">Questions? <a href="mailto:hello@welevelup.org" style="color:#0C0A3E;">hello@welevelup.org</a></p>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Thank you for your ${typeLabel} to Level Up`,
    html,
  });
}

export async function sendMagicLink({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  const resend = getResend();

  const html = baseTemplate(`
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#0C0A3E;letter-spacing:-0.03em;">Your donor portal link</h1>
    <p style="margin:0 0 32px;font-size:16px;color:#555;line-height:1.6;">Click the button below to access your donor portal. The link expires in <strong>1 hour</strong>.</p>
    <a href="${url}" style="display:inline-block;background:#0C0A3E;color:#CCFF33;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-decoration:none;padding:16px 32px;">Access my portal →</a>
    <p style="margin:32px 0 0;font-size:13px;color:#888;">If you didn't request this, you can ignore this email. If you have questions, contact <a href="mailto:hello@welevelup.org" style="color:#0C0A3E;">hello@welevelup.org</a>.</p>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Level Up donor portal access link',
    html,
  });
}
