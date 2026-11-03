import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import { dayKey, dueInfo } from '../utils/dates';

const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

function groupOf(task) {
  if (task.completed) return 'Completed';
  if (!task.dueDate) return 'No due date';
  const key = dayKey(task.dueDate);
  const today = dayKey(new Date());
  if (key < today) return 'Overdue';
  if (key === today) return 'Today';
  const week = new Date();
  week.setDate(week.getDate() + 7);
  return key <= dayKey(week) ? 'Next 7 days' : 'Later';
}

const ORDER = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No due date', 'Completed'];

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('open'); // 'open' | 'done'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ data }) => setTasks(data.myTasks))
      .catch(() => setError('Could not load your tasks. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  const toggleDone = async (task) => {
    const set = (completed) =>
      setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, completed } : t)));
    set(!task.completed);
    try {
      await api.put(`/cards/${task._id}`, { completed: !task.completed });
    } catch {
      set(task.completed);
      setError('Could not update the task.');
    }
  };

  const groups = useMemo(() => {
    const shown = tasks.filter((t) => (view === 'done' ? t.completed : !t.completed));
    return ORDER.map((name) => ({ name, items: shown.filter((t) => groupOf(t) === name) })).filter(
      (g) => g.items.length > 0
    );
  }, [tasks, view]);

  return (
    <>
      <Navbar />
      <main className="container dash-wide">
        <Link to="/" className="back-home">
          <IconArrowLeft size={16} /> Back to boards
        </Link>
        <h1 className="greeting">My tasks</h1>
        <p className="greeting-sub">Cards assigned to you, across all your boards.</p>

        <div className="seg" style={{ margin: '14px 0' }}>
          {[
            { id: 'open', label: 'Open' },
            { id: 'done', label: 'Completed' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              className={`seg-opt${view === o.id ? ' on' : ''}`}
              onClick={() => setView(o.id)}
              aria-pressed={view === o.id}
            >
              {o.label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="muted">Loading...</p>}
        {!loading && groups.length === 0 && (
          <section className="panel">
            <p className="dash-empty">
              {view === 'open'
                ? 'No open tasks. Assign yourself to a card, or add a task from the Boards page.'
                : 'Nothing completed yet.'}
            </p>
          </section>
        )}

        {groups.map((g) => (
          <section key={g.name} className="panel page-group">
            <div className="dash-card-head">
              <h2 className={g.name === 'Overdue' ? 'dash-overdue' : ''}>{g.name}</h2>
              <span>{g.items.length}</span>
            </div>
            <ul className="dash-tasks">
              {g.items.map((task) => {
                const due = dueInfo(task.dueDate);
                return (
                  <li key={task._id} className={`dash-task${task.completed ? ' done' : ''}`}>
                    <button
                      type="button"
                      className={`dash-check${task.completed ? ' on' : ''}`}
                      onClick={() => toggleDone(task)}
                      aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                    >
                      {task.completed && <IconCheck size={14} />}
                    </button>
                    <Link to={`/board/${task.boardId}`} className="dash-task-body">
                      <span className="dash-task-title">{task.title}</span>
                      <small>
                        {task.boardTitle}
                        {task.listTitle ? ` · ${task.listTitle}` : ''}
                      </small>
                    </Link>
                    {task.priority !== 'none' && (
                      <span className={`dash-prio ${task.priority}`} title={`${PRIORITY_LABEL[task.priority]} priority`} />
                    )}
                    {due && <span className={`dash-due ${due.tone}`}>{due.label}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}