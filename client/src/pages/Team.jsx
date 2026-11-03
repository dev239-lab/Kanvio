import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconMail, IconX } from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import { initials, avatarColor } from '../utils/avatar';

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(date).toLocaleDateString();
}

function StatusChip({ online }) {
  return (
    <span className={`team-status ${online ? 'online' : 'offline'}`}>
      <i /> {online ? 'Online' : 'Offline'}
    </span>
  );
}

function PersonDialog({ person, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = [
    ['Username', person.name],
    ['Email', person.email],
    ['Member since', person.joinedAt ? new Date(person.joinedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'],
    ['Last active', person.online ? 'Right now' : person.lastActive ? timeAgo(person.lastActive) : 'No activity on shared boards yet'],
    ['Open tasks', `${person.openTasks} on shared boards`],
    ['Completed tasks', `${person.doneTasks} on shared boards`],
  ];

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="panel team-dialog" role="dialog" aria-label={`${person.name}'s info`} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn team-dialog-close" onClick={onClose} aria-label="Close">
          <IconX size={20} />
        </button>

        <div className="team-dialog-head">
          <span className="avatar nav-avatar" style={{ background: avatarColor(person.name), width: 64, height: 64, fontSize: 22 }}>
            {initials(person.name)}
          </span>
          <div>
            <h2>{person.name}</h2>
            <StatusChip online={person.online} />
          </div>
        </div>

        <dl className="team-info">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <p className="team-info-label">Shared boards ({person.boards.length})</p>
        <div className="team-boards">
          {person.boards.map((b) => (
            <Link key={b._id} to={`/board/${b._id}`} className="pill-btn">
              {b.title}
            </Link>
          ))}
        </div>

        <a className="btn-small team-mail" href={`mailto:${person.email}`}>
          <IconMail size={16} /> Send an email
        </a>
      </div>
    </div>
  );
}

export default function Team() {
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      api
        .get('/dashboard/team')
        .then(({ data }) => {
          setPeople(data);
          setError('');
        })
        .catch(() => setError('Could not load your team. Is the server running?')),
    []
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
    // Refresh now and then so the Online / Offline status stays current
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const selected = people.find((p) => p._id === selectedId);
  const closeDialog = useCallback(() => setSelectedId(null), []);

  return (
    <>
      <Navbar />
      <main className="container dash-wide">
        <Link to="/" className="back-home">
          <IconArrowLeft size={16} /> Back to boards
        </Link>
        <h1 className="greeting">Team</h1>
        <p className="greeting-sub">People you share boards with. Click a person to see their info.</p>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="muted">Loading...</p>}

        {!loading && !error && people.length === 0 && (
          <section className="panel">
            <p className="dash-empty">
              No teammates yet. Open a board and add people by email, and they will show up here.
            </p>
          </section>
        )}

        <div className="team-grid">
          {people.map((p) => (
            <button key={p._id} type="button" className="panel team-card" onClick={() => setSelectedId(p._id)}>
              <div className="team-top">
                <span className="avatar nav-avatar" style={{ background: avatarColor(p.name), width: 44, height: 44 }}>
                  {initials(p.name)}
                </span>
                <div>
                  <b>{p.name}</b>
                  <small>{p.email}</small>
                </div>
              </div>
              <div className="team-card-foot">
                <StatusChip online={p.online} />
                <small>
                  {p.boards.length} shared {p.boards.length === 1 ? 'board' : 'boards'}
                </small>
              </div>
            </button>
          ))}
        </div>
      </main>

      {selected && <PersonDialog person={selected} onClose={closeDialog} />}
    </>
  );
}