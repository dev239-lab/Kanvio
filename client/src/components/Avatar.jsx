import { initials, avatarColor } from '../utils/avatar';
import { effectiveStatus } from '../utils/status';

// Shows the picture when there is one, otherwise the colored initials.
// Pass `status` to add the small status dot.
export default function Avatar({ user, name, image, size = 34, status = false }) {
  const shownName = user?.name ?? name ?? '';
  const shownImage = user?.avatarImage ?? image ?? '';
  const state = status && user ? effectiveStatus(user) : null;

  return (
    <span className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {shownImage ? (
        <img className="av-img" src={shownImage} alt={shownName} />
      ) : (
        <span className="av-initials" style={{ background: avatarColor(shownName) }}>
          {initials(shownName)}
        </span>
      )}
      {state && (
        <span
          className="av-dot"
          style={{
            background: state.color,
            width: Math.max(9, Math.round(size * 0.3)),
            height: Math.max(9, Math.round(size * 0.3)),
          }}
          title={state.message ? `${state.label}: ${state.message}` : state.label}
        />
      )}
    </span>
  );
}