import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPlus, IconX, IconCheck } from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import useAuth from '../hooks/useAuth';
import { dayKey } from '../utils/dates';
import { initials, avatarColor } from '../utils/avatar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;
const COLORS = ['#fcd34d', '#818cf8', '#2dd4bf', '#f472b6', '#60a5fa', '#fb923c'];

const fmtTime = (t) =>
  t ? new Date(`1970-01-01T${t}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

const fmtDate = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

function timeRange(ev) {
  if (!ev.startTime) return 'All day';
  return ev.endTime ? `${fmtTime(ev.startTime)} – ${fmtTime(ev.endTime)}` : fmtTime(ev.startTime);
}

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// Create, view or edit one event
function EventDialog({ event, date, team, userId, onClose, onChanged }) {
  useEscape(onClose);
  const isNew = !event;
  const readOnly = !isNew && String(event.owner._id) !== String(userId);

  const [title, setTitle] = useState(event ? event.title : '');
  const [day, setDay] = useState(event ? event.date : date);
  const [allDay, setAllDay] = useState(event ? !event.startTime : true);
  const [startTime, setStartTime] = useState(event && event.startTime ? event.startTime : '09:00');
  const [endTime, setEndTime] = useState(event && event.endTime ? event.endTime : '10:00');
  const [color, setColor] = useState(event ? event.color : COLORS[0]);
  const [attendees, setAttendees] = useState(event ? event.attendees.map((a) => a._id) : []);
  const [notes, setNotes] = useState(event ? event.notes : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleAttendee = (id) =>
    setAttendees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async (e) => {
    e.preventDefault();
    if (readOnly || saving) return;
    setError('');
    if (!title.trim()) {
      setError('Give the event a reason or title.');
      return;
    }
    setSaving(true);
    const body = {
      title: title.trim(),
      date: day,
      startTime: allDay ? '' : startTime,
      endTime: allDay ? '' : endTime,
      color,
      attendees,
      notes,
    };
    try {
      if (isNew) await api.post('/events', body);
      else await api.put(`/events/${event._id}`, body);
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the event');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving || !window.confirm('Delete this event?')) return;
    setSaving(true);
    try {
      await api.delete(`/events/${event._id}`);
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete the event');
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <form className="panel cal-dialog" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}>
        <div className="cal-dialog-head">
          <h2>{isNew ? 'New event' : readOnly ? 'Event' : 'Edit event'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>

        {readOnly && (
          <p className="muted">
            Invited by <b>{event.owner.name}</b>. Only they can change this event.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Reason or title</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="For example: Meeting with Dev, Dentist, Birthday"
            maxLength={120}
            disabled={readOnly}
          />
        </label>

        <div className="cal-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required disabled={readOnly} />
          </label>
          <label className="cal-check">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} disabled={readOnly} />
            All day
          </label>
        </div>

        {!allDay && (
          <div className="cal-row">
            <label className="field">
              <span>Starts</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required disabled={readOnly} />
            </label>
            <label className="field">
              <span>Ends</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={readOnly} />
            </label>
          </div>
        )}

        <p className="cal-label">Color</p>
        <div className="swatch-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${color === c ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              aria-label={`Color ${c}`}
              disabled={readOnly}
            >
              {color === c && <IconCheck size={16} />}
            </button>
          ))}
        </div>

        <p className="cal-label">Invite teammates</p>
        {readOnly ? (
          <p className="muted">
            {event.attendees.length ? event.attendees.map((a) => a.name).join(', ') : 'Nobody else is invited.'}
          </p>
        ) : team.length === 0 ? (
          <p className="muted">Add people to a board first. Then you can invite them here.</p>
        ) : (
          <div className="cal-people">
            {team.map((p) => (
              <button
                key={p._id}
                type="button"
                className={`cal-person${attendees.includes(p._id) ? ' on' : ''}`}
                onClick={() => toggleAttendee(p._id)}
                aria-pressed={attendees.includes(p._id)}
              >
                <span className="avatar dash-mini" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</span>
                {p.name}
              </button>
            ))}
          </div>
        )}

        <label className="field" style={{ marginTop: 14 }}>
          <span>Notes (optional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} disabled={readOnly} />
        </label>

        <div className="cal-dialog-actions">
          {!isNew && !readOnly && (
            <button type="button" className="pill-btn cal-delete" onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="pill-btn" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button type="submit" className="btn-small" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Everything on one day: events and tasks
function DayDialog({ dateKey, events, tasks, onClose, onAdd, onOpenEvent, onOpenTask }) {
  useEscape(onClose);
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="panel cal-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cal-dialog-head">
          <h2>{fmtDate(dateKey)}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>

        {events.length === 0 && tasks.length === 0 && <p className="muted">Nothing planned for this day.</p>}

        <ul className="cal-daylist">
          {events.map((ev) => (
            <li key={ev._id}>
              <button type="button" onClick={() => onOpenEvent(ev)} style={{ borderLeftColor: ev.color }}>
                <b>{ev.title}</b>
                <small>{timeRange(ev)}</small>
              </button>
            </li>
          ))}
          {tasks.map((t) => (
            <li key={t._id}>
              <button type="button" onClick={() => onOpenTask(t)} className="task">
                <b className={t.completed ? 'struck' : ''}>{t.title}</b>
                <small>Task · {t.boardTitle}</small>
              </button>
            </li>
          ))}
        </ul>

        <div className="cal-dialog-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="btn-small" onClick={onAdd}>
            <IconPlus size={16} /> Add event
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // { event } or { date }
  const [dayView, setDayView] = useState(null); // 'YYYY-MM-DD'

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ data }) => setTasks(data.myTasks.filter((t) => t.dueDate)))
      .catch(() => setError('Could not load your tasks. Is the server running?'));
    api
      .get('/dashboard/team')
      .then(({ data }) => setTeam(data))
      .catch(() => {});
  }, []);

  // Six full weeks starting on Monday, so the grid never changes height
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const from = dayKey(cells[0]);
  const to = dayKey(cells[41]);

  const loadEvents = useCallback(
    () =>
      api
        .get('/events', { params: { from, to } })
        .then(({ data }) => setEvents(data))
        .catch(() => setError('Could not load your events. Is the server running?')),
    [from, to]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = dayKey(t.dueDate);
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [tasks]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      (map[ev.date] = map[ev.date] || []).push(ev);
    });
    return map;
  }, [events]);

  const todayKey = dayKey(new Date());
  const step = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const closeEditor = useCallback(() => setEditor(null), []);
  const closeDay = useCallback(() => setDayView(null), []);

  return (
    <>
      <Navbar />
      <main className="container dash-wide">
        <Link to="/" className="back-home">
          <IconArrowLeft size={16} /> Back to boards
        </Link>
        <h1 className="greeting">Calendar</h1>
        <p className="greeting-sub">
          Your events and task deadlines. Click a day to add an event with a reason.
        </p>

        {error && <p className="form-error">{error}</p>}

        <section className="panel cal">
          <div className="cal-head">
            <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <div className="cal-nav">
              <button type="button" className="btn-small" onClick={() => setEditor({ date: todayKey })}>
                <IconPlus size={16} /> New event
              </button>
              <button type="button" className="pill-btn" onClick={goToday}>Today</button>
              <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous month">
                <IconChevronLeft size={20} />
              </button>
              <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next month">
                <IconChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="cal-scroll">
            <div className="cal-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-dow">{w}</div>
              ))}
              {cells.map((d) => {
                const key = dayKey(d);
                const dayEvents = eventsByDay[key] || [];
                const dayTasks = tasksByDay[key] || [];
                const total = dayEvents.length + dayTasks.length;
                const shown = [
                  ...dayEvents.map((ev) => ({ kind: 'event', item: ev })),
                  ...dayTasks.map((t) => ({ kind: 'task', item: t })),
                ].slice(0, MAX_CHIPS);
                const other = d.getMonth() !== month.getMonth();
                return (
                  <div
                    key={key}
                    className={`cal-cell${other ? ' other' : ''}${key === todayKey ? ' today' : ''}`}
                    onClick={() => setEditor({ date: key })}
                  >
                    <button
                      type="button"
                      className="cal-date"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditor({ date: key });
                      }}
                      aria-label={`Add an event on ${fmtDate(key)}`}
                    >
                      {d.getDate()}
                    </button>

                    {shown.map(({ kind, item }) =>
                      kind === 'event' ? (
                        <button
                          key={item._id}
                          type="button"
                          className="cal-chip event"
                          style={{ borderLeftColor: item.color, background: `${item.color}33` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditor({ event: item });
                          }}
                          title={`${item.title} · ${timeRange(item)}`}
                        >
                          {item.startTime && <em>{fmtTime(item.startTime)}</em>} {item.title}
                        </button>
                      ) : (
                        <button
                          key={item._id}
                          type="button"
                          className={`cal-chip task${item.completed ? ' done' : ''}${item.priority === 'high' ? ' high' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/board/${item.boardId}`);
                          }}
                          title={`Task: ${item.title} · ${item.boardTitle}`}
                        >
                          {item.title}
                        </button>
                      )
                    )}

                    {total > MAX_CHIPS && (
                      <button
                        type="button"
                        className="cal-more"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDayView(key);
                        }}
                      >
                        +{total - MAX_CHIPS} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {editor && (
        <EventDialog
          event={editor.event}
          date={editor.date}
          team={team}
          userId={user._id}
          onClose={closeEditor}
          onChanged={loadEvents}
        />
      )}

      {dayView && !editor && (
        <DayDialog
          dateKey={dayView}
          events={eventsByDay[dayView] || []}
          tasks={tasksByDay[dayView] || []}
          onClose={closeDay}
          onAdd={() => setEditor({ date: dayView })}
          onOpenEvent={(ev) => setEditor({ event: ev })}
          onOpenTask={(t) => navigate(`/board/${t.boardId}`)}
        />
      )}
    </>
  );
}