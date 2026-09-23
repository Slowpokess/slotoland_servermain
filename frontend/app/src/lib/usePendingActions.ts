import { useCallback, useRef, useState } from 'react';

type AsyncAction<T> = () => Promise<T>;

export function usePendingActions() {
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const publish = useCallback(() => {
    setPending(new Set(pendingRef.current));
  }, []);

  const runPending = useCallback(async <T,>(key: string, action: AsyncAction<T>): Promise<T | undefined> => {
    if (pendingRef.current.has(key)) return undefined;

    pendingRef.current.add(key);
    publish();
    try {
      return await action();
    } finally {
      pendingRef.current.delete(key);
      publish();
    }
  }, [publish]);

  const isPending = useCallback((...keys: string[]): boolean => {
    return keys.some((key) => pending.has(key));
  }, [pending]);

  return { isPending, runPending };
}
