import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconLayoutBoard, IconBellRinging, IconMessages } from '@tabler/icons-react';
import useAuth from '../hooks/useAuth';
import LogoMark from '../components/LogoMark';
import LogoIntro from '../components/LogoIntro';
import { shouldPlayIntro, markIntroSeen } from '../utils/intro';

export default function Welcome() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [intro, setIntro] = useState(shouldPlayIntro);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const endIntro = useCallback(() => {
    markIntroSeen();
    setIntro(false);
  }, []);

  // Logs in as the shared demo user, creating it the first time
  const tryDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await login('demo@kanvio.com', 'demo123');
      navigate('/');
    } catch (loginErr) {
      if (!loginErr.response) {
        setError('Cannot reach the server. Check your Wi-Fi and that the backend is running.');
        setLoading(false);
        return;
      }
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
        setLoading(false);
      }
    }
  };

  return (
    <div className="wl-page">
      {intro && <LogoIntro onDone={endIntro} />}

      <div className="wl-wrap">
        <header className="wl-nav">
          <Link to="/welcome" className="wl-brand">
            <LogoMark size={32} /> Kanvio
          </Link>
          <nav className="wl-links" aria-label="Main">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="wl-signup">Sign up free</Link>
          </nav>
        </header>

        <section className="wl-hero">
          <div className="wl-hero-text">
            <h1>Plan work together, in real time.</h1>
            <p className="lead">
              Boards, deadlines, reminders and team chat in one calm place. Built for small teams.
            </p>
            <div className="wl-cta">
              <Link to="/signup" className="wl-btn primary">Get started free</Link>
              <button type="button" className="wl-btn ghost" onClick={tryDemo} disabled={loading}>
                {loading ? 'Starting demo...' : 'Try the demo'}
              </button>
            </div>
            {error && <p className="form-error" style={{ marginTop: 14, maxWidth: 460 }}>{error}</p>}
            <p className="wl-note">No credit card. Works on your phone too.</p>
          </div>

          <div className="wl-mock" aria-hidden="true">
            <div className="wl-cols">
              <div className="wl-col"><b>To do</b><div className="wl-card" /><div className="wl-card" /></div>
              <div className="wl-col"><b>Doing</b><div className="wl-card hl" /></div>
              <div className="wl-col"><b>Done</b><div className="wl-card" /><div className="wl-card" /><div className="wl-card" /></div>
            </div>
            <span className="wl-live"><i /> Dev moved a card, live</span>
          </div>
        </section>

        <section id="features" className="wl-features">
          <div className="wl-feature">
            <span className="wl-icon"><IconLayoutBoard size={22} /></span>
            <h3>Live boards</h3>
            <p>Drag a card and everyone on the board sees it move instantly.</p>
          </div>
          <div className="wl-feature">
            <span className="wl-icon"><IconBellRinging size={22} /></span>
            <h3>Never miss a deadline</h3>
            <p>Reminders, due dates and a weekly view, so nothing slips by.</p>
          </div>
          <div className="wl-feature">
            <span className="wl-icon"><IconMessages size={22} /></span>
            <h3>Talk with your team</h3>
            <p>Board chat, private messages, a shared calendar and team status.</p>
          </div>
        </section>

        <section id="how" className="wl-how">
          <h2>How it works</h2>
          <div className="wl-steps">
            <div className="wl-step"><span className="wl-num">1</span><h3>Create a board</h3><p>Start blank or from a ready-made template.</p></div>
            <div className="wl-step"><span className="wl-num">2</span><h3>Invite your team</h3><p>Add people by email and assign them cards.</p></div>
            <div className="wl-step"><span className="wl-num">3</span><h3>Plan and get things done</h3><p>Move cards, chat, and let reminders do the nagging.</p></div>
          </div>
        </section>

        <section className="wl-band">
          <h2>Ready to plan your first board?</h2>
          <Link to="/signup" className="wl-btn dark">Create a free account</Link>
        </section>

        <footer className="wl-foot">Kanvio. Real-time Kanban boards for small teams.</footer>
      </div>
    </div>
  );
}