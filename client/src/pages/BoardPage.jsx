import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IconArrowLeft, IconUserPlus } from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Board from '../components/Board';
import InviteDialog from '../components/InviteDialog';
import useSocket from '../hooks/useSocket';
import { initials, avatarColor } from '../utils/avatar';

function LiveBadge() {
  const socket = useSocket();
  const subscribe = useCallback(
    (callback) => {
      if (!socket) return () => {};
      socket.on('connect', callback);
      socket.on('disconnect', callback);
      return () => {
        socket.off('connect', callback);
        socket.off('disconnect', callback);
      };
    },
    [socket]
  );
  const connected = useSyncExternalStore(subscribe, () => !!socket?.connected);

  return (
    <span className={`live-badge ${connected ? 'on' : 'off'}`}>
      <span className="live-dot" />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}

export default function BoardPage() {
  const { id } = useParams();
  const socket = useSocket();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    api
      .get(`/boards/${id}`)
      .then(({ data }) => {
        setBoard(data.board);
        setLists(data.lists);
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load board'));
  }, [id]);

  // Add a member to the screen (used by the invite dialog and by live updates)
  const addMemberToState = useCallback((member) => {
    setBoard((prev) =>
      !prev || prev.members.some((m) => m._id === member._id)
        ? prev
        : { ...prev, members: [...prev.members, member] }
    );
  }, []);

  // Live: someone else added a member to this board
  useEffect(() => {
    if (!socket) return;
    const onMemberAdded = ({ boardId, member }) => {
      if (boardId === id) addMemberToState(member);
    };
    socket.on('memberAdded', onMemberAdded);
    return () => socket.off('memberAdded', onMemberAdded);
  }, [socket, id, addMemberToState]);

  if (error) {
    return (
      <>
        <Navbar />
        <main className="board-page">
          <p className="form-error">{error}</p>
          <Link to="/" className="back-link">
            <IconArrowLeft size={18} /> Back to boards
          </Link>
        </main>
      </>
    );
  }

  if (!board) {
    return (
      <>
        <Navbar />
        <main className="board-page">
          <div className="lists-wrap">
            {[1, 2, 3].map((n) => (
              <div key={n} className="k-list skeleton-list" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="board-page">
        <header className="board-header">
          <div className="board-header-left">
            <Link to="/" className="back-home" style={{ marginBottom: 0 }}>
              <IconArrowLeft size={16} /> Home
            </Link>
            <h1>{board.title}</h1>
            <LiveBadge />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="stack">
              {board.members.map((m) => (
                <span
                  key={m._id}
                  className="avatar sm-md"
                  style={{ background: avatarColor(m.name) }}
                  title={m.name}
                >
                  {initials(m.name)}
                </span>
              ))}
            </div>
            <button className="btn-small" onClick={() => setInviteOpen(true)}>
              <IconUserPlus size={18} /> Invite
            </button>
          </div>
        </header>

        <Board boardId={id} lists={lists} setLists={setLists} members={board.members} />
      </main>

      {inviteOpen && (
        <InviteDialog
          boardId={id}
          onClose={() => setInviteOpen(false)}
          onAdded={addMemberToState}
        />
      )}
    </>
  );
}