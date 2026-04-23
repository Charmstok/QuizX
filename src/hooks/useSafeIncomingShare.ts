import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  clearSharedPayloads,
  getResolvedSharedPayloadsAsync,
  getSharedPayloads,
} from '../vendor/expoSharing';
import type { ResolvedSharePayload, SharePayload } from '../vendor/expoSharing';

type UseSafeIncomingShareResult = {
  sharedPayloads: SharePayload[];
  resolvedSharedPayloads: ResolvedSharePayload[];
  clearSharedPayloads: () => void;
  isResolving: boolean;
  error: Error | null;
  refreshSharePayloads: () => void;
};

function sharePayloadsAreEqual(a: SharePayload[], b: SharePayload[]) {
  if (a.length !== b.length) {
    return false;
  }

  const counts = new Map<string, number>();
  const getKey = (item: SharePayload) => `${item.value}|${item.mimeType}|${item.shareType}`;

  for (const item of a) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  for (const item of b) {
    const key = getKey(item);
    const count = counts.get(key);

    if (!count) {
      return false;
    }

    counts.set(key, count - 1);
  }

  return true;
}

function normalizeIncomingShareError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

export function useSafeIncomingShare(): UseSafeIncomingShareResult {
  const [sharedPayloads, setSharedPayloads] = useState<SharePayload[]>([]);
  const [resolvedSharedPayloads, setResolvedSharedPayloads] = useState<ResolvedSharePayload[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const currentSharedDataRef = useRef<SharePayload[]>([]);

  const refreshSharePayloads = useCallback(() => {
    void (async () => {
      try {
        const nextSharedPayloads = getSharedPayloads();

        if (sharePayloadsAreEqual(nextSharedPayloads, currentSharedDataRef.current)) {
          return;
        }

        currentSharedDataRef.current = nextSharedPayloads;
        setSharedPayloads(nextSharedPayloads);
        setResolvedSharedPayloads([]);
        setError(null);

        if (nextSharedPayloads.length === 0) {
          setIsResolving(false);
          return;
        }

        setIsResolving(true);

        try {
          const resolvedPayloads = await getResolvedSharedPayloadsAsync();
          setResolvedSharedPayloads(resolvedPayloads);
        } catch (resolveError) {
          setError(
            normalizeIncomingShareError(resolveError, '分享文件解析失败。'),
          );
        } finally {
          setIsResolving(false);
        }
      } catch (readError) {
        currentSharedDataRef.current = [];
        setSharedPayloads([]);
        setResolvedSharedPayloads([]);
        setIsResolving(false);
        setError(
          normalizeIncomingShareError(readError, '读取分享文件失败。'),
        );
      }
    })();
  }, []);

  const clearIncomingSharePayloads = useCallback(() => {
    clearSharedPayloads();
    currentSharedDataRef.current = [];
    setSharedPayloads([]);
    setResolvedSharedPayloads([]);
    setIsResolving(false);
    setError(null);
  }, []);

  useEffect(() => {
    refreshSharePayloads();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshSharePayloads();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshSharePayloads]);

  return {
    sharedPayloads,
    resolvedSharedPayloads,
    clearSharedPayloads: clearIncomingSharePayloads,
    isResolving,
    error,
    refreshSharePayloads,
  };
}
