import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconUserBolt } from '@tabler/icons-react';
import useAuth from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';
import PasswordField from '../components/PasswordField';
import GoogleButton from '../components/GoogleButton';

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // Logs in as a shared demo user, creating it the first time
  const handleDemo = async () => {
    setError('');
    setLoading(true);

    try {
      await login('demo@kanvio.com', 'demo123');
      navigate('/');
    } catch (loginErr) {
      // Don't attempt signup if the server cannot be reached.
      if (!loginErr.response) {
        setError('Cannot reach the server. Check your Wi-Fi and backend connection.');
        setLoading(false);
        return;
      }

      // A 401 means invalid credentials or a missing demo account in your current backend.
      if (loginErr.response.status !== 401) {
        setError(loginErr.response.data?.message || 'Unable to start the demo.');
        setLoading(false);
        return;
      }

      try {
        await signup('Demo User', 'demo@kanvio.com', 'demo123');
        navigate('/');
      } catch (signupErr) {
        setError(signupErr.response?.data?.message || 'Could not create the demo account.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your boards"
      footer={<>No account? <Link to="/signup">Sign up</Link></>}
    >
      <GoogleButton />

      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Please wait...' : 'Log in'}
        </button>

        <button type="button" className="btn-ghost" onClick={handleDemo} disabled={loading}>
          <IconUserBolt size={18} /> Try demo account
        </button>
      </form>
    </AuthLayout>
  );
}