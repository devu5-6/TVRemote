export type ToastVariant = 'info' | 'success' | 'error';

export type ToastPayload = {
  id: number;
  message: string;
  variant: ToastVariant;
  /** 0 = sticky until dismissToast() — does not auto-hide. */
  durationMs: number;
};

type ShowListener = (toast: ToastPayload) => void;
type DismissListener = (message?: string) => void;

let nextId = 0;
const showListeners = new Set<ShowListener>();
const dismissListeners = new Set<DismissListener>();

let lastMessage: string | null = null;
let lastVariant: ToastVariant | null = null;
let lastPublishedAt = 0;
let lastDurationMs = 0;
let pendingToast: ToastPayload | null = null;

/**
 * Publish a toast. Identical message+variant within the previous toast's
 * lifetime is ignored so reconnect loops can't keep re-animating the banner.
 * If no banner is mounted yet, the toast is held until one subscribes.
 * Pass durationMs 0 for a sticky toast that stays until dismissToast().
 */
export function publishToast(message: string, variant: ToastVariant, durationMs: number): void {
  const now = Date.now();
  const dedupeWindow = durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY;
  if (
    message === lastMessage &&
    variant === lastVariant &&
    (durationMs === 0 || now - lastPublishedAt < dedupeWindow)
  ) {
    // Sticky already showing — keep it; timed toast still within window — skip.
    if (durationMs === 0 && lastDurationMs === 0) return;
    if (durationMs > 0) return;
  }

  nextId += 1;
  const toast: ToastPayload = { id: nextId, message, variant, durationMs };

  if (showListeners.size === 0) {
    pendingToast = toast;
    return;
  }

  lastMessage = message;
  lastVariant = variant;
  lastPublishedAt = now;
  lastDurationMs = durationMs;
  pendingToast = null;
  showListeners.forEach((listener) => listener(toast));
}

/** Dismiss the current toast. If message is set, only dismiss when it matches. */
export function dismissToast(message?: string): void {
  if (pendingToast && (!message || pendingToast.message === message)) {
    pendingToast = null;
  }
  if (message && lastMessage === message) {
    lastMessage = null;
    lastVariant = null;
    lastPublishedAt = 0;
    lastDurationMs = 0;
  } else if (!message) {
    lastMessage = null;
    lastVariant = null;
    lastPublishedAt = 0;
    lastDurationMs = 0;
  }
  dismissListeners.forEach((listener) => listener(message));
}

export function subscribeToToasts(listener: ShowListener): () => void {
  showListeners.add(listener);
  if (pendingToast) {
    const toast = pendingToast;
    pendingToast = null;
    lastMessage = toast.message;
    lastVariant = toast.variant;
    lastPublishedAt = Date.now();
    lastDurationMs = toast.durationMs;
    listener(toast);
  }
  return () => showListeners.delete(listener);
}

export function subscribeToToastDismiss(listener: DismissListener): () => void {
  dismissListeners.add(listener);
  return () => dismissListeners.delete(listener);
}
