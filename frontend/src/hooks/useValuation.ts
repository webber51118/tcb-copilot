import { useState, useCallback } from 'react';
import { callAutoValuate, callXGBoostAutoValuate } from '../services/api';
import type { AutoValuateResponse, XGBoostAutoValuateResponse } from '../types';

type LoadingStep = 'parsing' | 'valuating' | null;

interface ValuationState {
  data: AutoValuateResponse | null;
  loading: boolean;
  loadingStep: LoadingStep;
  error: string | null;
}

export function useValuation() {
  const [state, setState] = useState<ValuationState>({
    data: null,
    loading: false,
    loadingStep: null,
    error: null,
  });

  const runValuation = useCallback(
    async (
      imageBase64: string | null,
      params: {
        region: string;
        buildingType: string;
        areaPing: number;
        propertyAge: number;
        floor: number;
        layout: string;
        hasParking: boolean;
        loanAmount: number;
      },
    ) => {
      setState({ data: null, loading: true, loadingStep: imageBase64 ? 'parsing' : 'valuating', error: null });

      try {
        if (imageBase64) {
          // 給前端時間顯示「解析謄本」狀態
          await new Promise((r) => setTimeout(r, 300));
          setState((s) => ({ ...s, loadingStep: 'valuating' }));
        }

        const data = await callAutoValuate(imageBase64, params);
        setState({ data, loading: false, loadingStep: null, error: null });
        return data;
      } catch (err: any) {
        const message =
          err?.response?.status === 503
            ? '鑑價引擎暫時離線，請稍後再試'
            : err?.response?.data?.message || '鑑價服務發生錯誤，請稍後再試';
        setState({ data: null, loading: false, loadingStep: null, error: message });
        return null;
      }
    },
    [],
  );

  const runXGBoostValuation = useCallback(
    async (
      imageBase64: string | null,
      params: {
        district:     string;
        buildingType: string;
        areaPing:     number;
        propertyAge:  number;
        floor:        number;
        totalFloors:  number;
        layout:       string;
        hasParking:   boolean;
        loanAmount:   number;
      },
    ): Promise<XGBoostAutoValuateResponse | null> => {
      setState({ data: null, loading: true, loadingStep: imageBase64 ? 'parsing' : 'valuating', error: null });

      try {
        if (imageBase64) {
          await new Promise((r) => setTimeout(r, 300));
          setState((s) => ({ ...s, loadingStep: 'valuating' }));
        }

        const data = await callXGBoostAutoValuate(imageBase64, params);
        setState({ data: null, loading: false, loadingStep: null, error: null });
        return data;
      } catch (err: any) {
        const message =
          err?.response?.status === 503
            ? err?.response?.data?.message || 'XGBoost 鑑價引擎暫時離線，請稍後再試'
            : err?.response?.data?.message || '鑑價服務發生錯誤，請稍後再試';
        setState({ data: null, loading: false, loadingStep: null, error: message });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, loadingStep: null, error: null });
  }, []);

  return { ...state, runValuation, runXGBoostValuation, reset };
}
