const Board = require('../models/Board');
const Card = require('../models/Card');
require('../models/List'); // registers the List model used by populate

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/search?q=text  (only boards the user belongs to)
exports.search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ boards: [], cards: [] });

    const rx = new RegExp(escapeRegex(q), 'i');

    const myBoards = await Board.find({ members: req.user._id }).select('title');
    const boardIds = myBoards.map((b) => b._id);
    const titleOf = Object.fromEntries(myBoards.map((b) => [b._id.toString(), b.title]));

    const boards = myBoards
      .filter((b) => rx.test(b.title))
      .slice(0, 5)
      .map((b) => ({ _id: b._id, title: b.title }));

    const found = await Card.find({ board: { $in: boardIds }, title: rx })
      .limit(8)
      .populate('list', 'title');

    const cards = found.map((c) => ({
      _id: c._id,
      title: c.title,
      boardId: c.board,
      boardTitle: titleOf[c.board.toString()],
      listTitle: c.list?.title,
    }));

    res.json({ boards, cards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};