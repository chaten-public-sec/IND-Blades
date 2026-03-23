import { toast } from 'sonner';

/**
 * Centralized toast control to prevent duplicate notifications.
 * @type {Object.<string, boolean>}
 */
const activeToasts = {};

/**
 * Shows a toast notification with a debounce based on an action ID.
 * @param {'success' | 'error' | 'info' | 'warning'} type - The type of toast to show.
 * @param {string} message - The message to display.
 * @param {string} id - A unique ID for the action to prevent duplicates.
 */
export function showToast(type, message, id) {
  if (!id) {
    // Fallback if no ID is provided, but we should always provide one
    toast[type || 'info'](message);
    return;
  }

  if (activeToasts[id]) {
    return;
  }

  activeToasts[id] = true;

  // Use the requested type (sonner supports toast.success, toast.error, etc.)
  const toastFn = toast[type] || toast.info;
  toastFn(message);

  // 2s debounce as requested
  setTimeout(() => {
    delete activeToasts[id];
  }, 2000);
}
