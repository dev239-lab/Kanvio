const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const Board = require('../models/Board');
const Card = require('../models/Card');
const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const { emailUsers } = require('../utils/notify');
const { sendMail, emailEnabled } = require('../utils/mailer');
const { reminderEmail, deadlineEmail } = require('../utils/emailTemplates');

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = (io) => {
  // Runs every minute: card reminders
  cron.schedule('* * * * *', async () => {
    try {
      const due = await Reminder.find({
        sent: false,
        remindAt: { $lte: new Date() },
      }).populate('card', 'title board');

      for (const reminder of due) {
        // Mark as sent first; skip if another run already did it
        const result = await Reminder.updateOne(
          { _id: reminder._id, sent: false },
          { sent: true }
        );
        if (result.modifiedCount === 0) continue;

        // The card may have been deleted since the reminder was set
        if (!reminder.card) continue;

        io.to(`user:${reminder.user}`).emit('reminder', {
          reminderId: reminder._id,
          cardId: reminder.card._id,
          boardId: reminder.card.board,
          message: `Reminder: "${reminder.card.title}" is due`,
        });
        console.log(`Reminder sent for card: ${reminder.card.title}`);

        // The same reminder by email, for people who turned that on
        const board = await Board.findById(reminder.card.board).select('title');
        emailUsers([reminder.user], 'reminder', () =>
          reminderEmail({
            cardTitle: reminder.card.title,
            boardTitle: board ? board.title : 'Board',
            boardId: reminder.card.board,
            remindAt: reminder.remindAt,
          })
        );
      }
    } catch (err) {
      console.error('Reminder scheduler error:', err.message);
    }
  });

  // Runs every 15 minutes: emails people whose assigned cards are due within the next 24 hours.
  // It uses the same "Reminders" email choice as card reminders, and sends each one only once.
  cron.schedule('*/15 * * * *', async () => {
    try {
      if (!emailEnabled()) return;

      const now = new Date();
      const cards = await Card.find({
        completed: false,
        dueDate: { $gt: now, $lte: new Date(now.getTime() + DAY_MS) },
        'assignedTo.0': { $exists: true },
      })
        .populate('board', 'title')
        .limit(200);

      for (const card of cards) {
        if (!card.board) continue;
        const people = await User.find({
          _id: { $in: card.assignedTo },
          'emailPrefs.reminder': true,
        }).select('name email');

        for (const person of people) {
          try {
            // The unique index makes this a "claim": a second attempt fails and is skipped
            await EmailLog.create({
              user: person._id,
              card: card._id,
              kind: 'deadline',
              key: card.dueDate.toISOString(),
            });
          } catch {
            continue;
          }
          sendMail({
            to: person.email,
            ...deadlineEmail({
              cardTitle: card.title,
              boardTitle: card.board.title,
              boardId: card.board._id,
              dueDate: card.dueDate,
            }),
          });
        }
      }
    } catch (err) {
      console.error('Deadline email job error:', err.message);
    }
  });

  console.log('Reminder scheduler started');
};