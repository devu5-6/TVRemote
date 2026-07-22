import { dismissToast, publishToast } from './toastBus';
import { WIFI_OFF_MESSAGE } from './localNetwork';

const TOTAL_DURATION_MS = 5000;

/**
 * Shows an in-app toast banner pinned to the top of the screen for 5 seconds.
 * Sticky Wi‑Fi toasts use showWifiOffToast() instead.
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

/** Stays visible until clearWifiOffToast() when Wi‑Fi is back. */
export function showWifiOffToast(): void {
  publishToast(WIFI_OFF_MESSAGE, 'error', 0);
}

export function clearWifiOffToast(): void {
  dismissToast(WIFI_OFF_MESSAGE);
}
