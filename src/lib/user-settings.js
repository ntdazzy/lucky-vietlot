// ============================================================================
// USER SETTINGS — localStorage-backed user preferences (client-only)
// ----------------------------------------------------------------------------
// Single-user app. Settings persist per-browser.
// ============================================================================

const KEY = 'vietlott-pro-settings';

const DEFAULTS = {
    soundEnabled: true,           // Play sound on prize notifications
    soundVolume: 0.5,             // 0..1
    browserNotifications: false,  // Use Notification API (system tray)
    pollIntervalSec: 25,          // NotificationListener poll interval
    ticketSortMode: 'newest',     // newest | oldest | tier | match
    confirmGenerate: false,       // Ask before regenerating (lose unconfirmed pick)
};

function isClient() {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getSettings() {
    if (!isClient()) return { ...DEFAULTS };
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    } catch {
        return { ...DEFAULTS };
    }
}

export function setSettings(partial) {
    if (!isClient()) return;
    const current = getSettings();
    const next = { ...current, ...partial };
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
        // Notify other components/tabs
        window.dispatchEvent(new CustomEvent('vietlott-settings-changed', { detail: next }));
    } catch {}
    return next;
}

export function resetSettings() {
    if (!isClient()) return;
    try {
        localStorage.removeItem(KEY);
        window.dispatchEvent(new CustomEvent('vietlott-settings-changed', { detail: DEFAULTS }));
    } catch {}
    return { ...DEFAULTS };
}

export function getDefaults() { return { ...DEFAULTS }; }
