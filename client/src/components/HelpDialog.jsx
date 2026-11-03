import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconX, IconCircleCheck, IconCircle, IconLayoutKanban } from '@tabler/icons-react';
import api from '../services/api';

const SHORTCUTS = [
  { keys: 'Ctrl K', text: 'Search boards and cards' },
  { keys: 'Up / Down', text: 'Move through search results' },
  { keys: 'Enter', text: 'Open the selected search result' },
  { keys: 'Esc', text: 'Close a popup or the card panel' },
  { keys: 'Enter', text: 'Save a card title, or send a comment' },
  { keys: 'Drag', text: 'Move a card between lists' },
];

const BUILT_WITH = ['React', 'Node.js', 'MongoDB', 'Socket.io'];

const WHATS_NEW = [
  'Invite teammates to a board by email',
  'Notification bell, popup toasts and reminders',
  'Dark mode, themes and a full settings page',
];

const TITLES = {
  shortcuts: 'Keyboard shortcuts',
  tips: 'Getting started',
  about: 'About Kanvio',
};

function Shortcuts() {
  return (
    <ul className="help-list" style={{ marginTop: 12 }}>
      {SHORTCUTS.map((s) => (
        <li key={s.text} className="help-row">
          <span>{s.text}</span>
          <span className="kbd">{s.keys}</span>
        </li>
      ))}
    </ul>
  );
}

function Tips({ onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // null = loading

  // Work out which steps are already done from the user's real data
  useEffect(() => {
    Promise.all([api.get('/boards'), api.get('/reminders')])
      .then(([b, r]) => setData({ boards: b.data, reminders: r.data }))
      .catch(() => setData({ boards: [], reminders: [] }));
  }, []);

  if (!data) return <p className="muted" style={{ margin: '16px 0 0' }}>Loading...</p>;

  const firstBoard = data.boards[0];
  const go = (path) => {
    onClose();
    navigate(path);
  };

  const steps = [
    {
      title: 'Create your first board',
      tip: 'Use the New board button at the top.',
      done: data.boards.length > 0,
      go: () => go('/'),
    },
    {
      title: 'Add a card to a list',
      tip: 'Type a title in the box at the bottom of any list.',
      done: data.boards.some((b) => (b.cardCount || 0) > 0),
      go: () => go(firstBoard ? `/board/${firstBoard._id}` : '/'),
    },
    {
      title: 'Invite a teammate',
      tip: 'Open a board and press Invite. They need a Kanvio account.',
      done: data.boards.some((b) => (b.members || []).length > 1),
      go: () => go(firstBoard ? `/board/${firstBoard._id}` : '/'),
    },
    {
      title: 'Set a card reminder',
      tip: 'Open a card and choose a date and time under Reminder.',
      done: data.reminders.length > 0,
      go: () => go(firstBoard ? `/board/${firstBoard._id}` : '/'),
    },
    {
      title: 'Choose your theme',
      tip: 'Pick Light, Dark or System in Settings.',
      done: localStorage.getItem('theme') !== null,
      go: () => go('/settings?tab=preferences'),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="help-progress-head">
        <span>Your progress</span>
        <span className="muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <div className="help-progress">
        <div className="help-progress-bar" style={{ width: `${percent}%` }} />
      </div>

      {steps.map((s) => (
        <div key={s.title} className={`help-step${s.done ? ' done' : ''}`}>
          {s.done ? (
            <IconCircleCheck size={20} className="help-step-icon ok" />
          ) : (
            <IconCircle size={20} className="help-step-icon" />
          )}
          <div className="help-step-text">
            <b>{s.title}</b>
            <small>{s.tip}</small>
          </div>
          {!s.done && (
            <button type="button" className="help-go" onClick={s.go}>
              Go
            </button>
          )}
        </div>
      ))}

      {doneCount === steps.length && (
        <p className="form-ok" style={{ margin: '12px 0 0' }}>
          All done. You are ready to go.
        </p>
      )}
    </div>
  );
}

function About() {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="about-head">
        <span className="about-logo">
          <IconLayoutKanban size={26} />
        </span>
        <div>
          <b>Kanvio</b>
          <small>Version 1.0</small>
        </div>
      </div>

      <p className="about-text">
        A real-time Kanban board for small teams. Plan work, assign cards, set reminders and see
        your teammates' changes the moment they happen.
      </p>

      <div className="help-label">Built with</div>
      <div className="chip-row">
        {BUILT_WITH.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>

      <div className="help-label">What's new</div>
      <ul className="about-list">
        {WHATS_NEW.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function HelpDialog({ kind, onClose }) {
  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog help-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>{TITLES[kind]}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>

        {kind === 'shortcuts' && <Shortcuts />}
        {kind === 'tips' && <Tips onClose={onClose} />}
        {kind === 'about' && <About />}
      </div>
    </div>
  );
}