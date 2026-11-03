import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClock, IconX } from '@tabler/icons-react';
import useSocket from '../hooks/useSocket';
import useAuth from '../hooks/useAuth';
import { toastsEnabled, channelEnabled } from '../utils/preferences';
import { initials, avatarColor } from '../utils/avatar';

const REMINDER_MS = 15000;
const ACTIVITY_MS = 6000;

export default function Notification() {
  const socket = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const push = (toast) => {
      if (!toastsEnabled()) return; // master switch: the bell still records it
      if (!channelEnabled(toast.type, 'toast')) return; // turned off in Settings
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration);
    };

    const onReminder = (data) =>
      push({
        id: `r-${data.reminderId}`,
        kind: 'reminder',
        type: 'reminder',
        title: 'Reminder',
        text: data.message,
        boardId: data.boardId,
        duration: REMINDER_MS,
      });

    const onCardMoved = (data) => {
      if (!data.actor || String(data.actorId) === String(user?._id)) return;
      push({
        id: `m-${Date.now()}-${Math.random()}`,
        kind: 'activity',
        type: 'move',
        actor: data.actor,
        title: `${data.actor} moved a card`,
        text: `${data.title} to ${data.listTitle}`,
        boardId: data.board,
        duration: ACTIVITY_MS,
      });
    };

    const onCommentAdded = (data) => {
      const author = data.author;
      if (!author || String(author._id) === String(user?._id)) return;
      push({
        id: `c-${data._id}`,
        kind: 'activity',
        type: 'comment',
        actor: author.name,
        title: `${author.name} commented`,
        text: data.cardTitle ? `On ${data.cardTitle}` : data.text,
        boardId: data.boardId,
        duration: ACTIVITY_MS,
      });
    };

    const onAddedToBoard = (data) =>
      push({
        id: `a-${data.boardId}-${Date.now()}`,
        kind: 'activity',
        type: 'invite',
        actor: data.by,
        title: `${data.by} added you to a board`,
        text: data.title,
        boardId: data.boardId,
        duration: REMINDER_MS,
      });

    const onAssigned = (data) =>
      push({
        id: `s-${data.cardId}-${Date.now()}`,
        kind: 'activity',
        type: 'assignment',
        actor: data.by,
        title: `${data.by} assigned you a card`,
        text: data.cardTitle,
        boardId: data.boardId,
        duration: REMINDER_MS,
      });

    const onMentioned = (data) =>
      push({
        id: `n-${data.cardId}-${Date.now()}`,
        kind: 'activity',
        type: 'mention',
        actor: data.by,
        title: `${data.by} mentioned you`,
        text: data.cardTitle,
        boardId: data.boardId,
        duration: REMINDER_MS,
      });

    socket.on('reminder', onReminder);
    socket.on('assigned', onAssigned);
    socket.on('mentioned', onMentioned);
    socket.on('cardMoved', onCardMoved);
    socket.on('commentAdded', onCommentAdded);
    socket.on('addedToBoard', onAddedToBoard);
    return () => {
      socket.off('reminder', onReminder);
      socket.off('assigned', onAssigned);
      socket.off('mentioned', onMentioned);
      socket.off('cardMoved', onCardMoved);
      socket.off('commentAdded', onCommentAdded);
      socket.off('addedToBoard', onAddedToBoard);
    };
  }, [socket, user?._id]);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const open = (t) => {
    if (t.boardId) navigate(`/board/${t.boardId}`);
    dismiss(t.id);
  };

  return (
    <div className="tt-stack">
      {toasts.map((t) => (
        <div key={t.id} className="tt">
          <div className="tt-row">
            {t.kind === 'reminder' ? (
              <span className="tt-icon tt-amber">
                <IconClock size={18} />
              </span>
            ) : (
              <span className="avatar xs" style={{ background: avatarColor(t.actor) }}>
                {initials(t.actor)}
              </span>
            )}
            <div className="tt-body">
              <div className="tt-title">{t.title}</div>
              <div className="tt-text">{t.text}</div>
              {t.boardId && (
                <button className="tt-link" onClick={() => open(t)}>
                  View board
                </button>
              )}
            </div>
            <button className="tt-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <IconX size={16} />
            </button>
          </div>
          <div className="tt-bar">
            <div className="tt-bar-fill" style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}