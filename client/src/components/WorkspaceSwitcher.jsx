import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconCheck,
  IconChevronDown,
  IconLayoutBoard,
  IconPlus,
  IconSettings,
  IconShield,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import useWorkspace from '../hooks/useWorkspace';
import useClickOutside from '../hooks/useClickOutside';
import {
  CreateWorkspaceDialog,
  EditWorkspaceDialog,
  InviteToWorkspaceDialog,
} from './WorkspaceDialogs';
import { ROLE_LABEL } from '../utils/roles';

// The workspace picker and manage menu in the navbar
export default function WorkspaceSwitcher() {
  const { workspaces, active, setActiveId, reload } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'create' | 'edit' | 'invite'
  const ref = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close);

  if (!active) return null;

  const isManager = active.baseRole === 'manager';
  const canManage = isManager || active.baseRole === 'lead';

  const choose = (w) => {
    setActiveId(w._id);
    setOpen(false);
    navigate('/');
  };

  const openDialog = (name) => {
    setOpen(false);
    setDialog(name);
  };

  const base = `/workspace/${active._id}`;

  return (
    <>
      <div className="menu-wrap" ref={ref}>
        <button
          className="ws-switch"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Switch workspace"
        >
          <span className="ws-letter">{active.name.charAt(0).toUpperCase()}</span>
          <span className="ws-switch-name">{active.name}</span>
          <IconChevronDown size={14} />
        </button>

        {open && (
          <div className="menu menu-left ws-menu" role="menu">
            <div className="menu-label">Your workspaces</div>
            {workspaces.map((w) => (
              <button key={w._id} className="menu-item" onClick={() => choose(w)}>
                <span className="ws-letter small">{w.name.charAt(0).toUpperCase()}</span>
                <span className="ws-menu-text">
                  <b>{w.name}</b>
                  <small>{ROLE_LABEL[w.role]} · {w.boardCount} {w.boardCount === 1 ? 'board' : 'boards'}</small>
                </span>
                {w._id === active._id && <IconCheck size={16} />}
              </button>
            ))}

            <div className="menu-sep" />
            <div className="menu-label">Manage</div>
            <Link to={`${base}?tab=members`} className="menu-item" onClick={close}>
              <IconUsers size={18} /> Members
              <span className="menu-count">{active.memberCount}</span>
            </Link>
            <Link to={`${base}?tab=roles`} className="menu-item" onClick={close}>
              <IconShield size={18} /> Roles and access
            </Link>
            <Link to={`${base}?tab=boards`} className="menu-item" onClick={close}>
              <IconLayoutBoard size={18} /> All boards
              <span className="menu-count">{active.boardCount}</span>
            </Link>
            {canManage && (
              <>
                <button className="menu-item" onClick={() => openDialog('edit')}>
                  <IconSettings size={18} /> Workspace settings
                </button>
                <button className="menu-item" onClick={() => openDialog('invite')}>
                  <IconUserPlus size={18} /> Invite members
                </button>
              </>
            )}

            <div className="menu-sep" />
            <button className="menu-item" onClick={() => openDialog('create')}>
              <IconPlus size={18} /> Create a workspace
            </button>
          </div>
        )}
      </div>

      {dialog === 'create' && <CreateWorkspaceDialog onClose={() => setDialog(null)} />}
      {dialog === 'edit' && (
        <EditWorkspaceDialog workspace={active} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {dialog === 'invite' && (
        <InviteToWorkspaceDialog
          workspaceId={active._id}
          isManager={isManager}
          onClose={() => setDialog(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}