let syncCancelled = false;

export function isSyncCancelled() {
    return syncCancelled;
}

export function setSyncCancelled(value) {
    syncCancelled = value;
}
