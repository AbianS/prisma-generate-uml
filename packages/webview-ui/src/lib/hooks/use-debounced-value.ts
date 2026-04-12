import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after
 * `delayMs` milliseconds of inactivity.
 *
 * Cleanup: the useEffect return clears the pending timer on unmount
 * and on every value change, preventing setState calls on unmounted
 * components and ensuring the delay resets on each new value.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
