import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** A temporarily unknown launch state must not leave a visible screen permanently static. */
export function useForeground() {
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  return foreground;
}
