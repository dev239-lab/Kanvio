import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconX } from '@tabler/icons-react';
import api from '../services/api';
import useWorkspace from '../hooks/useWorkspace';

export default function NewBoardModal({ onClose }) {
  const navigate = useNavigate();
  const { active } = useWorkspace();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/boards', { title, workspaceId: active?._id });
      onClose();
      navigate(`/board/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create board');
      setLoading(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Create a new board</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <p>
          {active
            ? `It will be added to ${active.name}, and everyone there will see it.`
            : 'Give your board a name. You can add lists and cards next.'}
        </p>

        <form onSubmit={submit}>
          {error && <p className="form-error">{error}</p>}
          <label className="field">
            <span>Board name</span>
            <input
              autoFocus
              placeholder="e.g. Final year project"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
              {loading ? 'Creating...' : 'Create board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}