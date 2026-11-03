import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import api from '../services/api';

export default function InviteDialog({ boardId, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data } = await api.post(`/boards/${boardId}/members`, { email });
      onAdded(data);
      setNotice(`${data.name} was added to this board.`);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add member');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Invite to board</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={20} />
          </button>
        </div>
        <p>Enter the email of someone who already has a Kanvio account.</p>

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-ok">{notice}</p>}

        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Done
            </button>
            <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
              {busy ? 'Adding...' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}