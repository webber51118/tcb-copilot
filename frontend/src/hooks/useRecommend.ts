import { useState, useCallback } from 'react';
import { fetchRecommendation } from '../services/api';
import type { RecommendRequest, RecommendResponse } from '../types';

interface RecommendState {
  data: RecommendResponse | null;
  loading: boolean;
  error: string | null;
}

/** 呼叫推薦 API，回傳推薦產品與活動資訊 */
export function useRecommend() {
  const [state, setState] = useState<RecommendState>({
    data: null,
    loading: false,
    error: null,
  });

  const recommend = useCallback(async (request: RecommendRequest) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await fetchRecommendation(request);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err: any) {
      const message = err?.response?.data?.message || '推薦服務暫時無法使用，請稍後再試';
      setState({ data: null, loading: false, error: message });
      return null;
    }
  }, []);

  return { ...state, recommend };
}
