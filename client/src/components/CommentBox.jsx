import { useEffect, useState } from 'react';
import {
  IconX,
  IconTrash,
  IconAlignLeft,
  IconMessage,
  IconCalendar,
  IconUsers,
  IconBell,
  IconCheck,
} from '@tabler/icons-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import { initials, avatarColor } from '../utils/avatar';
import { timeAgo } from '../utils/time';
import { REMIND_LEAD_OPTIONS, getRemindLead } from '../utils/preferences';

function toInputDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CommentBox({ card, listTitle, members = [], onClose, onUpdate }) {
  const { user } = useAuth();
  const socket = useSocket();

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionOff, setMentionOff] = useState(false);

  const assigned = (card.assignedTo || []).map(String);

  // Load existing comments
  useEffect(() => {
    api
      .get(`/cards/${card._id}/comments`)
      .then(({ data }) => setComments(data))
      .catch(() => setError('Could not load comments'));
  }, [card._id]);

  // Live comments from other users
  useEffect(() => {
    if (!socket) return;

    const onAdded = (comment) => {
      if (comment.card !== card._id) return;
      setComments((prev) =>
        prev.some((c) => c._id === comment._id) ? prev : [...prev, comment]
      );
    };
    const onDeleted = ({ commentId, cardId }) => {
      if (cardId !== card._id) return;
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    };

    socket.on('commentAdded', onAdded);
    socket.on('commentDeleted', onDeleted);
    return () => {
      socket.off('commentAdded', onAdded);
      socket.off('commentDeleted', onDeleted);
    };
  }, [socket, card._id]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (fields) => {
    setError('');
    try {
      await onUpdate(card._id, fields);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save changes');
    }
  };

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(card.title);
    if (t !== card.title) save({ title: t });
  };

  const saveDescription = () => {
    if (description !== (card.description || '')) save({ description });
  };

  const changeDue = (value) =>
    save({ dueDate: value ? new Date(`${value}T12:00:00`).toISOString() : null });

  const toggleAssignee = (id) => {
    const next = assigned.includes(id) ? assigned.filter((a) => a !== id) : [...assigned, id];
    save({ assignedTo: next });
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    try {
      const { data } = await api.post(`/cards/${card._id}/comments`, { text });
      setComments((prev) =>
        prev.some((c) => c._id === data._id) ? prev : [...prev, data]
      );
      setText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add comment');
    }
  };

  const deleteComment = async (id) => {
    try {
      await api.delete(`/cards/comments/${id}`);
      setComments((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete comment');
    }
  };

  const setReminder = async (e) => {
    e.preventDefault();
    if (!remindAt) return;
    setError('');
    setNotice('');
    try {
      await api.post('/reminders', {
        cardId: card._id,
        remindAt: new Date(remindAt).toISOString(),
      });
      setNotice('Reminder set. You will get a notification at that time.');
      setRemindAt('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not set reminder');
    }
  };

  // ----- @mentions -----
  const firstOf = (name) => name.split(' ')[0].toLowerCase();
  const firstCounts = {};
  members.forEach((m) => {
    firstCounts[firstOf(m.name)] = (firstCounts[firstOf(m.name)] || 0) + 1;
  });
  // What to type after @: the first name when it is unique, otherwise the full name
  const mentionLabel = (m) => (firstCounts[firstOf(m.name)] === 1 ? m.name.split(' ')[0] : m.name);

  const mentionMatch = text.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null;
  const suggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m._id !== user._id)
          .filter((m) => m.name.toLowerCase().split(' ').some((w) => w.startsWith(mentionQuery)))
          .slice(0, 5);
  const mentionOpen = suggestions.length > 0 && !mentionOff;
  const activeMention = Math.min(mentionIdx, Math.max(suggestions.length - 1, 0));

  const pickMention = (m) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${mentionLabel(m)} `));
    setMentionIdx(0);
  };

  const onCommentKeyDown = (e) => {
    if (!mentionOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIdx((activeMention + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIdx((activeMention - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pickMention(suggestions[activeMention]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // close the list, not the whole card panel
      setMentionOff(true);
    }
  };

  // Shows @Name inside a comment in bold
  const renderText = (str) => {
    const names = [
      ...new Set(
        members.flatMap((m) =>
          firstCounts[firstOf(m.name)] === 1 ? [m.name, m.name.split(' ')[0]] : [m.name]
        )
      ),
    ].sort((x, y) => y.length - x.length);
    if (names.length === 0) return str;
    const safe = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return str.split(new RegExp(`(@(?:${safe})(?![\\w]))`, 'i')).map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="cp-mention">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // Quick reminder for cards that have a due date, using the lead time from Settings
  const lead = getRemindLead();
  const leadInfo = REMIND_LEAD_OPTIONS.find((o) => o.value === lead) || REMIND_LEAD_OPTIONS[0];

  const quickRemind = async () => {
    setError('');
    setNotice('');
    const when = new Date(new Date(card.dueDate).getTime() - lead * 60000);
    if (when.getTime() <= Date.now()) {
      setError('That reminder time has already passed. Pick a later time below.');
      return;
    }
    try {
      await api.post('/reminders', { cardId: card._id, remindAt: when.toISOString() });
      setNotice(`Reminder set. You will be notified ${leadInfo.phrase}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not set reminder');
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="cp" onMouseDown={(e) => e.stopPropagation()}>
        <header className="cp-head">
          <div className="cp-head-main">
            <input
              className="cp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              aria-label="Card title"
            />
            <span className="cp-sub">in list {listTitle || 'unknown'}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </header>

        {error && <p className="form-error">{error}</p>}

        <div className="cp-body">
          <div className="cp-main">
            <section>
              <h4 className="cp-label">
                <IconAlignLeft size={16} /> Description
              </h4>
              <textarea
                className="cp-textarea"
                placeholder="Add a more detailed description..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
              />
            </section>

            <section>
              <h4 className="cp-label">
                <IconMessage size={16} /> Comments ({comments.length})
              </h4>

              <form className="cp-comment-form" onSubmit={addComment}>
                <span className="avatar xs" style={{ background: avatarColor(user.name) }}>
                  {initials(user.name)}
                </span>
                <input
                  placeholder="Write a comment, use @ to mention someone"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setMentionOff(false);
                    setMentionIdx(0);
                  }}
                  onKeyDown={onCommentKeyDown}
                />
                {mentionOpen && (
                  <div className="cp-mention-list" role="listbox">
                    {suggestions.map((m, i) => (
                      <button
                        key={m._id}
                        type="button"
                        role="option"
                        aria-selected={i === activeMention}
                        className={`cp-mention-item${i === activeMention ? ' active' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault(); // keep the cursor in the input
                          pickMention(m);
                        }}
                      >
                        <span className="avatar xs" style={{ background: avatarColor(m.name) }}>
                          {initials(m.name)}
                        </span>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </form>

              {comments.length === 0 && <p className="muted">No comments yet.</p>}

              {[...comments].reverse().map((c) => (
                <div key={c._id} className="cp-comment">
                  <span
                    className="avatar xs"
                    style={{ background: avatarColor(c.author?.name) }}
                  >
                    {initials(c.author?.name)}
                  </span>
                  <div className="cp-comment-body">
                    <div className="cp-comment-meta">
                      <b>{c.author?.name}</b>
                      <small>{timeAgo(c.createdAt)}</small>
                    </div>
                    <div className="cp-comment-text">{renderText(c.text)}</div>
                  </div>
                  {c.author?._id === user._id && (
                    <button
                      className="icon-btn"
                      onClick={() => deleteComment(c._id)}
                      aria-label="Delete comment"
                      title="Delete comment"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          </div>

          <aside className="cp-side">
            <section>
              <h4 className="cp-label">
                <IconCalendar size={16} /> Due date
              </h4>
              <input
                type="date"
                className="cp-input"
                value={toInputDate(card.dueDate)}
                onChange={(e) => changeDue(e.target.value)}
              />
              {card.dueDate && (
                <button className="link-btn" onClick={() => changeDue('')}>
                  Clear due date
                </button>
              )}
            </section>

            <section>
              <h4 className="cp-label">
                <IconUsers size={16} /> Assignees
              </h4>
              <div className="cp-members">
                {members.map((m) => {
                  const on = assigned.includes(m._id);
                  return (
                    <button
                      key={m._id}
                      type="button"
                      className={`cp-member${on ? ' on' : ''}`}
                      onClick={() => toggleAssignee(m._id)}
                    >
                      <span className="avatar xs" style={{ background: avatarColor(m.name) }}>
                        {initials(m.name)}
                      </span>
                      <span className="cp-member-name">{m.name}</span>
                      {on && <IconCheck size={16} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h4 className="cp-label">
                <IconBell size={16} /> Reminder
              </h4>
              {card.dueDate && (
                <>
                  <button
                    type="button"
                    className="btn-small cp-remind-btn"
                    style={{ marginTop: 0, marginBottom: 8 }}
                    onClick={quickRemind}
                  >
                    Remind me {leadInfo.phrase}
                  </button>
                  <p className="pw-hint" style={{ margin: '0 0 6px' }}>
                    Or pick your own time:
                  </p>
                </>
              )}
              <form onSubmit={setReminder}>
                <input
                  type="datetime-local"
                  className="cp-input"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                />
                <button type="submit" className="btn-small cp-remind-btn" disabled={!remindAt}>
                  Set reminder
                </button>
              </form>
              {notice && <p className="form-ok">{notice}</p>}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}