import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'subli_om:ui:';

export function readUiState<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeUiState(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (cause) {
    void cause;
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  revive: (raw: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = readUiState<unknown>(key);
    return stored === null ? initial : revive(stored);
  });

  useEffect(() => {
    writeUiState(key, state);
  }, [key, state]);

  return [state, setState];
}
