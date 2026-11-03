// The logo intro plays once per browser session, and never for people who asked for less motion.
export const INTRO_KEY = 'kanvio:introSeen';

export function shouldPlayIntro() {
  try {
    if (sessionStorage.getItem(INTRO_KEY)) return false;
  } catch {
    // storage blocked: just play it
  }
  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const turnedOff = document.documentElement.dataset.reduceMotion === 'true';
  return !prefersReduced && !turnedOff;
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    // ignore
  }
}