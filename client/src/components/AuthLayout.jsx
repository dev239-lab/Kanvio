import { IconLayoutKanban, IconBell } from '@tabler/icons-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCurrentWeek() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay()); // back up to Sunday

  return DAY_NAMES.map((name, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return {
      name,
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
    };
  });
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  const week = getCurrentWeek();

  return (
    <div className="auth-bg">
      <div className="auth-shell">
        <section className="auth-left">
          <div className="brand-pill">
            <IconLayoutKanban size={18} /> Kanvio
          </div>

          <div className="auth-body">
            <h1>{title}</h1>
            <p className="auth-sub">{subtitle}</p>
            {children}
          </div>

          <div className="auth-footer">
            <span>{footer}</span>
          </div>
        </section>

        <section className="auth-right">
          <div className="float f-task">
            <strong>Task review with team</strong>
            <div className="small">Due today, 10:00 am</div>
          </div>

          <div className="mini-board">
            <div className="mini-col">
              To do
              <div className="mini-card" />
              <div className="mini-card" />
            </div>
            <div className="mini-col">
              In progress
              <div className="mini-card hl" />
            </div>
            <div className="mini-col">
              Done
              <div className="mini-card" />
              <div className="mini-card" />
              <div className="mini-card" />
            </div>
          </div>

          <div className="avatars">
            <span className="avatar" style={{ background: '#4f46e5' }}>DPS</span>
            <span className="avatar" style={{ background: '#0d9488' }}>VM</span>
            <span className="avatar" style={{ background: '#d97706' }}>RPS</span>
          </div>

          <div className="week">
            {week.map(({ name, date, isToday }) => (
              <div key={name} className={isToday ? 'today' : ''}>
                {name}
                <b>{date}</b>
              </div>
            ))}
          </div>

          <div className="float f-meeting">
            <strong>Daily standup</strong>
            <div className="small">12:00 pm - 01:00 pm</div>
            <div style={{ marginTop: 8, display: 'flex', paddingLeft: 6 }}>
              <span className="avatar sm" style={{ background: '#4f46e5' }}>DPS</span>
              <span className="avatar sm" style={{ background: '#0d9488' }}>VM</span>
              <span className="avatar sm" style={{ background: '#d97706' }}>RPS</span>
            </div>
          </div>

          <div className="float f-live">
            <span className="dot" />
            Live: Dev moved a card
          </div>

          <div className="float f-remind">
            <IconBell size={16} /> Reminder set for 3:00 pm
          </div>
        </section>
      </div>
    </div>
  );
}