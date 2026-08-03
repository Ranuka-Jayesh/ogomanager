const DEVICE_ID_KEY = 'ogo_device_id';

function generateDeviceId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `dev_${timePart}_${randomPart}`;
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const next = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    // Fallback if storage is unavailable.
    return generateDeviceId();
  }
}
