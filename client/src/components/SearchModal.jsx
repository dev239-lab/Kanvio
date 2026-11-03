import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconLayoutBoard, IconChecklist, IconClock } from '@tabler/icons-react';
import api from '../services/api';

const RECENT_KEY = 'recentSearches';

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(term) {
  const next = [term, ...loadRecent().filter((t) => t !== term)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// Wraps the matching part of a text in <mark>
function highlight(text, q) {
  if (!q) return text;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text)
    .split(new RegExp(`(${safe})`, 'ig'))
    .map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="search-mark">
          {part}
        </mark>
      ) : (
        part
      )
    );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'boards', label: 'Boards' },
  { id: 'cards', label: 'Cards' },
];

export default function SearchModal({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(loadRecent);
  const [data, setData] = useState({ q: '', boards: [], cards: [] });
  const q = query.trim();

  // Wait 250 ms after typing stops, then search
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .get('/search', { params: { q } })
        .then(({ data: res }) => {
          if (!cancelled) setData({ q, boards: res.boards, cards: res.cards });
        })
        .catch(() => {
          if (!cancelled) setData({ q, boards: [], cards: [] });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = q.length >= 2 && data.q === q;
  const loading = q.length >= 2 && !ready;

  const boardItems = ready
    ? data.boards.map((b) => ({
        key: `b-${b._id}`,
        type: 'board',
        title: b.title,
        sub: 'Board',
        boardId: b._id,
      }))
    : [];

  const cardItems = ready
    ? data.cards.map((c) => ({
        key: `c-${c._id}`,
        type: 'card',
        title: c.title,
        sub: `in ${c.boardTitle || 'board'}${c.listTitle ? ` · ${c.listTitle}` : ''}`,
        boardId: c.boardId,
      }))
    : [];

  const results = [
    ...(filter !== 'cards' ? boardItems : []),
    ...(filter !== 'boards' ? cardItems : []),
  ];

  const current = Math.min(active, Math.max(results.length - 1, 0));

  const open = (item) => {
    saveRecent(q);
    onClose();
    navigate(`/board/${item.boardId}`);
  };

  const pickRecent = (term) => {
    setQuery(term);
    setActive(0);
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(current + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === 'Enter' && results[current]) {
      open(results[current]);
    }
  };

  const countFor = (id) => {
    if (!ready) return null;
    if (id === 'boards') return boardItems.length;
    if (id === 'cards') return cardItems.length;
    return boardItems.length + cardItems.length;
  };

  return (
    <div className="dialog-backdrop search-backdrop" onMouseDown={onClose}>
      <div className="search-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <IconSearch size={20} />
          <input
            autoFocus
            placeholder="Search boards and cards..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className="kbd">Esc</span>
        </div>

        <div className="search-chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`search-chip${filter === f.id ? ' on' : ''}`}
              onClick={() => {
                setFilter(f.id);
                setActive(0);
              }}
            >
              {f.label}
              {countFor(f.id) !== null && <span className="search-chip-n">{countFor(f.id)}</span>}
            </button>
          ))}
        </div>

        <div className="search-results">
          {q.length < 2 && recent.length > 0 && (
            <>
              <div className="search-group search-recent-head">
                <span>Recent searches</span>
                <button type="button" className="link-btn" onClick={clearRecent}>
                  Clear
                </button>
              </div>
              {recent.map((term) => (
                <button
                  key={term}
                  type="button"
                  className="search-item"
                  onClick={() => pickRecent(term)}
                >
                  <span className="search-icon recent">
                    <IconClock size={16} />
                  </span>
                  <span className="search-text">{term}</span>
                </button>
              ))}
            </>
          )}

          {q.length < 2 && recent.length === 0 && (
            <p className="search-hint">Type at least 2 letters to search.</p>
          )}
          {loading && <p className="search-hint">Searching...</p>}
          {ready && results.length === 0 && (
            <p className="search-hint">
              No {filter === 'all' ? 'results' : filter} for "{q}".
            </p>
          )}

          {results.map((item, i) => (
            <div key={item.key}>
              {(i === 0 || results[i - 1].type !== item.type) && (
                <div className="search-group">{item.type === 'board' ? 'Boards' : 'Cards'}</div>
              )}
              <button
                className={`search-item${i === current ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(item)}
              >
                <span className={`search-icon ${item.type}`}>
                  {item.type === 'board' ? <IconLayoutBoard size={16} /> : <IconChecklist size={16} />}
                </span>
                <span className="search-text">
                  {highlight(item.title, q)}
                  <small>{item.sub}</small>
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="search-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> to move</span>
          <span><span className="kbd">Enter</span> to open</span>
        </div>
      </div>
    </div>
  );
}