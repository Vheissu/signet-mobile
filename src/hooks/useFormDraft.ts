/**
 * useFormDraft Hook
 *
 * Auto-saves and auto-restores form state to secure storage.
 * Useful for preserving user input across navigation or app backgrounding.
 *
 * Usage:
 *   const { values, setValues, clearDraft, loaded } = useFormDraft('send', {
 *     recipient: '', amount: '', currency: 'HIVE', memo: '',
 *   });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { secureStorage } from '../core/storage/secure-storage';

const DEBOUNCE_MS = 500;

export function useFormDraft<T extends Record<string, any>>(
  page: string,
  initialValues: T,
) {
  const [values, setValues] = useState<T>(initialValues);
  const [loaded, setLoaded] = useState(false);
  const initialRef = useRef(initialValues);

  // Load draft on mount
  useEffect(() => {
    let cancelled = false;
    secureStorage.getFormDraft(page).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setValues({ ...initialRef.current, ...draft } as T);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // Debounced save on value changes
  useEffect(() => {
    if (!loaded) return;

    const timer = setTimeout(() => {
      secureStorage.setFormDraft(page, values);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [values, loaded, page]);

  const clearDraft = useCallback(() => {
    secureStorage.clearFormDraft(page);
  }, [page]);

  return { values, setValues, clearDraft, loaded };
}

export default useFormDraft;
