/**
 * 後端 API 呼叫封裝（axios）
 */

import axios from 'axios';
import type { RecommendRequest, RecommendResponse, Promotion } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });

/** 取得推薦產品 */
export async function fetchRecommendation(data: RecommendRequest): Promise<RecommendResponse> {
  const res = await client.post<{ success: boolean; data: RecommendResponse }>('/api/recommend', data);
  return res.data.data;
}

/** 取得進行中活動 */
export async function fetchActivePromotions(): Promise<Promotion[]> {
  const res = await client.get<{ success: boolean; data: Promotion[] }>('/api/promotions/active');
  return res.data.data;
}

/** 上傳海報 base64，回傳可分享的 HTTPS URL（有效 30 分鐘） */
export async function uploadPoster(imageBase64: string): Promise<string> {
  const res = await client.post<{ success: boolean; imageUrl: string }>(
    '/api/poster-upload',
    { imageBase64 },
    { timeout: 30000 }, // 圖片較大，給予較長 timeout
  );
  return res.data.imageUrl;
}
