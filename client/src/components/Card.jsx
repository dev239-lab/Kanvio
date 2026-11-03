import { useState } from 'react';
import { IconX, IconClock, IconMessage } from '@tabler/icons-react';
import { initials, avatarColor } from '../utils/avatar';

function dueInfo(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const days = (due - new Date()) / 86400000;
  return {
    label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    tone: days < 0 ? 'overdue' : days < 2 ? 'soon' : 'ok',
  };
}

export default function Card({ card, listId, index, members, onDelete, onDropCard, onOpen }) {
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ cardId: card._id, fromListId: listId })
    );
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't let the list also handle this drop
    onDropCard(e, listId, index);
  };

  const due = dueInfo(card.dueDate);
  const assignees = (card.assignedTo || [])
    .map((id) => members.find((m) => m._id === id))
    .filter(Boolean);
  const hasFooter = due || card.commentCount > 0 || assignees.length > 0;

  return (
    <div
      className={`k-card${dragging ? ' dragging' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="k-card-top">
        <span className="k-card-title" onClick={() => onOpen(card)}>
          {card.title}
        </span>
        <button
          className="k-card-x"
          onClick={() => onDelete(card._id)}
          title="Delete card"
          aria-label="Delete card"
        >
          <IconX size={14} />
        </button>
      </div>

      {hasFooter && (
        <div className="k-card-foot">
          <div className="badges">
            {due && (
              <span className={`badge ${due.tone}`}>
                <IconClock size={13} /> {due.label}
              </span>
            )}
            {card.commentCount > 0 && (
              <span className="badge plain">
                <IconMessage size={13} /> {card.commentCount}
              </span>
            )}
          </div>
          <div className="stack">
            {assignees.map((m) => (
              <span
                key={m._id}
                className="avatar xs"
                style={{ background: avatarColor(m.name) }}
                title={m.name}
              >
                {initials(m.name)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}