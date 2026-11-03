import { useContext } from 'react';
import { NotificationsContext } from '../context/notificationsStore';

export default function useNotifications() {
  return useContext(NotificationsContext);
}