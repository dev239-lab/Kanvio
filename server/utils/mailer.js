const nodemailer = require('nodemailer');

// Email is optional. It turns on when these are set in server/.env:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM (and CLIENT_URL for the links in emails)
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;
const configured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;

if (configured) {
  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  transporter
    .verify()
    .then(() => console.log('Email is ready'))
    .catch((err) => console.error('Email setup problem:', err.message));
} else {
  console.log('Email is off. Set SMTP_HOST, SMTP_USER and SMTP_PASS in server/.env to turn it on.');
}

// Demo and test accounts use made-up addresses, so never try to mail them
const isMadeUp = (address) => /@(example\.com|kanvio\.com)$/i.test(address || '');

exports.emailEnabled = () => configured;

// Sends one email. It never throws: a failed email must not break the action that caused it.
exports.sendMail = async ({ to, subject, html, text }) => {
  if (!configured || !to || isMadeUp(to)) return false;
  try {
    await transporter.sendMail({
      from: EMAIL_FROM || `Kanvio <${SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return true;
  } catch (err) {
    console.error('Email failed:', err.message);
    return false;
  }
};