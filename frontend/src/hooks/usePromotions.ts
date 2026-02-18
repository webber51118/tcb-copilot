import { useState, useEffect } from 'react';
import { fetchActivePromotions } from '../services/api';
import type { Promotion } from '../types';

/** 取得進行中節日活動 */
export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePromotions()
      .then(setPromotions)
      .catch(() => setPromotions([]))
      .finally(() => setLoading(false));
  }, []);

  return { promotions, loading };
}
