import { useRef, useState } from 'react';
import { IconUpload, IconTrash } from '@tabler/icons-react';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import Avatar from './Avatar';
import { pictureToDataUrl } from '../utils/image';

export default function ProfilePhoto() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const save = async (avatarImage, okText) => {
    setBusy(true);
    setMsg({ type: '', text: '' });
    try {
      const { data } = await api.put('/auth/avatar', { avatarImage });
      updateUser(data);
      setMsg({ type: 'ok', text: okText });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Could not save the picture' });
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;
    try {
      const dataUrl = await pictureToDataUrl(file);
      await save(dataUrl, 'Picture updated.');
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="photo-block">
      <h3 className="step-title">Display picture</h3>
      {msg.text && <p className={msg.type === 'ok' ? 'form-ok' : 'form-error'}>{msg.text}</p>}

      <div className="photo-row">
        <Avatar user={user} size={84} status />
        <div>
          <div className="photo-actions">
            <button
              type="button"
              className="pill-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <IconUpload size={15} /> {busy ? 'Saving...' : 'Upload photo'}
            </button>
            {user.avatarImage && (
              <button type="button" className="pill-btn" onClick={() => save(null, 'Picture removed.')} disabled={busy}>
                <IconTrash size={15} /> Remove photo
              </button>
            )}
          </div>
          <p className="photo-help">
            JPG, PNG or WebP. A square picture works best. Without a photo, your colored avatar
            with your initials is shown.
          </p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        hidden
      />
    </div>
  );
}