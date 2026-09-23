export function loadString(key: string, fallback: string): string {
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value;
}

export function loadNumber(key: string, fallback: number): number {
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadJson<T>(key: string, fallback: T): T {
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function saveString(key: string, value: string): void {
  window.localStorage.setItem(key, value);
}

export function saveJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeString(key: string): void {
  window.localStorage.removeItem(key);
}

export function loadSessionString(key: string, fallback: string): string {
  const value = window.sessionStorage.getItem(key);
  return value === null ? fallback : value;
}

export function saveSessionString(key: string, value: string): void {
  if (value) {
    window.sessionStorage.setItem(key, value);
    return;
  }
  window.sessionStorage.removeItem(key);
}
