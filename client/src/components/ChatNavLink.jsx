import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconMessages } from '@tabler/icons-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';

// The "Chat" link in the navbar, with a badge for unread direct messages
export default function ChatNavLink() {
  const { user } = useAuth();
  const socket = useSocket();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const active = pathname.startsWith('/chat');

  const load = useCallback(
    () =>
      api
        .get('/chat/unread')
        .then(({ data }) => setUnread(data.count))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  // The chat page tells the navbar when messages were opened
  useEffect(() => {
    window.addEventListener('chatread', load);
    return () => window.removeEventListener('chatread', load);
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m) => {
      if (m.kind === 'direct' && String(m.sender._id) !== String(user._id)) load();
    };
    socket.on('chatMessage', onMessage);
    return () => socket.off('chatMessage', onMessage);
  }, [socket, user._id, load]);

  return (
    <Link
      to="/chat"
      className={`nav-link${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <IconMessages size={18} />
      Chat
      {unread > 0 && <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}