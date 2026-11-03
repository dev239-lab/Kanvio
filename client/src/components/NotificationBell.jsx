import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconBell,
  IconBellRinging,
  IconMessage,
  IconArrowsExchange,
  IconUserPlus,
  IconUserCheck,
  IconAt,
} from '@tabler/icons-react';
import useNotifications from '../hooks/useNotifications';
import useClickOutside from '../hooks/useClickOutside';

const TYPES = {
  reminder: { Icon: IconBellRinging, tone: 'amber' },
  comment: { Icon: IconMessage, tone: 'indigo' },
  move: { Icon: IconArrowsExchange, tone: 'green' },
  invite: { Icon: IconUserPlus, tone: 'indigo' },
  assignment: { Icon: IconUserCheck, tone: 'green' },
  mention: { Icon: IconAt, tone: 'indigo' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  const openItem = (n) => {
    markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="icon-btn bell"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <IconBell size={22} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="menu notif-menu">
          <div className="notif-head">
            <b>Notifications</b>
            {unread > 0 && (
              <button className="link-btn" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {items.length === 0 && (
              <div className="notif-empty">
                <IconBell size={28} />
                <p>You are all caught up.</p>
              </div>
            )}

            {items.map((n) => {
              const { Icon, tone } = TYPES[n.type] || TYPES.comment;
              return (
                <button
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' unread'}`}
                  onClick={() => openItem(n)}
                >
                  <span className={`notif-icon ${tone}`}>
                    <Icon size={16} />
                  </span>
                  <span className="notif-text">
                    {n.text}
                    <small>{timeAgo(n.time)}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {items.length > 0 && (
            <div className="notif-foot">
              <button className="link-btn" onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}