export type ToastVariant = 'info' | 'success' | 'error';

export type ToastPayload = {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

type Listener = (toast: ToastPayload) => void;

let nextId = 0;
const listeners = new Set<Listener>();

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishToast(message: string, variant: ToastVariant, durationMs: number): void {
  nextId += 1;
  const toast: ToastPayload = { id: nextId, message, variant, durationMs };
  listeners.forEach((listener) => listener(toast));
}
