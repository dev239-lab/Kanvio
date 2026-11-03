import { useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Avatar from './Avatar';
import { STATUS_OPTIONS, CLEAR_OPTIONS, clearTime, effectiveStatus } from '../utils/status';

export default function StatusPicker() {
  const { user, updateUser } = useAuth();
  const current = effectiveStatus(user);

  const [status, setStatus] = useState(current.id);
  const [message, setMessage] = useState(current.message);
  const [clearAfter, setClearAfter] = useState('never');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const chosen = STATUS_OPTIONS.find((s) => s.id === status);

  const save = async () => {
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      const { data } = await api.put('/auth/status', {
        status,
        statusMessage: message,
        statusUntil: clearTime(clearAfter),
      });
      updateUser(data);
      setMsg({
        type: 'ok',
        text:
          clearAfter === 'never'
            ? 'Status updated.'
            : 'Status updated. It switches back to Active when the time is up.',
      });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not save your status' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Your status</h2>
      <p className="panel-sub">Teammates see this next to your picture on boards and cards.</p>
      {msg.text && <p className={msg.type === 'ok' ? 'form-ok' : 'form-error'}>{msg.text}</p>}

      <div className="status-list" role="radiogroup" aria-label="Status">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={status === s.id}
            className={`status-opt${status === s.id ? ' on' : ''}`}
            onClick={() => setStatus(s.id)}
          >
            <span className="status-dot" style={{ background: s.color }} />
            {s.label}
            {status === s.id && <IconCheck size={16} className="status-check" />}
          </button>
        ))}
      </div>

      <label className="field" style={{ marginTop: 14 }}>
        <span>Status message (optional)</span>
        <input
          value={message}
          maxLength={80}
          placeholder="For example: Back at 3 pm"
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      <p className="panel-sub" style={{ margin: '4px 0 8px' }}>Clear after</p>
      <div className="seg">
        {CLEAR_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`seg-opt${clearAfter === o.id ? ' on' : ''}`}
            onClick={() => setClearAfter(o.id)}
            aria-pressed={clearAfter === o.id}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="panel-sub" style={{ margin: '18px 0 8px' }}>How teammates see you</p>
      <div className="status-preview">
        <Avatar user={{ ...user, status, statusMessage: message, statusUntil: null }} size={36} status />
        <span className="status-preview-text">
          {user.name}
          <small>
            {chosen.label}
            {message ? `. ${message}` : ''}
          </small>
        </span>
      </div>

      <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save status'}
      </button>
    </section>
  );
}