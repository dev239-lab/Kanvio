import { useEffect, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import { NotificationsContext } from './notificationsStore';
import { channelEnabled } from '../utils/preferences';

const MAX = 30;

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function Inner({ userId, children }) {
  const socket = useSocket();
  const key = `notifications:${userId}`;
  const [items, setItems] = useState(() => load(key));

  // Save to the browser whenever the list changes
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(items));
  }, [items, key]);

  useEffect(() => {
    if (!socket) return;

    const add = (n) =>
      setItems((prev) => {
        if (prev.some((p) => p.id === n.id)) return prev;
        return [{ read: false, time: Date.now(), ...n }, ...prev].slice(0, MAX);
      });

    const onReminder = (d) => {
      if (!channelEnabled('reminder', 'bell')) return;
      add({
        id: `reminder-${d.reminderId}`,
        type: 'reminder',
        text: d.message,
        link: `/board/${d.boardId}`,
      });
    };

    const onComment = (c) => {
      if (c.author?._id === userId) return; // ignore your own comments
      if (!channelEnabled('comment', 'bell')) return;
      add({
        id: `comment-${c._id}`,
        type: 'comment',
        text: `${c.author?.name || 'Someone'} commented on "${c.cardTitle}"`,
        link: `/board/${c.boardId}`,
      });
    };

    const onMoved = (card) => {
      if (!card.actor || card.actorId === userId) return; // ignore your own moves
      if (!channelEnabled('move', 'bell')) return;
      add({
        id: `move-${card._id}-${Date.now()}`,
        type: 'move',
        text: `${card.actor} moved "${card.title}" to ${card.listTitle}`,
        link: `/board/${card.board}`,
      });
    };

    const onAddedToBoard = (d) => {
      if (!channelEnabled('invite', 'bell')) return;
      add({
        id: `invite-${d.boardId}`,
        type: 'invite',
        text: `${d.by} added you to "${d.title}"`,
        link: `/board/${d.boardId}`,
      });
    };

    const onAssigned = (d) => {
      if (!channelEnabled('assignment', 'bell')) return;
      add({
        id: `assigned-${d.cardId}-${Date.now()}`,
        type: 'assignment',
        text: `${d.by} assigned you to "${d.cardTitle}"`,
        link: `/board/${d.boardId}`,
      });
    };

    const onMentioned = (d) => {
      if (!channelEnabled('mention', 'bell')) return;
      add({
        id: `mention-${d.cardId}-${Date.now()}`,
        type: 'mention',
        text: `${d.by} mentioned you on "${d.cardTitle}"`,
        link: `/board/${d.boardId}`,
      });
    };

    socket.on('reminder', onReminder);
    socket.on('assigned', onAssigned);
    socket.on('mentioned', onMentioned);
    socket.on('commentAdded', onComment);
    socket.on('cardMoved', onMoved);
    socket.on('addedToBoard', onAddedToBoard);
    return () => {
      socket.off('reminder', onReminder);
      socket.off('assigned', onAssigned);
      socket.off('mentioned', onMentioned);
      socket.off('commentAdded', onComment);
      socket.off('cardMoved', onMoved);
      socket.off('addedToBoard', onAddedToBoard);
    };
  }, [socket, userId]);

  const value = {
    items,
    unread: items.filter((n) => !n.read).length,
    markRead: (id) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => setItems((prev) => prev.map((n) => ({ ...n, read: true }))),
    clearAll: () => setItems([]),
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  // The key resets the list when a different user logs in
  return (
    <Inner key={user._id} userId={user._id}>
      {children}
    </Inner>
  );
}