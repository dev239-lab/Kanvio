import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconLayoutBoard,
  IconSquareCheck,
  IconCalendar,
  IconUsers,
  IconPlus,
  IconSearch,
  IconSettings,
  IconLogout,
  IconUser,
  IconSun,
  IconMoon,
  IconHelp,
  IconKeyboard,
  IconRocket,
  IconInfoCircle,
} from '@tabler/icons-react';
import useAuth from '../hooks/useAuth';
import useClickOutside from '../hooks/useClickOutside';
import NewBoardModal from './NewBoardModal';
import NotificationBell from './NotificationBell';
import SearchModal from './SearchModal';
import HelpDialog from './HelpDialog';
import Avatar from './Avatar';
import { resolvedTheme, setTheme } from '../utils/preferences';
import ChatNavLink from './ChatNavLink';
import LogoMark from './LogoMark';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const LINKS = [
  { to: '/', label: 'Boards', Icon: IconLayoutBoard, match: (p) => p === '/' || p.startsWith('/board/') },
  { to: '/my-tasks', label: 'My tasks', Icon: IconSquareCheck, match: (p) => p.startsWith('/my-tasks') },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar, match: (p) => p.startsWith('/calendar') },
  { to: '/team', label: 'Team', Icon: IconUsers, match: (p) => p.startsWith('/team') },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [helpDialog, setHelpDialog] = useState(null); // 'shortcuts' | 'tips' | 'about'
  const [isDark, setIsDark] = useState(resolvedTheme() === 'dark');

  const menuRef = useRef(null);
  const helpRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  useClickOutside(menuRef, closeMenu);
  useClickOutside(helpRef, closeHelp);

  // Ctrl+K (or Cmd+K) opens search from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Keep the sun/moon icon correct when the theme changes (for example in Settings)
  useEffect(() => {
    const onTheme = () => setIsDark(resolvedTheme() === 'dark');
    window.addEventListener('themechange', onTheme);
    return () => window.removeEventListener('themechange', onTheme);
  }, []);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const toggleHelp = () => {
    setMenuOpen(false);
    setHelpOpen((o) => !o);
  };

  const toggleMenu = () => {
    setHelpOpen(false);
    setMenuOpen((o) => !o);
  };

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const openHelp = (kind) => {
    setHelpOpen(false);
    setHelpDialog(kind);
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
            <Link to="/" className="nav-brand">
    <LogoMark size={30} />
    Kanvio
  </Link>
            <WorkspaceSwitcher />

          <div className="nav-links">
            {LINKS.map(({ to, label, Icon, match }) => (
              <Link
                key={to}
                to={to}
                className={`nav-link${match(pathname) ? ' active' : ''}`}
                aria-current={match(pathname) ? 'page' : undefined}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            <ChatNavLink />
          </div>
        </div>

        <button className="search-trigger" onClick={() => setShowSearch(true)}>
          <IconSearch size={16} />
          <span>Search boards and cards...</span>
        </button>

        <div className="nav-right">
          <button className="btn-small" onClick={() => setShowNew(true)}>
            <IconPlus size={16} /> New board
          </button>

          <div className="menu-wrap" ref={helpRef}>
            <button
              className="icon-btn"
              onClick={toggleHelp}
              aria-label="Help"
              aria-haspopup="menu"
              aria-expanded={helpOpen}
              title="Help"
            >
              <IconHelp size={22} />
            </button>

            {helpOpen && (
              <div className="menu" role="menu">
                <div className="menu-label">Help</div>
                <button className="menu-item" onClick={() => openHelp('shortcuts')}>
                  <IconKeyboard size={18} /> Keyboard shortcuts
                </button>
                <button className="menu-item" onClick={() => openHelp('tips')}>
                  <IconRocket size={18} /> Getting started tips
                </button>
                <button className="menu-item" onClick={() => openHelp('about')}>
                  <IconInfoCircle size={18} /> About Kanvio
                </button>
              </div>
            )}
          </div>

          <button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <IconSun size={22} /> : <IconMoon size={22} />}
          </button>

          <NotificationBell />

          <div className="menu-wrap" ref={menuRef}>
            <button
              className="menu-trigger menu-trigger-avatar"
              onClick={toggleMenu}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar user={user} size={36} status />
            </button>

            {menuOpen && (
              <div className="menu" role="menu">
                <div className="menu-head">
                  <Avatar user={user} size={38} status />
                  <div>
                    <b>{user.name}</b>
                    <small>{user.email}</small>
                  </div>
                </div>

                <button className="menu-item" onClick={() => go('/settings/profile')}>
                  <IconUser size={18} /> My profile
                </button>
                <button className="menu-item" onClick={() => go('/settings/preferences')}>
                  <IconSettings size={18} /> Preferences
                </button>

                <div className="menu-sep" />
                <button
                  className="menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  <IconLogout size={18} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showNew && <NewBoardModal onClose={() => setShowNew(false)} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {helpDialog && <HelpDialog kind={helpDialog} onClose={() => setHelpDialog(null)} />}
    </>
  );
}