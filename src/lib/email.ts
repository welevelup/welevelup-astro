import { Resend } from 'resend';

const FROM = 'Level Up <no-reply@welevelup.org>';
const LOGO_URL = 'https://levelup.yourmovement.org/rails/active_storage/blobs/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBc01XIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--899d9333f326b8d370f2acf06f7fe589aef9efd5/image.png';
const SITE_URL = 'https://welevelup.org';

function getResend() {
  const key = import.meta.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

const MOVEMENT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');

body, .mceText, .mcnTextContent, .mceLabel, p, a, li, td, blockquote, h1, h2, h3, h4, h5, h6 {
  font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
}

.mceStandardButton td a, .mceButtonLink, .mceButton a, .mceButtonLink a {
  border-radius: 6px !important;
  -webkit-border-radius: 6px !important;
  -moz-border-radius: 6px !important;
  overflow: hidden;
}

img { -ms-interpolation-mode: bicubic; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
p, a, li, td, blockquote { mso-line-height-rule: exactly; }
p, a, li, td, body, table, blockquote { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }

a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: none !important;
  font-size: inherit !important;
  font-family: inherit !important;
  font-weight: inherit !important;
  line-height: inherit !important;
}

body {
  height: 100%;
  margin: 0;
  padding: 0;
  width: 100%;
  background-color: rgb(244, 244, 244);
}

p { margin: 0; padding: 0; }
table { border-collapse: collapse; }
td, p, a { word-break: break-word; }

h1, h2, h3, h4, h5, h6 { display: block; margin: 0; padding: 0; }

img, a img { border: 0; height: auto; outline: none; text-decoration: none; }

a[href^="tel"], a[href^="sms"] { color: inherit; cursor: default; text-decoration: none; }

li p { margin: 0 !important; }

.mceText p, .mcnTextContent p {
  font-size: 16px;
  font-weight: normal;
  line-height: 1.5;
  text-align: left;
  direction: ltr;
}

.mceText a, .mcnTextContent a {
  font-style: normal;
  font-weight: normal;
  text-decoration: underline;
  direction: ltr;
}

@media only screen and (max-width: 480px) {
  body { width: 100% !important; min-width: 100% !important; }
  img { height: auto !important; }
  .mceColumn { display: block !important; width: 100% !important; }
  .mceBlockContainer, .mceTextBlockContainer {
    padding-right: 16px !important;
    padding-left: 16px !important;
  }
}
`;

function baseTemplate(content: string): string {
  const header = `
    <center>
      <a href="${SITE_URL}" target="_blank" rel="noopener">
        <img src="${LOGO_URL}" alt="Level Up Logo" style="margin:20px 0;display:inline-block;max-width:120px;height:auto;" width="120">
      </a>
    </center>`;

  const footer = `
    <center>
      <a href="${SITE_URL}" target="_blank" rel="noopener">
        <img src="${LOGO_URL}" alt="Level Up Logo" style="margin:20px 0;display:inline-block;max-width:80px;height:auto;" width="80">
      </a>
    </center>
    <p style="font-size:12px;text-align:center;color:#666;margin:0 0 8px;">
      You are receiving this email because you subscribed to Level Up's mailing list.
      We don't email often, but if you'd prefer not to hear from us again, you can unsubscribe below.
    </p>
    <p style="font-size:12px;text-align:center;color:#666;margin:0;">
      <strong>Our mailing address is:</strong><br>
      New Derwent House<br>
      69–73 Theobalds Road<br>
      London WC1X 8TA<br>
      <strong>Contact us at:</strong> <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;text-decoration:none;">hello@welevelup.org</a>
    </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Level Up</title>
<style>${MOVEMENT_CSS}</style>
</head>
<body style="margin:0;padding:0;background-color:rgb(244,244,244);">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgb(244,244,244);padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

        <!-- Header -->
        <tr><td style="padding:24px 40px;text-align:center;background:#ffffff;">
          ${header}
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <div style="border-top:1px solid #e0e0e0;"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 40px 24px;font-size:16px;line-height:1.5;color:#000000;">
          ${content}
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <div style="border-top:1px solid #e0e0e0;"></div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px 32px;text-align:center;">
          ${footer}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px auto;">
    <tr><td style="background:#7b68ee;border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;">${label}</a>
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
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const typeLabel = recurring ? 'monthly donation' : 'donation';

  const giftAidNote = giftAid
    ? `<p style="margin:16px 0;font-size:14px;background:#f9ffe0;border-left:3px solid #CCFF33;padding:10px 14px;color:#333;"><strong>Gift Aid registered.</strong> We will claim an additional 25p for every £1 you donate at no extra cost to you.</p>`
    : '';

  const portalNote = recurring
    ? `<p style="margin:24px 0 0;font-size:14px;color:#555;">To manage or cancel your monthly donation, visit your <a href="${SITE_URL}/donor-portal" style="color:#5b4fcf;">donor portal</a> or email <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;">hello@welevelup.org</a>.</p>`
    : '';

  const html = baseTemplate(`
    <p style="margin:0 0 20px;">${greeting}</p>
    <p style="margin:0 0 20px;">With your support we're fighting for gender justice in the UK — and your ${typeLabel} of <strong>£${amount}${recurring ? ' every month' : ''}</strong> makes that possible.</p>

    <p style="margin:0 0 20px;"><strong>Here's what your donation powers:</strong></p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#000000;">
      <li style="margin-bottom:8px;">Campaigns for abortion decriminalisation in England and Wales</li>
      <li style="margin-bottom:8px;">Ending the imprisonment of pregnant women</li>
      <li style="margin-bottom:8px;">Dignified media coverage of domestic abuse deaths</li>
      <li style="margin-bottom:8px;">Community bystander training — We Protect Us</li>
    </ul>

    ${giftAidNote}

    ${ctaButton(SITE_URL, 'Visit our website')}

    <p style="margin:24px 0 0;line-height:1.25;">In solidarity,</p>
    <p style="margin:8px 0 0;line-height:1.25;">Level Up</p>

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
    <p style="margin:0 0 24px;">Click the button below to access your Level Up donor portal. The link expires in <strong>1 hour</strong>.</p>

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
