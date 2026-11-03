const Board = require('../models/Board');
const Event = require('../models/Event');

const COLORS = ['#fcd34d', '#818cf8', '#2dd4bf', '#f472b6', '#60a5fa', '#fb923c'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Everyone who shares at least one board with this user (only they can be invited)
async function teammateIds(userId) {
  const boards = await Board.find({ members: userId }).select('members');
  const ids = new Set();
  boards.forEach((b) => b.members.forEach((m) => ids.add(String(m))));
  ids.delete(String(userId));
  return ids;
}

// Checks the request body and returns clean fields, or an error message
async function clean(body, userId) {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Give the event a reason or title' };
  if (title.length > 120) return { error: 'The title is too long (120 characters at most)' };

  const date = String(body.date || '');
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) return { error: 'Choose a valid date' };

  const startTime = String(body.startTime || '');
  const endTime = String(body.endTime || '');
  if (startTime && !TIME.test(startTime)) return { error: 'Choose a valid start time' };
  if (endTime && !TIME.test(endTime)) return { error: 'Choose a valid end time' };
  if (endTime && !startTime) return { error: 'Add a start time before an end time' };
  if (startTime && endTime && endTime < startTime) return { error: 'The end time must be after the start time' };

  const mates = await teammateIds(userId);
  const wanted = Array.isArray(body.attendees) ? body.attendees.map(String) : [];
  const attendees = [...new Set(wanted)].filter((id) => mates.has(id));

  return {
    data: {
      title,
      date,
      startTime,
      endTime,
      notes: String(body.notes || '').slice(0, 1000),
      color: COLORS.includes(body.color) ? body.color : COLORS[0],
      attendees,
    },
  };
}

const load = (id) => Event.findById(id).populate('owner', 'name').populate('attendees', 'name');

// GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD  (events you made or were invited to)
exports.getEvents = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!DATE.test(from || '') || !DATE.test(to || '')) {
      return res.status(400).json({ message: 'from and to dates are required' });
    }
    const events = await Event.find({
      date: { $gte: from, $lte: to },
      $or: [{ owner: req.user._id }, { attendees: req.user._id }],
    })
      .sort({ date: 1, startTime: 1 })
      .populate('owner', 'name')
      .populate('attendees', 'name');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/events
exports.createEvent = async (req, res) => {
  try {
    const { data, error } = await clean(req.body, req.user._id);
    if (error) return res.status(400).json({ message: error });

    const event = await Event.create({ ...data, owner: req.user._id });
    res.status(201).json(await load(event._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/events/:id  (only the person who made it)
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (String(event.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the person who made this event can change it' });
    }

    const { data, error } = await clean(req.body, req.user._id);
    if (error) return res.status(400).json({ message: error });

    Object.assign(event, data);
    await event.save();
    res.json(await load(event._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/events/:id  (only the person who made it)
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (String(event.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Only the person who made this event can delete it' });
    }
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};