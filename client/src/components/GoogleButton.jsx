import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let scriptPromise = null;

// Loads Google's sign-in script once
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load Google sign-in. Check your internet connection.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// "Continue with Google" for the login and signup pages.
// It shows nothing at all until the server says Google sign-in is set up.
export default function GoogleButton() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const holder = useRef(null);
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');

  const onCredential = useEffectEvent(async (credential) => {
    setError('');
    try {
      const { data } = await api.post('/auth/google', { credential });
      updateUser(data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    }
  });

  useEffect(() => {
    api
      .get('/auth/config')
      .then(({ data }) => setClientId(data.googleClientId || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGoogle()
      .then(() => {
        const box = holder.current;
        if (cancelled || !box) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => onCredential(credential),
        });
        window.google.accounts.id.renderButton(box, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(400, Math.max(200, box.clientWidth || 320)),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div className="google-block">
      <div ref={holder} className="google-holder" />
      {error && <p className="form-error">{error}</p>}
      <div className="auth-or">
        <span>or use your email</span>
      </div>
    </div>
  );
}