import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  IconArrowLeft,
  IconCheck,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconUser,
  IconLock,
  IconSettings,
  IconBell,
} from '@tabler/icons-react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import PasswordField from '../components/PasswordField';
import useAuth from '../hooks/useAuth';
import ProfilePhoto from '../components/ProfilePhoto';
import StatusPicker from '../components/StatusPicker';
import {
  getTheme,
  setTheme,
  toastsEnabled,
  setToastsEnabled,
  channelEnabled,
  setChannelEnabled,
  setAllChannels,
  REMIND_LEAD_OPTIONS,
  getRemindLead,
  setRemindLead,
  ACCENTS,
  getAccent,
  setAccent,
  TEXT_SIZES,
  getTextSize,
  setTextSize,
  reduceMotionEnabled,
  setReduceMotion,
  highContrastEnabled,
  setHighContrast,
  compactCardsEnabled,
  setCompactCards,
  showBadgesEnabled,
  setShowBadges,
  newCardPosition,
  setNewCardPosition,
  confirmDeleteEnabled,
  setConfirmDelete,
  assignToMeEnabled,
  setAssignToMe,
} from '../utils/preferences';
const TABS = [
  {
    id: 'profile',
    label: 'Profile',
    Icon: IconUser,
    title: 'Profile',
    sub: 'Update your name and email address.',
    tipTitle: 'This is how teammates see you',
    tip: 'Your name and avatar appear on cards, comments and board member lists. The avatar color is generated from your name.',
  },
  {
    id: 'security',
    label: 'Security',
    Icon: IconLock,
    title: 'Password & security',
    sub: 'Update your password and manage your account security.',
    tipTitle: 'Keep your account secure',
    tip: "Use a unique password that you haven't used on other websites. A strong password helps protect your account and your team's data.",
  },
  {
    id: 'preferences',
    label: 'Preferences',
    Icon: IconSettings,
    title: 'Preferences',
    sub: 'Choose how Kanvio looks and how boards behave.',
    tipTitle: 'Make Kanvio yours',
    tip: 'Theme, accent color and board behavior are saved in this browser, so they stay the same each time you open Kanvio here.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    Icon: IconBell,
    title: 'Notifications',
    sub: 'Choose what you get, and where you get it.',
    tipTitle: 'Stay in the loop, without the noise',
    tip: 'Pick the channels you want for each event. You can turn off popups and still catch up later in the bell.',
  },
];
const THEMES = [
  { id: 'light', label: 'Light', Icon: IconSun },
  { id: 'dark', label: 'Dark', Icon: IconMoon },
  { id: 'system', label: 'System', Icon: IconDeviceDesktop },
];
const NOTIFY_ROWS = [
  { type: 'reminder', title: 'Reminders', note: 'When a card reminder is due.' },
  { type: 'comment', title: 'Comments', note: 'When someone comments on a card.' },
  { type: 'move', title: 'Card moves', note: 'When someone moves a card.' },
  { type: 'invite', title: 'Board invitations', note: 'When someone adds you to a board.' },
  { type: 'mention', title: 'Mentions', note: 'When someone @mentions you in a comment.' },
  { type: 'assignment', title: 'Assigned to you', note: 'When someone assigns you to a card.' },
];
const CHANNEL_COLS = [
  { id: 'bell', label: 'Bell' },
  { id: 'toast', label: 'Toast' },
  { id: 'email', label: 'Email' },
];
function readChannels() {
  return Object.fromEntries(
    NOTIFY_ROWS.map((r) => [
      r.type,
      Object.fromEntries(CHANNEL_COLS.map((c) => [c.id, channelEnabled(r.type, c.id)])),
    ])
  );
}
const STRENGTH_LABELS = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
// 0 = too short (under 6 characters), then 1 to 4
function passwordStrength(p) {
  if (p.length < 6) return 0;
  let score = 1;
  if (p.length >= 10) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 1;
  return score;
}
function Message({ msg }) {
  if (!msg.text) return null;
  return <p className={msg.type === 'ok' ? 'form-ok' : 'form-error'}>{msg.text}</p>;
}
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  );
}
function Head({ info }) {
  return (
    <header className="settings-head">
      <h2>{info.title}</h2>
      <p>{info.sub}</p>
    </header>
  );
}
export default function Settings() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  // The tab comes from the URL (/settings/security). The old ?tab=security links still work.
  const requested = tabParam || searchParams.get('tab');
  const info = TABS.find((t) => t.id === requested) || TABS[0];
  const tab = info.id;
  const [theme, setThemeState] = useState(getTheme());
  const [toasts, setToasts] = useState(toastsEnabled());
  const [accent, setAccentState] = useState(getAccent());
  const [textSize, setTextSizeState] = useState(getTextSize());
  const [reduceMotion, setReduceMotionState] = useState(reduceMotionEnabled());
  const [highContrast, setHighContrastState] = useState(highContrastEnabled());
  const [compact, setCompactState] = useState(compactCardsEnabled());
  const [badges, setBadgesState] = useState(showBadgesEnabled());
  const [cardPos, setCardPosState] = useState(newCardPosition());
  const [confirmDel, setConfirmDelState] = useState(confirmDeleteEnabled());
  const [assignMe, setAssignMeState] = useState(assignToMeEnabled());
  const [channels, setChannels] = useState(readChannels);
  const [lead, setLead] = useState(getRemindLead());
  // Email choices live on the server (the server sends the emails)
  const [emailInfo, setEmailInfo] = useState({ available: false, prefs: {}, loaded: false });
  const [emailError, setEmailError] = useState('');
  useEffect(() => {
    if (tab !== 'notifications' || emailInfo.loaded) return;
    api
      .get('/auth/email-prefs')
      .then(({ data }) => setEmailInfo({ available: data.available, prefs: data.prefs, loaded: true }))
      .catch(() => setEmailInfo((prev) => ({ ...prev, loaded: true })));
  }, [tab, emailInfo.loaded]);
  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', { name, email });
      updateUser(data);
      setProfileMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Could not update profile' });
    } finally {
      setSavingProfile(false);
    }
  };
  // Changing the current password again locks the new password fields
  const changeCurrent = (value) => {
    setCurrentPassword(value);
    if (verified) {
      setVerified(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: '', text: '' });
    }
  };
  const verifyCurrent = async () => {
    setPasswordMsg({ type: '', text: '' });
    setVerifying(true);
    try {
      await api.post('/auth/verify-password', { currentPassword });
      setVerified(true);
      setPasswordMsg({ type: 'ok', text: 'Password verified. Now choose a new password.' });
    } catch (err) {
      setVerified(false);
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.message || 'Could not verify the password',
      });
    } finally {
      setVerifying(false);
    }
  };
  const savePassword = async (e) => {
    e.preventDefault();

    // Pressing Enter before verifying runs the verification instead
    if (!verified) {
      verifyCurrent();
      return;
    }
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMsg({ type: 'error', text: 'The new password must be different from the current one.' });
      return;
    }
    setSavingPassword(true);
    try {
      // The server checks the current password again, so the lock cannot be bypassed
      await api.put('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVerified(false);
      setPasswordMsg({ type: 'ok', text: 'Password updated.' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.message || 'Could not update password' });
    } finally {
      setSavingPassword(false);
    }
  };
  const chooseTheme = (value) => {
    setThemeState(value);
    setTheme(value);
  };
  const toggleChannel = (type, channel, on) => {
    setChannels((prev) => ({ ...prev, [type]: { ...prev[type], [channel]: on } }));
    setChannelEnabled(type, channel, on);
  };
  const saveEmailPrefs = async (changes, previous) => {
    setEmailError('');
    try {
      const { data } = await api.put('/auth/email-prefs', { prefs: changes });
      setEmailInfo({ available: data.available, prefs: data.prefs, loaded: true });
    } catch (err) {
      setEmailInfo((prev) => ({ ...prev, prefs: previous }));
      setEmailError(err.response?.data?.message || 'Could not save your email choice');
    }
  };
  const toggleEmail = (type, on) => {
    const previous = emailInfo.prefs;
    setEmailInfo((prev) => ({ ...prev, prefs: { ...prev.prefs, [type]: on } }));
    saveEmailPrefs({ [type]: on }, previous);
  };
  // Enable all turns on the bell and toast boxes only (email is opt-in).
  // Disable all also turns every email off.
  const setAll = (on) => {
    setAllChannels(on);
    setChannels(readChannels());
    if (!on && emailInfo.available) {
      const off = Object.fromEntries(NOTIFY_ROWS.map((r) => [r.type, false]));
      const previous = emailInfo.prefs;
      setEmailInfo((prev) => ({ ...prev, prefs: off }));
      saveEmailPrefs(off, previous);
    }
  };

  const chooseLead = (value) => {
    setLead(value);
    setRemindLead(value);
  };

  const chooseAccent = (id) => {
    setAccentState(id);
    setAccent(id);
  };

  const chooseTextSize = (id) => {
    setTextSizeState(id);
    setTextSize(id);
  };

  const toggleReduceMotion = (on) => {
    setReduceMotionState(on);
    setReduceMotion(on);
  };

  const toggleHighContrast = (on) => {
    setHighContrastState(on);
    setHighContrast(on);
  };

  const toggleCompact = (on) => {
    setCompactState(on);
    setCompactCards(on);
  };

  const chooseCardPos = (where) => {
    setCardPosState(where);
    setNewCardPosition(where);
  };

  const toggleConfirmDelete = (on) => {
    setConfirmDelState(on);
    setConfirmDelete(on);
  };

  const toggleAssignMe = (on) => {
    setAssignMeState(on);
    setAssignToMe(on);
  };

  const toggleBadges = (on) => {
    setBadgesState(on);
    setShowBadges(on);
  };

  const toggleToasts = (on) => {
    setToasts(on);
    setToastsEnabled(on);
  };

  const strength = passwordStrength(newPassword);
  const matches = confirmPassword.length > 0 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canUpdate = verified && strength > 0 && matches && !savingPassword;

  return (
    <>
      <Navbar />
      <main className="container settings-wide">
        <div className="settings-layout">
          <div className="settings-top">
            <Link to="/" className="back-home">
              <IconArrowLeft size={16} /> Back to boards
            </Link>
            <h1 className="greeting">Settings</h1>
            <p className="greeting-sub">Manage your account and workspace.</p>
          </div>

          <nav className="settings-nav" aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`settings-nav-item${tab === t.id ? ' active' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => navigate(`/settings/${t.id}`)}
              >
                <t.Icon size={20} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="settings-main">
                        {tab === 'profile' && (
              <>
              <section className="panel">
                <Head info={info} />
                                <ProfilePhoto />

                <form onSubmit={saveProfile}>
                  <Message msg={profileMsg} />
                  <label className="field">
                    <span>Full name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="btn-primary" disabled={savingProfile}>
                    {savingProfile?'Saving...':'Save changes'}</button></form>
              </section>
              <StatusPicker />
              </>
            )}
            {tab === 'security' && (
              <section className="panel">
                <Head info={info} />
                <form onSubmit={savePassword}>
                  <h3 className="step-title">1. Verify your current password</h3>
                  <Message msg={passwordMsg} />
                  <PasswordField
                    label="Current password"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => changeCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                  {!verified && (
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={verifying || !currentPassword}
                    >
                      {verifying ? 'Checking...' : 'Verify password'}
                    </button>
                  )}
                  <hr className="step-sep" />

                  <h3 className="step-title">2. Set a new password</h3>
                  <p className="pw-hint">
                    These fields will be enabled after you verify your current password.
                  </p>
                  <PasswordField
                    label="New password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    locked={!verified}
                    autoComplete="new-password"
                  />

                  {verified && newPassword && (
                    <div className={`pw-meter lvl-${strength}`}>
                      <div className="pw-bars">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={`pw-bar${i < strength ? ' on' : ''}`} />
                        ))}
                      </div>
                      <span className="pw-hint">{STRENGTH_LABELS[strength]}</span>
                    </div>
                  )}

                  <PasswordField
                    label="Confirm new password"
                    placeholder="Repeat the new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    locked={!verified}
                    autoComplete="new-password"
                  />

                  {verified && matches && <p className="pw-hint pw-good">Passwords match</p>}
                  {verified && mismatch && <p className="pw-hint pw-bad">Passwords do not match yet</p>}

                  <button
                    type={verified ? 'submit' : 'button'}
                    className="btn-primary"
                    disabled={!canUpdate}
                  >
                    {savingPassword ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              </section>
            )}

            {tab === 'preferences' && (
              <>
                <Head info={info} />

                <section className="panel">
                  <h2 className="panel-title">Appearance</h2>

                  <p className="panel-sub">Theme</p>
                  <div className="theme-grid">
                    {THEMES.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`theme-opt${theme === id ? ' on' : ''}`}
                        onClick={() => chooseTheme(id)}
                        aria-pressed={theme === id}
                      >
                        <Icon size={20} />
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="panel-sub" style={{ margin: '18px 0 10px' }}>Accent color</p>
                  <div className="swatch-row">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`swatch${accent === a.id ? ' on' : ''}`}
                        style={{ background: a.color }}
                        onClick={() => chooseAccent(a.id)}
                        aria-pressed={accent === a.id}
                        aria-label={a.label}
                        title={a.label}
                      >
                        {accent === a.id && <IconCheck size={16} />}
                      </button>
                    ))}
                  </div>

                  <div className="switch-row" style={{ marginTop: 18 }}>
                    <div className="switch-label">
                      <b>Popup notifications</b>
                      <small>Show a toast in the corner. The bell always keeps a history.</small>
                    </div>
                    <Switch checked={toasts} onChange={toggleToasts} label="Popup notifications" />
                  </div>
                </section>

                <section className="panel">
                  <h2 className="panel-title">Board and task behavior</h2>

                  <p className="panel-sub">Add new cards to</p>
                  <div className="seg" style={{ marginBottom: 6 }}>
                    {[
                      { id: 'top', label: 'Top of the list' },
                      { id: 'bottom', label: 'Bottom of the list' },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className={`seg-opt${cardPos === o.id ? ' on' : ''}`}
                        onClick={() => chooseCardPos(o.id)}
                        aria-pressed={cardPos === o.id}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="switch-row" style={{ marginTop: 12 }}>
                    <div className="switch-label">
                      <b>Confirm before deleting a card</b>
                      <small>Shows a question first, so a card is not removed by accident.</small>
                    </div>
                    <Switch checked={confirmDel} onChange={toggleConfirmDelete} label="Confirm before deleting a card" />
                  </div>

                  <div className="switch-row">
                    <div className="switch-label">
                      <b>Assign me to cards I create</b>
                      <small>You are added as the assignee of every new card.</small>
                    </div>
                    <Switch checked={assignMe} onChange={toggleAssignMe} label="Assign me to cards I create" />
                  </div>

                  <div className="switch-row">
                    <div className="switch-label">
                      <b>Compact cards</b>
                      <small>Tighter cards, so more of a list fits on screen.</small>
                    </div>
                    <Switch checked={compact} onChange={toggleCompact} label="Compact cards" />
                  </div>

                  <div className="switch-row">
                    <div className="switch-label">
                      <b>Show badges on cards</b>
                      <small>Due date and comment count at the bottom of each card.</small>
                    </div>
                    <Switch checked={badges} onChange={toggleBadges} label="Show badges on cards" />
                  </div>
                </section>

                <section className="panel">
                  <h2 className="panel-title">Accessibility</h2>

                  <p className="panel-sub">Text size</p>
                  <div className="seg">
                    {TEXT_SIZES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`seg-opt${textSize === t.id ? ' on' : ''}`}
                        onClick={() => chooseTextSize(t.id)}
                        aria-pressed={textSize === t.id}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="switch-row" style={{ marginTop: 16 }}>
                    <div className="switch-label">
                      <b>Reduce motion</b>
                      <small>Turns off animations and transitions.</small>
                    </div>
                    <Switch checked={reduceMotion} onChange={toggleReduceMotion} label="Reduce motion" />
                  </div>

                  <div className="switch-row">
                    <div className="switch-label">
                      <b>High contrast</b>
                      <small>Stronger text and borders, with clear keyboard focus outlines.</small>
                    </div>
                    <Switch checked={highContrast} onChange={toggleHighContrast} label="High contrast" />
                  </div>
                </section>
              </>
            )}

            {tab === 'notifications' && (
              <section className="panel">
                <div className="panel-head-row">
                  <Head info={info} />
                  <div className="panel-head-actions">
                    <button type="button" className="pill-btn" onClick={() => setAll(true)}>
                      Enable all
                    </button>
                    <button type="button" className="pill-btn" onClick={() => setAll(false)}>
                      Disable all
                    </button>
                  </div>
                </div>

                <div className="notif-grid">
                  <span />
                  {CHANNEL_COLS.map((c) => (
                    <span key={c.id} className="notif-grid-head">{c.label}</span>
                  ))}

                  {NOTIFY_ROWS.map((row) => (
                    <div key={row.type} className="notif-grid-row">
                      <div className="notif-grid-label">
                        <b>{row.title}</b>
                        <small>{row.note}</small>
                      </div>
                      {CHANNEL_COLS.map((c) => {
                        const isEmail = c.id === 'email';
                        const on = isEmail ? !!emailInfo.prefs[row.type] : channels[row.type][c.id];
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`${row.title} in ${c.label}`}
                            disabled={isEmail && !emailInfo.available}
                            title={isEmail && !emailInfo.available ? 'Email is not set up on the server' : undefined}
                            className={`ck${on ? ' on' : ''}`}
                            onClick={() =>
                              isEmail ? toggleEmail(row.type, !on) : toggleChannel(row.type, c.id, !on)
                            }
                          >
                            {on ? '\u2713' : ''}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {emailError && <p className="form-error" style={{ marginTop: 10 }}>{emailError}</p>}
                <p className="panel-sub" style={{ margin: '10px 0 0' }}>
                  {emailInfo.available
                    ? `Emails are sent to ${user.email}. Email is opt-in, so Enable all leaves it off.`
                    : 'Email is not set up on the server yet, so the Email column is switched off.'}
                </p>

                <p className="panel-sub" style={{ margin: '22px 0 8px' }}>
                  Remind me before a card is due
                </p>
                <div className="seg">
                  {REMIND_LEAD_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`seg-opt${lead === o.value ? ' on' : ''}`}
                      onClick={() => chooseLead(o.value)}
                      aria-pressed={lead === o.value}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="panel-sub" style={{ margin: '8px 0 0' }}>
                  Used by the quick reminder button on cards that have a due date.
                </p>
              </section>
            )}
          </div>

          <aside className="settings-aside">
            <div className="tip-card">
              <span className="tip-icon"><info.Icon size={26} /></span>
              <h3>{info.tipTitle}</h3>
              <p>{info.tip}</p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}