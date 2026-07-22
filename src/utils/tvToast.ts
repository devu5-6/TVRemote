import { publishToast } from './toastBus';

const TOTAL_DURATION_MS = 10000;

/**
 * Shows an in-app toast banner pinned to the top of the screen for ~10
 * seconds. We used to re-issue ToastAndroid.show() every few seconds to fake
 * a longer duration, but Android has no way to merge those back-to-back
 * calls into one continuous banner - it replays the pop-in animation each
 * time, which looks like the same toast is repeatedly flashing for a single
 * action. A single controlled in-app banner avoids that and also lets
 * multiple almost-simultaneous calls (e.g. "Opening..." then an error a
 * moment later) replace each other cleanly instead of queuing up.
 */
export function showTvToast(message: string): void {
  publishToast(message, 'info', TOTAL_DURATION_MS);
}

export function showTvSuccessToast(message: string): void {
  publishToast(message, 'success', TOTAL_DURATION_MS);
}

export function showTvErrorToast(message: string): void {
  publishToast(message, 'error', TOTAL_DURATION_MS);
}
