import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCrown,
  IconDots,
  IconInfoCircle,
  IconLayoutBoard,
  IconPencil,
  IconSearch,
  IconSettings,
  IconShield,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import { EditWorkspaceDialog, InviteToWorkspaceDialog } from '../components/WorkspaceDialogs';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import useWorkspace from '../hooks/useWorkspace';
import useClickOutside from '../hooks/useClickOutside';
import { ROLE_LABEL, ROLE_FILTERS } from '../utils/roles';

const STRIPS = ['#fcd34d', '#4f46e5', '#0d9488', '#db2777', '#2563eb', '#d97706'];
const dateOf = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function RolePill({ role }) {
  const Icon = role === 'manager' ? IconCrown : role === 'board_owner' ? IconLayoutBoard : IconUsers;
  return (
    <span className={`ws-role ${role}`}>
      <Icon size={16} /> {ROLE_LABEL[role]}
    </span>
  );
}

// The "..." menu of a row or of the page header
function ActionMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);
  if (items.length === 0) return null;

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn ws-dots" onClick={() => setOpen((o) => !o)} aria-label={label} aria-expanded={open}>
        <IconDots size={20} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              className={`menu-item${it.danger ? ' danger' : ''}`}
              onClick={() => {
                setOpen(false);
                it.run();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Workspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { setActiveId, reload: reloadWorkspaces } = useWorkspace();

  const [ws, setWs] = useState(null);
  const [data, setData] = useState({ members: [], total: 0, boardCount: 0 });
  const [boards, setBoards] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = ['boards', 'members', 'roles'].includes(tabParam) ? tabParam : 'members';
  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // 'invite' | 'edit'
  const [confirm, setConfirm] = useState(null); // { title, message, label, run }

  const load = useCallback(
    () =>
      Promise.all([
        api.get(`/workspaces/${id}`),
        api.get(`/workspaces/${id}/members`),
        api.get('/boards', { params: { workspace: id } }),
      ])
        .then(([w, m, b]) => {
          setWs(w.data);
          setData(m.data);
          setBoards(b.data);
          setError('');
        })
        .catch((err) => setError(err.response?.data?.message || 'Could not load this workspace')),
    [id]
  );

  useEffect(() => {
    load();
    setActiveId(id); // opening a workspace makes it the one you are working in
  }, [load, setActiveId, id]);

  // Live: someone changed this workspace
  useEffect(() => {
    if (!socket) return;
    const onChanged = (e) => String(e.workspaceId) === String(id) && load();
    socket.on('workspaceChanged', onChanged);
    return () => socket.off('workspaceChanged', onChanged);
  }, [socket, id, load]);

  const isManager = ws?.baseRole === 'manager';
  const canManage = isManager || ws?.baseRole === 'lead';

  const refresh = async () => {
    await Promise.all([load(), reloadWorkspaces()]);
  };

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.members
      .filter((m) => !roleFilter || m.role === roleFilter)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [data.members, search, roleFilter]);

  const menuFor = (m) => {
    const items = [];
    const self = String(m._id) === String(user._id);
    if (self && m.baseRole !== 'manager') {
      items.push({
        label: 'Leave workspace',
        danger: true,
        run: () =>
          setConfirm({
            title: 'Leave this workspace?',
            message: 'You will lose access to all of its boards. Your cards will be unassigned.',
            label: 'Leave',
            run: async () => {
              await api.delete(`/workspaces/${id}/members/${m._id}`);
              await reloadWorkspaces();
              navigate('/');
            },
          }),
      });
      return items;
    }
    if (self || m.baseRole === 'manager') return items;

    if (isManager) {
      items.push({
        label: m.baseRole === 'lead' ? 'Make Member' : 'Make Team Lead',
        run: () =>
          run(() => api.put(`/workspaces/${id}/members/${m._id}`, { role: m.baseRole === 'lead' ? 'member' : 'lead' })),
      });
    }
    if (isManager || (ws.baseRole === 'lead' && m.baseRole === 'member')) {
      items.push({
        label: 'Remove from workspace',
        danger: true,
        run: () =>
          setConfirm({
            title: `Remove ${m.name}?`,
            message: 'They will lose access to every board here, and their cards will be unassigned.',
            label: 'Remove',
            run: () => api.delete(`/workspaces/${id}/members/${m._id}`),
          }),
      });
    }
    return items;
  };

  const headerItems = [];
  if (canManage) headerItems.push({ label: 'Edit workspace', run: () => setDialog('edit') });
  if (isManager) {
    headerItems.push({
      label: 'Delete workspace',
      danger: true,
      run: () =>
        setConfirm({
          title: 'Delete this workspace?',
          message: 'This only works when the workspace has no boards. Everyone will be removed from it.',
          label: 'Delete',
          run: async () => {
            await api.delete(`/workspaces/${id}`);
            await reloadWorkspaces();
            navigate('/');
          },
        }),
    });
  }

  if (error && !ws) {
    return (
      <>
        <Navbar />
        <main className="container dash-wide">
          <p className="form-error">{error}</p>
          <Link to="/" className="back-home"><IconArrowLeft size={16} /> Back to boards</Link>
        </main>
      </>
    );
  }

  if (!ws) {
    return (
      <>
        <Navbar />
        <main className="container dash-wide"><p className="muted">Loading...</p></main>
      </>
    );
  }

  const stack = data.members.slice(0, 3);

  return (
    <>
      <Navbar />
      <main className="container dash-wide">
        <p className="ws-crumb">
          <Link to="/">Home</Link> / Workspaces / <b>{ws.name}</b>
        </p>

        {error && <p className="form-error">{error}</p>}

        <header className="ws-head">
          <span className="ws-icon-big"><IconUsers size={38} /></span>
          <div className="ws-head-text">
            <h1>
              {ws.name}
              {canManage && (
                <button className="icon-btn" onClick={() => setDialog('edit')} aria-label="Edit workspace">
                  <IconSettings size={20} />
                </button>
              )}
            </h1>
            <p>{ws.description || 'No description yet.'}</p>
          </div>
          <div className="ws-head-actions">
            <div className="ws-stack">
              {stack.map((m) => (
                <span key={m._id} title={m.name}><Avatar user={m} size={40} /></span>
              ))}
              {data.total > stack.length && <span className="ws-more">+{data.total - stack.length}</span>}
            </div>
            {canManage && (
              <button className="btn-small ws-invite" onClick={() => setDialog('invite')}>
                <IconUserPlus size={20} /> Invite Member
              </button>
            )}
            <ActionMenu items={headerItems} label="Workspace actions" />
          </div>
        </header>

        <div className="ws-tabs" role="tablist">
          {[
            { id: 'boards', label: `Boards (${data.boardCount})`, Icon: IconLayoutBoard },
            { id: 'members', label: `Members (${data.total})`, Icon: IconUsers },
            { id: 'roles', label: 'Roles', Icon: IconShield },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`ws-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.Icon size={20} /> {t.label}
            </button>
          ))}
        </div>

        <div className="ws-layout">
          <div className="ws-main">
            {tab === 'members' && (
              <section className="panel ws-card">
                <div className="ws-tools">
                  <label className="ws-search">
                    <IconSearch size={18} />
                    <input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search members" />
                  </label>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className="ws-filter">
                    {ROLE_FILTERS.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="ws-row ws-row-head">
                  <span>Member</span>
                  <span>Role</span>
                  <span className="ws-hide-sm">Owns</span>
                  <span className="ws-hide-sm">Joined</span>
                  <span />
                </div>

                {visible.length === 0 && <p className="dash-empty" style={{ padding: 20 }}>No members match.</p>}

                {visible.map((m) => {
                  const owns =
                    m.baseRole === 'manager' || m.baseRole === 'lead'
                      ? 'All boards'
                      : m.ownsBoards > 0
                        ? `${m.ownsBoards} ${m.ownsBoards === 1 ? 'board' : 'boards'}`
                        : 'None';
                  return (
                    <div key={m._id} className="ws-row">
                      <div className="ws-person">
                        <Avatar user={m} size={44} status />
                        <span>
                          <b>{m.name}{String(m._id) === String(user._id) ? ' (you)' : ''}</b>
                          <small>{m.email}</small>
                        </span>
                      </div>
                      <span><RolePill role={m.role} /></span>
                      <span className="ws-hide-sm"><span className="ws-owns">{owns}</span></span>
                      <span className="ws-hide-sm ws-date">{dateOf(m.joinedAt)}</span>
                      <ActionMenu items={menuFor(m)} />
                    </div>
                  );
                })}
              </section>
            )}

            {tab === 'boards' && (
              <section>
                {boards.length === 0 ? (
                  <div className="panel"><p className="dash-empty">No boards yet. Create one from Home and everyone here will see it.</p></div>
                ) : (
                  <div className="board-grid">
                    {boards.map((b, i) => (
                      <Link key={b._id} to={`/board/${b._id}`} className="board-card">
                        <div className="strip" style={{ background: STRIPS[i % STRIPS.length] }} />
                        <div className="board-card-body">
                          <div className="board-card-title">{b.title}</div>
                          <div className="board-card-meta">
                            {b.listCount} {b.listCount === 1 ? 'list' : 'lists'} · {b.cardCount} {b.cardCount === 1 ? 'card' : 'cards'}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === 'roles' && (
              <section className="panel ws-card ws-roles">
                <h2>What each role can do</h2>
                <div className="ws-perm ws-perm-head">
                  <span>Action</span><span>Manager</span><span>Team Lead</span><span>Board Owner</span><span>Member</span>
                </div>
                {[
                  ['See every board and card', 1, 1, 1, 1],
                  ['Create boards', 1, 1, 1, 1],
                  ['Add people to the workspace', 1, 1, 0, 0],
                  ['Remove members', 1, 'Members only', 0, 0],
                  ['Make someone a Team Lead', 1, 0, 0, 0],
                  ['Edit the workspace name', 1, 1, 0, 0],
                  ['Delete the workspace', 1, 0, 0, 0],
                ].map(([label, ...vals]) => (
                  <div key={label} className="ws-perm">
                    <span>{label}</span>
                    {vals.map((v, i) => (
                      <span key={i} className={v === 1 ? 'yes' : v === 0 ? 'no' : 'some'}>
                        {v === 1 ? 'Yes' : v === 0 ? 'No' : v}
                      </span>
                    ))}
                  </div>
                ))}
                <p className="muted" style={{ margin: '14px 0 0', fontSize: 13 }}>
                  A Board Owner is a member who owns at least one board. Extra controls for individual boards are planned.
                </p>
              </section>
            )}
          </div>

          <aside className="ws-side">
            <section className="panel ws-card">
              <div className="ws-card-title">
                <IconInfoCircle size={20} /> <b>Workspace Info</b>
                {canManage && (
                  <button className="icon-btn" onClick={() => setDialog('edit')} aria-label="Edit workspace info">
                    <IconPencil size={18} />
                  </button>
                )}
              </div>
              <dl className="ws-info">
                <div><dt>Name</dt><dd>{ws.name}</dd></div>
                <div><dt>Members</dt><dd>{data.total}</dd></div>
                <div><dt>Boards</dt><dd>{data.boardCount}</dd></div>
                <div><dt>Created</dt><dd>{dateOf(ws.createdAt)}</dd></div>
                <div><dt>Your role</dt><dd>{ROLE_LABEL[ws.role]}</dd></div>
              </dl>
            </section>

            <section className="panel ws-card">
              <div className="ws-card-title"><IconShield size={20} /> <b>Role Hierarchy</b></div>
              <div className="ws-hier manager"><b>Manager</b> (Workspace Owner)<small>Complete workspace ownership and control</small></div>
              <span className="ws-arrow">&darr;</span>
              <div className="ws-hier lead"><b>Team Lead</b> (Workspace Admin)<small>Manage members, boards and team operations</small></div>
              <span className="ws-arrow">&darr;</span>
              <div className="ws-hier board_owner"><b>Board Owner</b> (Per board)<small>Owns individual boards</small></div>
              <span className="ws-arrow">&darr;</span>
              <div className="ws-hier member"><b>Member</b> (Everyone else)<small>Work on assigned tasks and collaborate</small></div>
            </section>
          </aside>
        </div>
      </main>

      {dialog === 'invite' && (
        <InviteToWorkspaceDialog workspaceId={id} isManager={isManager} onClose={() => setDialog(null)} onChanged={refresh} />
      )}
      {dialog === 'edit' && (
        <EditWorkspaceDialog workspace={ws} onClose={() => setDialog(null)} onSaved={refresh} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const fn = confirm.run;
            setConfirm(null);
            run(fn);
          }}
        />
      )}
    </>
  );
}