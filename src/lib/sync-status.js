// ============================================================================
// SYNC STATE — Single-process coordination for /sync-all
// ----------------------------------------------------------------------------
// Uses a generation counter so a NEW /syncall doesn't accidentally un-cancel
// the previous one. Each sync grabs a token; checks isCancelled(token).
// Only valid within ONE Node process (Railway single-replica). For multi-
// replica, this state needs to move to SQLite or Redis.
// ============================================================================

let _generation = 0;
let _running = false;
let _cancelGeneration = -1;
let _currentToken = null;
let _startedAt = null;

export function acquireSyncToken() {
    if (_running) return null;          // Refuse concurrent syncs
    _generation++;
    _running = true;
    _currentToken = _generation;
    _startedAt = Date.now();
    return _currentToken;
}

export function releaseSyncToken(token) {
    if (_currentToken === token) {
        _running = false;
        _currentToken = null;
        _startedAt = null;
    }
}

export function requestCancel() {
    if (_running && _currentToken !== null) {
        _cancelGeneration = _currentToken;
        return true;
    }
    return false;
}

export function isCancelled(token) {
    return _cancelGeneration === token;
}

export function getSyncStatus() {
    return {
        running: _running,
        token: _currentToken,
        startedAt: _startedAt,
        durationMs: _startedAt ? Date.now() - _startedAt : 0,
        cancelRequested: _cancelGeneration === _currentToken,
    };
}

// Legacy API — kept for backward compatibility with existing callers
export function isSyncCancelled() {
    return _cancelGeneration === _currentToken;
}

export function setSyncCancelled(value) {
    if (value) {
        requestCancel();
    } else {
        _cancelGeneration = -1;
    }
}
