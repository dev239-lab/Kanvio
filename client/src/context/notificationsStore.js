import { createContext } from 'react';

export const NotificationsContext = createContext({
  items: [],
  unread: 0,
  markRead: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});