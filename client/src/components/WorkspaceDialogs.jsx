import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
import api from '../services/api';
import useWorkspace from '../hooks/useWorkspace';

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

function Shell({ title, subtitle, onClose, children }) {
  useEscape(onClose);
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// A new workspace, made from the switcher
export function CreateWorkspaceDialog({ onClose }) {
  const navigate = useNavigate();
  const { setActiveId, reload } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/workspaces', { name, description });
      await reload();
      setActiveId(data._id);
      onClose();
      navigate(`/workspace/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the workspace');
      setBusy(false);
    }
  };

  return (
    <Shell title="Create a workspace" subtitle="A workspace holds boards and the people who work on them." onClose={onClose}>
      <form onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        <label className="field">
          <span>Name</span>
          <input autoFocus value={name} maxLength={60} placeholder="e.g. Design team" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input value={description} maxLength={200} placeholder="What is this workspace for?" onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating...' : 'Create workspace'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

// Change the name and description
export function EditWorkspaceDialog({ workspace, onClose, onSaved }) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.put(`/workspaces/${workspace._id}`, { name, description });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save the changes');
      setBusy(false);
    }
  };

  return (
    <Shell title="Edit workspace" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        <label className="field">
          <span>Name</span>
          <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

// Add a person by email. The manager can also choose to make them a Team Lead.
export function InviteToWorkspaceDialog({ workspaceId, isManager, onClose, onChanged }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
      setNotice(`${data.name} was added and can now see every board.`);
      setEmail('');
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add that person');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Invite to workspace"
      subtitle="Enter the email of someone who already has a Kanvio account. They will see every board in this workspace."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}
        <label className="field">
          <span>Email</span>
          <input autoFocus type="email" value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} />
        </label>
        {isManager && (
          <div className="seg" style={{ marginBottom: 14 }}>
            {[
              { id: 'member', label: 'Member' },
              { id: 'lead', label: 'Team Lead' },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                className={`seg-opt${role === o.id ? ' on' : ''}`}
                onClick={() => setRole(o.id)}
                aria-pressed={role === o.id}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Done</button>
          <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
            {busy ? 'Adding...' : 'Add person'}
          </button>
        </div>
      </form>
    </Shell>
  );
}