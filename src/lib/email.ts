import { Resend } from 'resend';

const FROM = 'Level Up <no-reply@welevelup.org>';
const LOGO_URL = 'https://welevelup.org/images/level_up_new.webp';
const SITE_URL = 'https://welevelup.org';

function getResend() {
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

function brandName() {
  return `<span style="background:#CCFF33;padding:0 3px;">Level Up</span>`;
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Level Up</title>
</head>
<body style="margin:0;padding:0;background:#f0f0ec;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ec;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

        <!-- Logo -->
        <tr><td style="padding:32px 40px 24px;text-align:center;">
          <img src="${LOGO_URL}" alt="Level Up" width="120" style="display:inline-block;max-width:120px;" />
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <div style="border-top:1px solid #e0e0e0;"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px 24px;font-size:16px;line-height:1.7;color:#1a1a1a;">
          ${content}
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <div style="border-top:1px solid #e0e0e0;"></div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Level Up" width="80" style="display:inline-block;max-width:80px;margin-bottom:16px;" />
          <p style="margin:0 0 8px;font-size:12px;color:#666;">You are receiving this email because you donated to ${brandName()}'s campaigns for gender justice in the UK.</p>
          <p style="margin:0 0 4px;font-size:12px;color:#666;"><strong>Our mailing address is:</strong></p>
          <p style="margin:0;font-size:12px;color:#666;">New Derwent House, 69–73 Theobalds Road, London WC1X 8TA</p>
          <p style="margin:8px 0 0;font-size:12px;">Contact us at: <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;text-decoration:none;">hello@welevelup.org</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:#7b68ee;border-radius:4px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
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
  const firstName = name ? name.split(' ')[0] : '';
  const greeting = firstName ? `${firstName},` : 'Thank you,';
  const typeLabel = recurring ? 'monthly donation' : 'donation';

  const giftAidNote = giftAid
    ? `<p style="margin:16px 0;font-size:14px;background:#f9ffe0;border-left:3px solid #CCFF33;padding:10px 14px;color:#333;"><strong>Gift Aid registered.</strong> We will claim an additional 25p for every £1 you donate at no extra cost to you.</p>`
    : '';

  const portalNote = recurring
    ? `<p style="margin:24px 0 0;font-size:14px;color:#555;">To manage or cancel your monthly donation, visit your <a href="${SITE_URL}/donor-portal" style="color:#5b4fcf;">donor portal</a> or email <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;">hello@welevelup.org</a>.</p>`
    : '';

  const html = baseTemplate(`
    <p style="margin:0 0 20px;">${greeting} with your support we're fighting for gender justice in the UK — and your ${typeLabel} of <strong>£${amount}${recurring ? ' every month' : ''}</strong> makes that possible.</p>

    <p style="margin:0 0 20px;"><strong>Here's what your donation powers:</strong></p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#1a1a1a;">
      <li style="margin-bottom:8px;">Campaigns for abortion decriminalisation in England and Wales</li>
      <li style="margin-bottom:8px;">Ending the imprisonment of pregnant women</li>
      <li style="margin-bottom:8px;">Dignified media coverage of domestic abuse deaths</li>
      <li style="margin-bottom:8px;">Community bystander training — We Protect Us</li>
    </ul>

    ${giftAidNote}

    ${ctaButton(`${SITE_URL}/campaigns/`, 'See our campaigns')}

    <p style="margin:24px 0 8px;">In solidarity,</p>
    <p style="margin:0;">Janey, Ikamara, Seyi, Ruvimbo, Jade and Catalina (${brandName()})</p>

    ${portalNote}
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
    <p style="margin:0 0 20px;">Hi,</p>
    <p style="margin:0 0 24px;">Click the button below to access your ${brandName()} donor portal. The link expires in <strong>1 hour</strong>.</p>

    ${ctaButton(url, 'Access my portal')}

    <p style="margin:24px 0 0;font-size:14px;color:#666;">If you didn't request this, you can ignore this email. Questions? <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;">hello@welevelup.org</a></p>
  `);

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Level Up donor portal access link',
    html,
  });
}
