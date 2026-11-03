const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Builds the subject, the HTML and the plain text version of one email.
// Everything that comes from users (card titles, names) is escaped in the HTML.
function build({ subject, heading, paragraphs = [], details = [], quote = '', button, closing = '' }) {
  const url = button ? `${CLIENT_URL}${button.path}` : '';
  const settingsUrl = `${CLIENT_URL}/settings/notifications`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#eef0f3;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#fcd34d;padding:20px 32px;font-size:20px;font-weight:bold">Kanvio</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 14px;font-size:24px;font-weight:600">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5;color:#4b5563">${esc(p)}</p>`).join('')}
${quote ? `<p style="margin:0 0 14px;padding:12px 16px;border-left:4px solid #fcd34d;background:#f3f4f6;line-height:1.5">${esc(quote)}</p>` : ''}
${details.map((d) => `<p style="margin:0 0 6px;line-height:1.5">${esc(d)}</p>`).join('')}
${closing ? `<p style="margin:18px 0 0;line-height:1.5;color:#4b5563">${esc(closing)}</p>` : ''}
${button ? `<p style="margin:26px 0 0"><a href="${esc(url)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#fcd34d;color:#1f2937;text-decoration:none;font-weight:bold">${esc(button.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 32px;background:#f3f4f6;font-size:12px;color:#4b5563">Choose which emails you get in <a href="${esc(settingsUrl)}" style="color:#1f2937">Settings, Notifications</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    '',
    ...paragraphs,
    quote ? `"${quote}"` : '',
    ...details,
    closing,
    button ? `${button.label}: ${url}` : '',
    '',
    `Choose which emails you get: ${settingsUrl}`,
  ]
    .filter((line, i, all) => line !== '' || (all[i - 1] !== '' && i !== 0))
    .join('\n');

  return { subject, html, text };
}

const first = (name) => String(name || '').split(' ')[0] || 'there';
const clip = (s, n = 200) => (String(s).length > n ? `${String(s).slice(0, n)}...` : String(s));

exports.welcomeEmail = (user) =>
  build({
    subject: `Welcome to Kanvio, ${first(user.name)}`,
    heading: `Welcome aboard, ${first(user.name)}`,
    paragraphs: ['Your account is ready. Here are three quick steps to get going:'],
    details: ['1. Create your first board', '2. Invite a teammate by email', '3. Set a reminder on a card'],
    closing: 'Want reminders and updates by email? You can turn them on in Settings, Notifications.',
    button: { label: 'Open Kanvio', path: '/' },
  });

exports.reminderEmail = ({ cardTitle, boardTitle, boardId, remindAt }) =>
  build({
    subject: `Reminder: ${cardTitle}`,
    heading: `Reminder: ${cardTitle}`,
    paragraphs: ['You asked us to remind you about this card.'],
    details: [`Board: ${boardTitle}`, `Reminder time: ${fmtDateTime(remindAt)}`],
    button: { label: 'View card', path: `/board/${boardId}` },
  });

exports.deadlineEmail = ({ cardTitle, boardTitle, boardId, dueDate }) =>
  build({
    subject: `Due soon: ${cardTitle}`,
    heading: `Due soon: ${cardTitle}`,
    paragraphs: ['A card assigned to you is due within the next day.'],
    details: [`Board: ${boardTitle}`, `Due: ${fmtDate(dueDate)}`],
    button: { label: 'View card', path: `/board/${boardId}` },
  });

exports.inviteEmail = ({ by, boardTitle, boardId }) =>
  build({
    subject: `${by} added you to "${boardTitle}"`,
    heading: `${by} added you to a board`,
    details: [`Board: ${boardTitle}`],
    button: { label: 'Open board', path: `/board/${boardId}` },
  });

exports.assignmentEmail = ({ by, cardTitle, boardId }) =>
  build({
    subject: `${by} assigned you to "${cardTitle}"`,
    heading: `${by} assigned you a card`,
    details: [`Card: ${cardTitle}`],
    button: { label: 'View card', path: `/board/${boardId}` },
  });

exports.mentionEmail = ({ by, cardTitle, boardId, text }) =>
  build({
    subject: `${by} mentioned you on "${cardTitle}"`,
    heading: `${by} mentioned you`,
    details: [`Card: ${cardTitle}`],
    quote: clip(text),
    button: { label: 'View comment', path: `/board/${boardId}` },
  });

exports.commentEmail = ({ by, cardTitle, boardId, text }) =>
  build({
    subject: `${by} commented on "${cardTitle}"`,
    heading: `${by} commented`,
    details: [`Card: ${cardTitle}`],
    quote: clip(text),
    button: { label: 'View comment', path: `/board/${boardId}` },
  });

exports.moveEmail = ({ by, cardTitle, listTitle, boardId }) =>
  build({
    subject: `${by} moved "${cardTitle}" to ${listTitle}`,
    heading: `${by} moved a card`,
    details: [`Card: ${cardTitle}`, `Now in: ${listTitle}`],
    button: { label: 'Open board', path: `/board/${boardId}` },
  });