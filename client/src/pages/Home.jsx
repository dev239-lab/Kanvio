import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconPlus,
  IconLayoutBoard,
  IconChecklist,
  IconBellRinging,
  IconCircleCheck,
  IconBolt,
  IconCheck,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import useWorkspace from '../hooks/useWorkspace';
import Navbar from '../components/Navbar';
import { initials, avatarColor } from '../utils/avatar';
import { newCardPosition } from '../utils/preferences';

const STRIPS = ['#fcd34d', '#4f46e5', '#0d9488', '#db2777', '#2563eb', '#d97706'];

const TEMPLATES = [
  { id: 'plan', name: 'Project plan', lists: ['Backlog', 'In progress', 'Review', 'Done'] },
  { id: 'sprint', name: 'Weekly sprint', lists: ['To do', 'Doing', 'Blocked', 'Done'] },
  { id: 'todo', name: 'Personal to-do', lists: ['Today', 'This week', 'Later', 'Done'] },
  { id: 'bugs', name: 'Bug tracker', lists: ['Reported', 'Investigating', 'Fixing', 'Fixed'] },
];

// A new blank board starts with these lists, so quick add works on it right away
const DEFAULT_LISTS = ['To do', 'Doing', 'Done'];

const PRIORITY_LABEL = { none: 'No priority', low: 'Low', medium: 'Medium', high: 'High' };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Local calendar day as YYYY-MM-DD, so "today" follows the user's clock
const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

function dueInfo(dueDate) {
  if (!dueDate) return null;
  const todayKey = dayKey(new Date());
  const key = dayKey(dueDate);
  if (key < todayKey) return { label: 'Overdue', tone: 'late' };
  if (key === todayKey) return { label: 'Today', tone: 'today' };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dayKey(tomorrow)) return { label: 'Tomorrow', tone: 'soon' };
  const label = new Date(dueDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return { label, tone: 'later' };
}

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

export default function Home() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { active, loading: wsLoading } = useWorkspace();
  const workspaceId = active?._id;

  const [boards, setBoards] = useState([]);
  const [reminderCount, setReminderCount] = useState(0);
  const [dash, setDash] = useState({ myTasks: [], activity: [], doneThisWeek: 0 });
  const [ticked, setTicked] = useState(() => new Set()); // tasks ticked during this visit
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [qaTitle, setQaTitle] = useState('');
  const [qaBoard, setQaBoard] = useState('');
  const [qaPriority, setQaPriority] = useState('none');
  const [qaMsg, setQaMsg] = useState({ type: '', text: '' });
  const [qaBusy, setQaBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [building, setBuilding] = useState(false);

  // Responsive initial limits; each section expands independently.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)').matches : false
  );
  const [expandedSections, setExpandedSections] = useState({
    boards: false,
    tasks: false,
    activity: false,
  });

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderSeeMore = (section, total, limit) => {
    if (total <= limit) return null;
    const expanded = expandedSections[section];
    return (
      <div className="dash-see-more-wrap">
        <button
          type="button"
          className="pill-btn dash-see-more"
          onClick={() => toggleSection(section)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `See more (${total - limit})`}
        </button>
      </div>
    );
  };

  const boardLimit = isMobile ? 3 : 6;
  const taskLimit = isMobile ? 3 : 5;
  const activityLimit = isMobile ? 3 : 5;

  const loadBoards = useCallback(
    () =>
      api
        .get('/boards', { params: workspaceId ? { workspace: workspaceId } : {} })
        .then(({ data }) => setBoards(data))
        .catch(() => {}),
    [workspaceId]
  );

  const loadDash = useCallback(
    () =>
      api
        .get('/dashboard')
        .then(({ data }) => setDash(data))
        .catch(() => setError('Some dashboard details could not be loaded.')),
    []
  );

  useEffect(() => {
    if (wsLoading) return; // wait until we know which workspace you are in
    Promise.all([
      api
        .get('/boards', { params: workspaceId ? { workspace: workspaceId } : {} })
        .then(({ data }) => setBoards(data)),
      api.get('/reminders').then(({ data }) => setReminderCount(data.length)).catch(() => {}),
      loadDash(),
    ])
      .catch(() => setError('Could not load your boards. Is the server running?'))
      .finally(() => setLoading(false));
  }, [loadDash, wsLoading, workspaceId]);

  // Live: someone added me to a board, so reload the list without a refresh
  useEffect(() => {
    if (!socket) return;
    const onAdded = () => {
      loadBoards();
      loadDash();
    };
    socket.on('addedToBoard', onAdded);
    socket.on('workspaceChanged', onAdded);
    return () => {
      socket.off('addedToBoard', onAdded);
      socket.off('workspaceChanged', onAdded);
    };
  }, [socket, loadBoards, loadDash]);

  // ---------- Boards ----------
  const sortedBoards = useMemo(
    () => [...boards].sort((a, b) => Number(!!b.starred) - Number(!!a.starred)),
    [boards]
  );

  const toggleStar = async (e, board) => {
    e.preventDefault(); // the tile is a link, so do not open the board
    e.stopPropagation();
    const set = (starred) =>
      setBoards((prev) => prev.map((b) => (b._id === board._id ? { ...b, starred } : b)));
    set(!board.starred);
    try {
      await api.put(`/dashboard/star/${board._id}`);
    } catch {
      set(!!board.starred);
      setError('Could not update the star.');
    }
  };

  // Creates a board, then its lists one by one so they keep their order
  const buildBoard = async (title, lists = []) => {
    const { data: board } = await api.post('/boards', { title, workspaceId });
    for (const listTitle of lists) {
      await api.post(`/boards/${board._id}/lists`, { title: listTitle });
    }
    return board;
  };

  const createBlank = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || building) return;
    setBuilding(true);
    try {
      await buildBoard(newTitle.trim(), DEFAULT_LISTS);
      setNewTitle('');
      setCreating(false);
      await loadBoards();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create board');
    } finally {
      setBuilding(false);
    }
  };

  const startTemplate = async (tpl) => {
    if (building) return;
    setBuilding(true);
    try {
      const board = await buildBoard(tpl.name, tpl.lists);
      navigate(`/board/${board._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the board from the template');
      setBuilding(false);
    }
  };

  // ---------- Quick add ----------
  const quickBoardId = qaBoard || boards[0]?._id || '';

  const quickAdd = async (e) => {
    e.preventDefault();
    const title = qaTitle.trim();
    if (!title || qaBusy) return;
    const board = boards.find((b) => b._id === quickBoardId);
    if (!board) return;
    if (!board.firstListId) {
      setQaMsg({ type: 'error', text: `"${board.title}" has no lists yet. Open it and add a list first.` });
      return;
    }
    setQaBusy(true);
    setQaMsg({ type: '', text: '' });
    try {
      await api.post('/cards', {
        title,
        listId: board.firstListId,
        priority: qaPriority,
        assignToMe: true,
        atTop: newCardPosition() === 'top',
      });
      setQaTitle('');
      setQaMsg({ type: 'ok', text: `Added to ${board.title}.` });
      await Promise.all([loadBoards(), loadDash()]);
    } catch (err) {
      setQaMsg({ type: 'error', text: err.response?.data?.message || 'Could not add the task' });
    } finally {
      setQaBusy(false);
    }
  };

  // ---------- Tasks ----------
  const visibleTasks = useMemo(
    () => dash.myTasks.filter((t) => !t.completed || ticked.has(t._id)),
    [dash.myTasks, ticked]
  );
  const openCount = dash.myTasks.filter((t) => !t.completed).length;
  const focus = visibleTasks.slice(0, 3);
  const focusDone = focus.filter((t) => t.completed).length;

  const toggleDone = async (task) => {
    const next = !task.completed;
    const apply = (completed) => {
      setDash((d) => ({
        ...d,
        myTasks: d.myTasks.map((t) => (t._id === task._id ? { ...t, completed } : t)),
        doneThisWeek: Math.max(0, d.doneThisWeek + (completed ? 1 : -1)),
      }));
    };
    setTicked((prev) => new Set(prev).add(task._id));
    apply(next);
    try {
      await api.put(`/cards/${task._id}`, { completed: next });
    } catch {
      apply(task.completed);
      setError('Could not update the task.');
    }
  };

  // ---------- Week strip ----------
  const week = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({ key: dayKey(d), weekday: d.toLocaleDateString(undefined, { weekday: 'short' }), date: d.getDate(), today: i === 0 });
    }
    const open = dash.myTasks.filter((t) => !t.completed && t.dueDate);
    return days.map((d) => ({ ...d, count: open.filter((t) => dayKey(t.dueDate) === d.key).length }));
  }, [dash.myTasks]);

  const overdueCount = dash.myTasks.filter(
    (t) => !t.completed && t.dueDate && dayKey(t.dueDate) < dayKey(new Date())
  ).length;

  const renderTask = (task) => {
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
            {task.listTitle ? ` Â· ${task.listTitle}` : ''}
          </small>
        </Link>
        {task.priority !== 'none' && (
          <span className={`dash-prio ${task.priority}`} title={`${PRIORITY_LABEL[task.priority]} priority`} />
        )}
        {due && <span className={`dash-due ${due.tone}`}>{due.label}</span>}
      </li>
    );
  };

  return (
    <>
      <Navbar />
      <main className="container dash-wide">
        <h1 className="greeting">
          {greeting()}, {user.name.split(' ')[0]}
        </h1>
        <p className="greeting-sub">Here is what is happening across your boards.</p>

        {error && <p className="form-error">{error}</p>}

        <div className="dash-stats">
          <div className="dash-stat"><IconLayoutBoard size={18} /><b>{boards.length}</b> Boards</div>
          <div className="dash-stat"><IconChecklist size={18} /><b>{openCount}</b> Open tasks</div>
          <div className="dash-stat"><IconCircleCheck size={18} /><b>{dash.doneThisWeek}</b> Done this week</div>
          <div className="dash-stat"><IconBellRinging size={18} /><b>{reminderCount}</b> Reminders</div>
        </div>

        {/* Quick add */}
        <form className="dash-quick panel" onSubmit={quickAdd}>
          <input
            className="dash-quick-input"
            placeholder="Add a task and press Enter..."
            value={qaTitle}
            onChange={(e) => {
              setQaTitle(e.target.value);
              if (qaMsg.text) setQaMsg({ type: '', text: '' });
            }}
            disabled={boards.length === 0}
          />
          <select
            aria-label="Board"
            value={quickBoardId}
            onChange={(e) => setQaBoard(e.target.value)}
            disabled={boards.length === 0}
          >
            {boards.map((b) => (
              <option key={b._id} value={b._id}>{b.title}</option>
            ))}
          </select>
          <select aria-label="Priority" value={qaPriority} onChange={(e) => setQaPriority(e.target.value)}>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="btn-small" disabled={qaBusy || !qaTitle.trim() || boards.length === 0}>
            <IconPlus size={16} /> {qaBusy ? 'Adding...' : 'Add'}
          </button>
          {qaMsg.text && (
            <p className={`dash-quick-msg ${qaMsg.type === 'ok' ? 'form-ok' : 'form-error'}`}>{qaMsg.text}</p>
          )}
        </form>

        {/* Focus and week */}
        <div className="dash-grid2">
          <section className="dash-focus">
            <div className="dash-card-head">
              <h2><IconBolt size={18} /> Today&apos;s focus</h2>
              {focus.length > 0 && <span>{focusDone} of {focus.length} done</span>}
            </div>
            {focus.length === 0 ? (
              <p className="dash-empty">Nothing assigned to you yet. Add a task above and it will show up here.</p>
            ) : (
              <>
                <div className="dash-progress"><span style={{ width: `${(focusDone / focus.length) * 100}%` }} /></div>
                <ul className="dash-tasks">{focus.map(renderTask)}</ul>
              </>
            )}
          </section>

          <section className="panel dash-card">
            <div className="dash-card-head">
              <h2>This week</h2>
              {overdueCount > 0 && <span className="dash-overdue">{overdueCount} overdue</span>}
            </div>
            <div className="dash-week">
              {week.map((d) => (
                <div key={d.key} className={`dash-day${d.today ? ' today' : ''}`}>
                  <small>{d.weekday}</small>
                  <b>{d.date}</b>
                  <span className={d.count ? 'has' : ''}>{d.count} due</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Boards */}
        <div className="section-head">
          <h2>{active ? `Boards in ${active.name}` : 'Your boards'}</h2>
          {active && <Link to={`/workspace/${active._id}`} className="pill-btn" style={{ textDecoration: 'none' }}>Manage workspace</Link>}
        </div>

        {loading ? (
          <div className="board-grid">
            {[1, 2, 3].map((n) => <div key={n} className="board-card skeleton" />)}
          </div>
        ) : (
          <div className="board-grid">
            {(expandedSections.boards ? sortedBoards : sortedBoards.slice(0, boardLimit)).map((b, i) => {
              const pct = b.cardCount ? Math.round(((b.doneCount || 0) / b.cardCount) * 100) : 0;
              const people = b.memberList || [];
              return (
                <Link key={b._id} to={`/board/${b._id}`} className="board-card dash-board">
                  <div className="strip" style={{ background: STRIPS[i % STRIPS.length] }} />
                  <div className="board-card-body">
                    <div className="dash-board-top">
                      <div className="board-card-title">{b.title}</div>
                      <button
                        type="button"
                        className={`dash-star${b.starred ? ' on' : ''}`}
                        onClick={(e) => toggleStar(e, b)}
                        aria-label={b.starred ? `Unstar ${b.title}` : `Star ${b.title}`}
                        aria-pressed={!!b.starred}
                      >
                        {b.starred ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                      </button>
                    </div>
                    <div className="board-card-meta">
                      {b.listCount} {b.listCount === 1 ? 'list' : 'lists'} Â· {b.cardCount}{' '}
                      {b.cardCount === 1 ? 'card' : 'cards'}
                    </div>
                    <div className="dash-progress small" title={`${pct}% of cards completed`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <div className="dash-board-foot">
                      <span className="dash-avatars">
                        {people.slice(0, 4).map((m) => (
                          <span key={m._id} className="avatar dash-mini" style={{ background: avatarColor(m.name) }} title={m.name}>
                            {initials(m.name)}
                          </span>
                        ))}
                        {people.length > 4 && <span className="avatar dash-mini more">+{people.length - 4}</span>}
                      </span>
                      <small>{b.lastActivity ? timeAgo(b.lastActivity) : ''}</small>
                    </div>
                  </div>
                </Link>
              );
            })}

            {creating ? (
              <form className="board-card dash-new-form" onSubmit={createBlank}>
                <input
                  autoFocus
                  placeholder="Board name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                />
                <div>
                  <button type="submit" className="btn-small" disabled={building || !newTitle.trim()}>
                    {building ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" className="pill-btn" onClick={() => setCreating(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" className="board-card dash-new" onClick={() => setCreating(true)}>
                <IconPlus size={22} />
                Create a board
              </button>
            )}
          </div>
        )}
        {!loading && renderSeeMore('boards', sortedBoards.length, boardLimit)}

        {/* Tasks and activity */}
        <div className="dash-grid2">
          <section className="panel dash-card">
            <div className="dash-card-head"><h2>My tasks</h2><span>{openCount} open</span></div>
            {visibleTasks.length === 0 ? (
              <p className="dash-empty">No open tasks. Cards assigned to you appear here, earliest due date first.</p>
            ) : (
              <ul className="dash-tasks">
                {(expandedSections.tasks ? visibleTasks : visibleTasks.slice(0, taskLimit)).map(renderTask)}
              </ul>
            )}
            {renderSeeMore('tasks', visibleTasks.length, taskLimit)}
          </section>

          <section className="panel dash-card">
            <div className="dash-card-head"><h2>Recent activity</h2></div>
            {dash.activity.length === 0 ? (
              <p className="dash-empty">Activity from your boards will show up here.</p>
            ) : (
              <ul className="dash-activity">
                {(expandedSections.activity ? dash.activity : dash.activity.slice(0, activityLimit)).map((a) => (
                  <li key={a._id}>
                    <span className="avatar dash-mini" style={{ background: avatarColor(a.actorName) }}>
                      {initials(a.actorName)}
                    </span>
                    <div>
                      <p>
                        <b>{a.actorName}</b> {a.text}
                      </p>
                      <small>
                        <Link to={`/board/${a.boardId}`}>{a.boardTitle}</Link> Â· {timeAgo(a.createdAt)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {renderSeeMore('activity', dash.activity.length, activityLimit)}
          </section>
        </div>

        {/* Templates */}
        <div className="section-head"><h2>Start from a template</h2></div>
        <div className="dash-templates">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} type="button" className="panel dash-template" onClick={() => startTemplate(tpl)} disabled={building}>
              <b>{tpl.name}</b>
              <small>{tpl.lists.join(' â†’ ')}</small>
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
