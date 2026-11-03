import { useCallback, useEffect, useRef } from 'react';

// Particles that burst out when the icon completes: [x, y, size] in px
const PARTICLES = [
  [-86, -58, 6], [78, -66, 5], [96, 6, 7], [70, 72, 5],
  [-6, 92, 6], [-74, 70, 5], [-98, 8, 7], [14, -92, 4],
];

// The 2 second logo intro from the storyboard. Everything is CSS (see "Logo intro" in index.css),
// timed on one 2s clock: bars 0.0s, slide 0.2s, symbol 0.5s, compass 0.8s,
// box 1.1s, particles 1.3s, text 1.5s, settle 1.7s, hold 1.9s, then a circular reveal.
export default function LogoIntro({ onDone }) {
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // no scrolling behind the intro
    const failsafe = setTimeout(finish, 4000); // in case the animation event never arrives
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(failsafe);
    };
  }, [finish]);

  return (
    <div
      className="li-overlay"
      onClick={finish}
      onAnimationEnd={(e) => e.animationName === 'li-reveal' && finish()}
    >
      <div className="li-scale">
        <div className="li-lockup">
          <div className="li-icon">
            <svg className="li-ring" viewBox="-110 -110 220 220" aria-hidden="true">
              <g className="li-cross">
                <line x1="-104" y1="0" x2="104" y2="0" />
                <line x1="0" y1="-104" x2="0" y2="104" />
              </g>
              <circle className="li-circle" r="70" />
              <g className="li-orbit">
                <circle className="li-dot" cx="70" cy="0" r="4.5" />
              </g>
            </svg>

            <div className="li-box" />
            <div className="li-bar li-bar-l" />
            <div className="li-bar li-bar-r" />
            <div className="li-pill li-pill-l" />
            <div className="li-pill li-pill-r" />

            {PARTICLES.map(([x, y, s], i) => (
              <span
                key={i}
                className="li-p"
                style={{ '--dx': `${x}px`, '--dy': `${y}px`, width: s, height: s }}
              />
            ))}
          </div>

          <div className="li-word">
            <span>Kanvio</span>
          </div>
        </div>
      </div>

      <button type="button" className="li-skip" onClick={finish}>
        Skip
      </button>
    </div>
  );
}