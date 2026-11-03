const THEME_KEY = 'theme';
const TOAST_KEY = 'pref:toasts';
const NOTIFY_PREFIX = 'pref:notify:';

// Types of notifications the user can turn on or off
export const NOTIFY_TYPES = ['reminder', 'comment', 'move', 'invite', 'mention', 'assignment'];

// ---------- Theme: 'light', 'dark' or 'system' ----------
export function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'dark' || saved === 'system' ? saved : 'light';
}

function systemIsDark() {
  return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// The theme actually shown on screen ('light' or 'dark')
export function resolvedTheme() {
  const theme = getTheme();
  if (theme === 'system') return systemIsDark() ? 'dark' : 'light';
  return theme;
}

let watchingSystem = false;

export function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
  applyPreferences();

  // Follow the computer's light/dark setting live while 'system' is chosen
  if (!watchingSystem && window.matchMedia) {
    watchingSystem = true;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getTheme() === 'system') {
        document.documentElement.dataset.theme = resolvedTheme();
        window.dispatchEvent(new Event('themechange'));
      }
    });
  }
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  // Lets the navbar toggle update its icon
  window.dispatchEvent(new Event('themechange'));
}

// ---------- Popup toasts (master switch) ----------
export function toastsEnabled() {
  return localStorage.getItem(TOAST_KEY) !== 'off';
}

export function setToastsEnabled(on) {
  localStorage.setItem(TOAST_KEY, on ? 'on' : 'off');
}

// ---------- Notification channels ----------
// Channels: 'bell' (the dropdown history), 'toast' (popup) and 'email' (needs server email setup)
export const CHANNELS = ['bell', 'toast', 'email'];

export function channelEnabled(type, channel) {
  const saved = localStorage.getItem(`pref:channel:${type}:${channel}`);
  if (saved !== null) return saved === 'on';
  if (channel === 'email') return false; // off until email sending exists
  // Older single switch from the first version of the settings page
  return localStorage.getItem(NOTIFY_PREFIX + type) !== 'off';
}

export function setChannelEnabled(type, channel, on) {
  localStorage.setItem(`pref:channel:${type}:${channel}`, on ? 'on' : 'off');
}

// Turn every bell and toast switch on or off at once (email is left alone)
export function setAllChannels(on) {
  NOTIFY_TYPES.forEach((type) => {
    setChannelEnabled(type, 'bell', on);
    setChannelEnabled(type, 'toast', on);
  });
}

// Kept for older code: is this type shown in the bell?
export function notifyEnabled(type) {
  return channelEnabled(type, 'bell');
}

// ---------- Reminder lead time (minutes before a card is due) ----------
export const REMIND_LEAD_OPTIONS = [
  { value: 0, label: 'At due time', phrase: "when it is due" },
  { value: 5, label: '5 min', phrase: '5 minutes before it is due' },
  { value: 15, label: '15 min', phrase: '15 minutes before it is due' },
  { value: 60, label: '1 hour', phrase: '1 hour before it is due' },
  { value: 1440, label: '1 day', phrase: '1 day before it is due' },
];

export function getRemindLead() {
  const value = Number(localStorage.getItem('pref:remindLead'));
  return REMIND_LEAD_OPTIONS.some((o) => o.value === value) ? value : 0;
}

export function setRemindLead(value) {
  localStorage.setItem('pref:remindLead', String(value));
}

// ---------- Look and accessibility preferences ----------
export const ACCENTS = [
  { id: 'yellow', label: 'Yellow', color: '#fcd34d' },
  { id: 'indigo', label: 'Indigo', color: '#818cf8' },
  { id: 'teal', label: 'Teal', color: '#2dd4bf' },
  { id: 'pink', label: 'Pink', color: '#f472b6' },
  { id: 'blue', label: 'Blue', color: '#60a5fa' },
  { id: 'orange', label: 'Orange', color: '#fb923c' },
];

export const TEXT_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'default', label: 'Default' },
  { id: 'large', label: 'Large' },
];

function readFlag(key, fallback) {
  const saved = localStorage.getItem(key);
  if (saved === 'on') return true;
  if (saved === 'off') return false;
  return fallback;
}

function writeFlag(key, on) {
  localStorage.setItem(key, on ? 'on' : 'off');
  applyPreferences();
}

export function getAccent() {
  const saved = localStorage.getItem('pref:accent');
  return ACCENTS.some((a) => a.id === saved) ? saved : 'yellow';
}

export function setAccent(id) {
  localStorage.setItem('pref:accent', id);
  applyPreferences();
}

export function getTextSize() {
  const saved = localStorage.getItem('pref:textSize');
  return TEXT_SIZES.some((t) => t.id === saved) ? saved : 'default';
}

export function setTextSize(id) {
  localStorage.setItem('pref:textSize', id);
  applyPreferences();
}

export const reduceMotionEnabled = () => readFlag('pref:reduceMotion', false);
export const setReduceMotion = (on) => writeFlag('pref:reduceMotion', on);

export const highContrastEnabled = () => readFlag('pref:highContrast', false);
export const setHighContrast = (on) => writeFlag('pref:highContrast', on);

export const compactCardsEnabled = () => readFlag('pref:compactCards', false);
export const setCompactCards = (on) => writeFlag('pref:compactCards', on);

export const showBadgesEnabled = () => readFlag('pref:showBadges', true);
export const setShowBadges = (on) => writeFlag('pref:showBadges', on);

// Puts every look preference on the page's root element, where the CSS reads it
export function applyPreferences() {
  const root = document.documentElement;
  root.dataset.accent = getAccent();
  root.dataset.textSize = getTextSize();
  root.dataset.reduceMotion = reduceMotionEnabled() ? 'true' : 'false';
  root.dataset.contrast = highContrastEnabled() ? 'high' : 'normal';
  root.dataset.compact = compactCardsEnabled() ? 'true' : 'false';
  root.dataset.badges = showBadgesEnabled() ? 'on' : 'off';
}

// ---------- Board and task behavior ----------
export function newCardPosition() {
  return localStorage.getItem('pref:newCardPosition') === 'top' ? 'top' : 'bottom';
}

export function setNewCardPosition(where) {
  localStorage.setItem('pref:newCardPosition', where === 'top' ? 'top' : 'bottom');
}

export const confirmDeleteEnabled = () => readFlag('pref:confirmDelete', true);
export const setConfirmDelete = (on) => writeFlag('pref:confirmDelete', on);

export const assignToMeEnabled = () => readFlag('pref:assignToMe', false);
export const setAssignToMe = (on) => writeFlag('pref:assignToMe', on);