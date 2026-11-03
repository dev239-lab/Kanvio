import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconChevronLeft, IconLayoutBoard, IconMessages, IconSend } from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Avatar from '../components/Avatar';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import { effectiveStatus } from '../utils/status';

const GROUP_GAP_MS = 5 * 60 * 1000;

const timeOf = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayOf = (d) =>
  new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function shortAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function Chat() {
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { kind, id } = useParams();
  const myId = String(user._id);

  const active = useMemo(
  () => ((kind === 'board' || kind === 'user') && id ? { kind, id } : null),
  [kind, id]
);
  const activeKey = active ? `${active.kind}:${active.id}` : '';

  const [convs, setConvs] = useState({ boards: [], people: [] });
  const [convsLoaded, setConvsLoaded] = useState(false);
  const [loaded, setLoaded] = useState({ key: '', list: [], hasMore: false }); // messages of one conversation
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const messages = loaded.key === activeKey ? loaded.list : [];
  const loadingMessages = !!active && loaded.key !== activeKey;

  const people = convs.people;
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [String(p._id), p])), [people]);
  const activeBoard = active?.kind === 'board' ? convs.boards.find((b) => b._id === active.id) : null;
  const activePerson = active?.kind === 'user' ? peopleById[active.id] : null;

  // ----- conversation list -----
  useEffect(() => {
    api
      .get('/chat/conversations')
      .then(({ data }) => setConvs(data))
      .catch(() => setError('Could not load your conversations. Is the server running?'))
      .finally(() => setConvsLoaded(true));
  }, []);

  // ----- messages of the open conversation -----
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const url = active.kind === 'board' ? `/chat/board/${active.id}/messages` : `/chat/direct/${active.id}/messages`;

    api
      .get(url)
      .then(({ data }) => {
        if (cancelled) return;
        setLoaded({ key: `${active.kind}:${active.id}`, list: data.messages, hasMore: data.hasMore });
        setError('');
        if (active.kind === 'user') {
          // Opening a person's chat reads their messages
          setConvs((prev) => ({
            ...prev,
            people: prev.people.map((p) => (String(p._id) === active.id ? { ...p, unread: 0 } : p)),
          }));
          window.dispatchEvent(new Event('chatread'));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load the messages');
      });

    return () => {
      cancelled = true;
    };
    }, [active]);

  // ----- live messages -----
  useEffect(() => {
    if (!socket) return;

    const onMessage = (m) => {
      const fromMe = String(m.sender._id) === myId;
      const otherId = fromMe ? String(m.recipient) : String(m.sender._id);
      const key = m.kind === 'board' ? `board:${m.board}` : `user:${otherId}`;
      const isOpen = key === activeKey;

      setLoaded((prev) =>
        prev.key === key && !prev.list.some((x) => x._id === m._id) ? { ...prev, list: [...prev.list, m] } : prev
      );

      const last = {
        text: m.text.length > 80 ? `${m.text.slice(0, 80)}...` : m.text,
        createdAt: m.createdAt,
        senderId: m.sender._id,
        senderName: m.sender.name,
      };
      setConvs((prev) =>
        m.kind === 'board'
          ? { ...prev, boards: prev.boards.map((b) => (b._id === String(m.board) ? { ...b, last } : b)) }
          : {
              ...prev,
              people: prev.people.map((p) =>
                String(p._id) === otherId
                  ? { ...p, last, unread: fromMe || isOpen ? p.unread : (p.unread || 0) + 1 }
                  : p
              ),
            }
      );

      // A message arrived in the chat you are looking at, so it counts as read
      if (m.kind === 'direct' && !fromMe && isOpen) {
        api
          .put(`/chat/direct/${otherId}/read`)
          .then(() => window.dispatchEvent(new Event('chatread')))
          .catch(() => {});
      }
    };

    socket.on('chatMessage', onMessage);
    return () => socket.off('chatMessage', onMessage);
  }, [socket, activeKey, myId]);

  // Scroll to the newest message when it changes (not when older ones are added above)
  const lastId = messages[messages.length - 1]?._id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId, activeKey]);

  const open = (nextKind, nextId) => navigate(`/chat/${nextKind}/${nextId}`);

  const send = async (e) => {
    if (e) e.preventDefault();
    const body = text.trim();
    if (!body || sending || !active) return;
    setSending(true);
    setError('');
    try {
      const url = active.kind === 'board' ? `/chat/board/${active.id}` : `/chat/direct/${active.id}`;
      const { data } = await api.post(url, { text: body });
      setText('');
      // The live event may arrive too, so skip it if the message is already there
      setLoaded((prev) =>
        prev.key === activeKey && !prev.list.some((x) => x._id === data._id)
          ? { ...prev, list: [...prev.list, data] }
          : prev
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the message');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter adds a new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const loadOlder = useCallback(async () => {
    if (!active || loadingOlder || !loaded.list.length) return;
    setLoadingOlder(true);
    try {
      const url = active.kind === 'board' ? `/chat/board/${active.id}/messages` : `/chat/direct/${active.id}/messages`;
      const { data } = await api.get(url, { params: { before: loaded.list[0].createdAt } });
      setLoaded((prev) =>
        prev.key === activeKey ? { ...prev, list: [...data.messages, ...prev.list], hasMore: data.hasMore } : prev
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load earlier messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [active, activeKey, loaded.list, loadingOlder]);

  const senderUser = (m) => {
    const sid = String(m.sender._id);
    if (sid === myId) return user;
    return peopleById[sid] || { name: m.sender.name };
  };

  const peopleStatus = (p) => effectiveStatus(p);

  return (
    <>
      <Navbar />
      <main className="container dash-wide chat-page">
        <Link to="/" className="back-home">
          <IconArrowLeft size={16} /> Back to boards
        </Link>

        <div className={`chat-layout${active ? ' has-active' : ''}`}>
          {/* ----- left: boards and people ----- */}
          <aside className="chat-side panel">
            <h2 className="chat-side-title">Chat</h2>

            {!convsLoaded && <p className="muted">Loading...</p>}

            <p className="chat-section">Boards</p>
            {convsLoaded && convs.boards.length === 0 && <p className="chat-empty">No boards yet.</p>}
            {convs.boards.map((b) => (
              <button
                key={b._id}
                type="button"
                className={`chat-item${activeKey === `board:${b._id}` ? ' on' : ''}`}
                onClick={() => open('board', b._id)}
              >
                <span className="chat-board-icon">
                  <IconLayoutBoard size={18} />
                </span>
                <span className="chat-item-text">
                  <b>{b.title}</b>
                  <small>
                    {b.last ? `${b.last.senderId === myId ? 'You' : b.last.senderName.split(' ')[0]}: ${b.last.text}` : `${b.memberCount} members`}
                  </small>
                </span>
                {b.last && <em>{shortAgo(b.last.createdAt)}</em>}
              </button>
            ))}

            <p className="chat-section">People</p>
            {convsLoaded && people.length === 0 && (
              <p className="chat-empty">Add teammates to a board and you can message them here.</p>
            )}
            {people.map((p) => (
              <button
                key={p._id}
                type="button"
                className={`chat-item${activeKey === `user:${p._id}` ? ' on' : ''}`}
                onClick={() => open('user', p._id)}
              >
                <Avatar user={p} size={36} status />
                <span className="chat-item-text">
                  <b>{p.name}</b>
                  <small>{p.last ? `${p.last.senderId === myId ? 'You: ' : ''}${p.last.text}` : peopleStatus(p).label}</small>
                </span>
                {p.unread > 0 ? <span className="chat-unread">{p.unread > 9 ? '9+' : p.unread}</span> : p.last && <em>{shortAgo(p.last.createdAt)}</em>}
              </button>
            ))}
          </aside>

          {/* ----- right: the conversation ----- */}
          <section className="chat-main panel">
            {!active && (
              <div className="chat-blank">
                <IconMessages size={40} />
                <h3>Team chat</h3>
                <p>Pick a board to talk with everyone on it, or a person to send a private message.</p>
              </div>
            )}

            {active && (
              <>
                <header className="chat-head">
                  <button type="button" className="icon-btn chat-back" onClick={() => navigate('/chat')} aria-label="Back to conversations">
                    <IconChevronLeft size={22} />
                  </button>
                  {activeBoard && (
                    <>
                      <span className="chat-board-icon big">
                        <IconLayoutBoard size={22} />
                      </span>
                      <div>
                        <h2>{activeBoard.title}</h2>
                        <small>{activeBoard.memberCount} members, everyone on the board sees these messages</small>
                      </div>
                    </>
                  )}
                  {activePerson && (
                    <>
                      <Avatar user={activePerson} size={42} status />
                      <div>
                        <h2>{activePerson.name}</h2>
                        <small>
                          {peopleStatus(activePerson).label}
                          {peopleStatus(activePerson).message ? `. ${peopleStatus(activePerson).message}` : ''}
                        </small>
                      </div>
                    </>
                  )}
                </header>

                <div className="chat-scroll">
                  {loadingMessages && <p className="muted chat-center">Loading messages...</p>}
                  {loaded.key === activeKey && loaded.hasMore && (
                    <button type="button" className="pill-btn chat-older" onClick={loadOlder} disabled={loadingOlder}>
                      {loadingOlder ? 'Loading...' : 'Load earlier messages'}
                    </button>
                  )}
                  {!loadingMessages && messages.length === 0 && (
                    <p className="muted chat-center">No messages yet. Say hello.</p>
                  )}

                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const mine = String(m.sender._id) === myId;
                    const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
                    const grouped =
                      prev &&
                      !newDay &&
                      String(prev.sender._id) === String(m.sender._id) &&
                      new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
                    return (
                      <div key={m._id}>
                        {newDay && <div className="chat-day">{dayOf(m.createdAt)}</div>}
                        <div className={`chat-msg${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
                          {!mine && (grouped ? <span className="chat-av-gap" /> : <Avatar user={senderUser(m)} size={32} />)}
                          <div className="chat-bubble-wrap">
                            {!grouped && (
                              <div className="chat-meta">
                                {!mine && <b>{m.sender.name}</b>}
                                <small>{timeOf(m.createdAt)}</small>
                              </div>
                            )}
                            <div className="chat-bubble">{m.text}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {error && <p className="form-error chat-error">{error}</p>}

                <form className="chat-compose" onSubmit={send}>
                  <textarea
                    rows={1}
                    value={text}
                    maxLength={2000}
                    placeholder={activeBoard ? `Message ${activeBoard.title}` : `Message ${activePerson ? activePerson.name : ''}`}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-label="Message"
                  />
                  <button type="submit" className="btn-small" disabled={!text.trim() || sending}>
                    <IconSend size={16} /> Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}