import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getCustomerInfo, addCustomerInfoListener, removeCustomerInfoListener, isPremiumFromCustomerInfo } from '@/lib/revenueCat';

interface PremiumState {
  premium: boolean;
  loading: boolean;
  info?: any;
}

export function usePremiumStatus(): PremiumState {
  const [state, setState] = useState<PremiumState>({ premium: false, loading: true });

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const user = auth.currentUser;
      if (!user?.uid) {
        if (!isMounted) return;
        setState({ premium: false, loading: false });
        return;
      }
      try {
        const info = await getCustomerInfo();
        if (!isMounted) return;
        setState({ premium: isPremiumFromCustomerInfo(info), loading: false, info });
      } catch {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    bootstrap();
    const sub = addCustomerInfoListener((info) => {
      if (!isMounted) return;
      setState({ premium: isPremiumFromCustomerInfo(info), loading: false, info });
    });

    return () => {
      isMounted = false;
      removeCustomerInfoListener(sub);
    };
  }, [auth.currentUser?.uid]);

  return state;
} 