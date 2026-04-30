/**
 * INPUT: 訂閱者清單（marketSubscriberStore）
 * OUTPUT: 不動產市場週報 Flex 訊息推播
 * POS: 服務層，每週一 09:00 自動推播台灣房市行情給已訂閱客戶
 */

import { lineClient } from '../core/lineClient';
import { getAllSubscribers } from '../config/marketSubscriberStore';

// ─── 型別 ────────────────────────────────────────────────────────────────────

interface MarketData {
  weekLabel: string;          // e.g. "2026 第 18 週（5/4–5/10）"
  mortgageRate: string;       // e.g. "2.06%"
  mortgageRateTrend: string;  // e.g. "▲+0.01" / "▼-0.01" / "─ 持平"
  mortgageRateColor: string;  // 趨勢顏色
  avgPricePerPing: string;    // e.g. "42.5萬/坪"
  priceChange: string;        // e.g. "▼-0.3%" / "▲+1.2%"
  priceChangeColor: string;
  hotDistrict: string;        // e.g. "大安區、信義區"
  inventoryDays: string;      // e.g. "42天"
  tip: string;                // 本週策略小提醒
}

// ─── 輪播資料集（4 週循環，模擬真實市場波動）────────────────────────────────

const MARKET_DATASETS: MarketData[] = [
  {
    weekLabel: '',
    mortgageRate: '2.06%',
    mortgageRateTrend: '▲ +0.01',
    mortgageRateColor: '#DC2626',
    avgPricePerPing: '42.5 萬/坪',
    priceChange: '▼ -0.3%',
    priceChangeColor: '#16A34A',
    hotDistrict: '大安區、信義區',
    inventoryDays: '42 天',
    tip: '央行利率維持高檔，建議優先評估固定利率方案，鎖定還款成本。',
  },
  {
    weekLabel: '',
    mortgageRate: '2.06%',
    mortgageRateTrend: '─ 持平',
    mortgageRateColor: '#64748B',
    avgPricePerPing: '42.3 萬/坪',
    priceChange: '▼ -0.5%',
    priceChangeColor: '#16A34A',
    hotDistrict: '中正區、松山區',
    inventoryDays: '45 天',
    tip: '雙北市均價連兩週下修，自住型買方可留意優質屋主釋出物件。',
  },
  {
    weekLabel: '',
    mortgageRate: '2.07%',
    mortgageRateTrend: '▲ +0.01',
    mortgageRateColor: '#DC2626',
    avgPricePerPing: '42.8 萬/坪',
    priceChange: '▲ +1.2%',
    priceChangeColor: '#DC2626',
    hotDistrict: '新店區、板橋區',
    inventoryDays: '38 天',
    tip: '新北捷運沿線需求回溫，若有購屋計畫建議盡早啟動試算，把握目前利率窗口。',
  },
  {
    weekLabel: '',
    mortgageRate: '2.05%',
    mortgageRateTrend: '▼ -0.02',
    mortgageRateColor: '#16A34A',
    avgPricePerPing: '42.1 萬/坪',
    priceChange: '─ 持平',
    priceChangeColor: '#64748B',
    hotDistrict: '內湖區、南港區',
    inventoryDays: '48 天',
    tip: '利率小幅下修，庫存天數上升代表議價空間略增，是換屋族的好時機。',
  },
];

/** 取得本週市場資料（依當前週數輪播） */
function getWeeklyMarketData(): MarketData {
  const now = new Date();
  const weekNum = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const dataset = MARKET_DATASETS[weekNum % MARKET_DATASETS.length]!;

  // 產生週標籤
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const fullWeekNum = weekNum + 1;
  dataset.weekLabel = `${now.getFullYear()} 第 ${fullWeekNum} 週（${fmt(monday)}–${fmt(sunday)}）`;

  return dataset;
}

// ─── Flex 建構 ───────────────────────────────────────────────────────────────

const DARK_BLUE  = '#1B4F8A';
const NAVY       = '#0F3460';
const GOLD       = '#B45309';
const LIGHT_BLUE = '#EFF6FF';
const WHITE      = '#FFFFFF';
const BORDER     = '#DBEAFE';
const MUTED      = '#64748B';

/** 建立不動產市場週報 Flex 訊息 */
export function buildMarketInfoFlex(data: MarketData): Record<string, unknown> {
  const row = (label: string, value: string, valueColor = '#1E293B') => ({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    paddingTop: '6px', paddingBottom: '6px',
    contents: [
      { type: 'text', text: label, size: 'sm', color: MUTED, flex: 5, wrap: false },
      { type: 'text', text: value, size: 'sm', color: valueColor, weight: 'bold', flex: 5, align: 'end' },
    ],
  });

  return {
    type: 'flex',
    altText: `🏘 合庫房市週報 ${data.weekLabel}｜房貸利率 ${data.mortgageRate}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: NAVY, paddingAll: '16px',
        contents: [
          {
            type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🏘', size: '3xl', flex: 1 },
              {
                type: 'box', layout: 'vertical', flex: 9, contents: [
                  { type: 'text', text: '合庫 ✦ 房市週報', weight: 'bold', size: 'lg', color: WHITE },
                  { type: 'text', text: data.weekLabel, size: 'xs', color: '#93C5FD', margin: 'xs' },
                ],
              },
            ],
          },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', backgroundColor: WHITE, paddingAll: '16px', spacing: 'none',
        contents: [
          // 利率區塊
          {
            type: 'box', layout: 'vertical', backgroundColor: LIGHT_BLUE,
            cornerRadius: '8px', paddingAll: '12px', margin: 'none',
            contents: [
              { type: 'text', text: '📊 本週房貸利率', weight: 'bold', size: 'sm', color: DARK_BLUE },
              {
                type: 'box', layout: 'horizontal', margin: 'sm', contents: [
                  { type: 'text', text: data.mortgageRate, weight: 'bold', size: 'xxl', color: DARK_BLUE, flex: 5 },
                  {
                    type: 'box', layout: 'vertical', flex: 5, justifyContent: 'center', contents: [
                      { type: 'text', text: data.mortgageRateTrend, size: 'sm', color: data.mortgageRateColor, align: 'end', weight: 'bold' },
                      { type: 'text', text: '較上週', size: 'xs', color: MUTED, align: 'end' },
                    ],
                  },
                ],
              },
            ],
          },
          { type: 'separator', margin: 'md', color: BORDER },
          // 行情指標
          {
            type: 'box', layout: 'vertical', margin: 'md', spacing: 'none',
            contents: [
              { type: 'text', text: '📈 市場行情指標', weight: 'bold', size: 'sm', color: DARK_BLUE, marginBottom: '8px' },
              row('台北市均價', data.avgPricePerPing),
              { type: 'separator', margin: 'xs', color: BORDER },
              row('週漲跌幅', data.priceChange, data.priceChangeColor),
              { type: 'separator', margin: 'xs', color: BORDER },
              row('熱門區域', data.hotDistrict, GOLD),
              { type: 'separator', margin: 'xs', color: BORDER },
              row('平均在售天數', data.inventoryDays),
            ],
          },
          { type: 'separator', margin: 'md', color: BORDER },
          // 策略小提醒
          {
            type: 'box', layout: 'vertical', margin: 'md',
            backgroundColor: '#FFFBEB', cornerRadius: '8px', paddingAll: '12px',
            contents: [
              { type: 'text', text: '💡 本週策略', weight: 'bold', size: 'sm', color: GOLD },
              { type: 'text', text: data.tip, size: 'xs', color: '#78350F', wrap: true, margin: 'sm' },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', backgroundColor: LIGHT_BLUE, paddingAll: '12px', spacing: 'sm',
        contents: [
          {
            type: 'button', style: 'primary', color: DARK_BLUE, height: 'sm',
            action: { type: 'message', label: '💰 立即試算房貸', text: '房貸' },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '取消訂閱市場資訊', text: '取消訂閱市場資訊' },
          },
        ],
      },
    },
  };
}

// ─── 推播主函式 ───────────────────────────────────────────────────────────────

/** 推播市場週報給所有訂閱者，回傳成功/失敗筆數 */
export async function pushWeeklyMarket(): Promise<{ success: number; failed: number }> {
  const subscribers = getAllSubscribers();
  if (subscribers.length === 0) {
    console.log('[marketPush] 無訂閱者，略過本次推播');
    return { success: 0, failed: 0 };
  }

  const data = getWeeklyMarketData();
  const flex = buildMarketInfoFlex(data);
  let success = 0;
  let failed = 0;

  for (const userId of subscribers) {
    try {
      await lineClient.pushMessage({
        to: userId,
        messages: [flex as Parameters<typeof lineClient.pushMessage>[0]['messages'][0]],
      });
      success++;
    } catch (err) {
      console.error(`[marketPush] 推播失敗 userId=${userId}:`, err);
      failed++;
    }
  }

  console.log(`[marketPush] 週報推播完成：成功 ${success} / 失敗 ${failed}，週期：${data.weekLabel}`);
  return { success, failed };
}

// ─── 排程工具 ─────────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 計算距離下一個週一 09:00（台灣時間 UTC+8）的毫秒數 */
function msUntilNextMondayNine(): number {
  const now = new Date();
  // 轉換為台灣時間
  const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const twDay = twNow.getUTCDay(); // 0=Sun, 1=Mon
  const twHour = twNow.getUTCHours();
  const twMin  = twNow.getUTCMinutes();
  const twSec  = twNow.getUTCSeconds();
  const twMs   = twNow.getUTCMilliseconds();

  // 距離週一 09:00 的分鐘數
  const daysUntilMonday = twDay === 0 ? 1 : (8 - twDay) % 7 || 7;
  const targetMs =
    daysUntilMonday * 24 * 60 * 60 * 1000
    - twHour * 60 * 60 * 1000
    - twMin  * 60 * 1000
    - twSec  * 1000
    - twMs
    + 9 * 60 * 60 * 1000; // +9hr offset to reach 09:00

  return targetMs > 0 ? targetMs : targetMs + WEEK_MS;
}

/**
 * 啟動每週市場週報排程
 * 首次觸發：下一個週一 09:00（台灣時間）
 * 之後每 7 天執行一次
 */
export function startMarketPushScheduler(): void {
  const delay = msUntilNextMondayNine();
  const delayMin = Math.round(delay / 60_000);
  console.log(`[marketPush] 排程啟動，首次推播將於 ${delayMin} 分鐘後（週一 09:00 台灣時間）`);

  setTimeout(() => {
    void pushWeeklyMarket();
    setInterval(() => { void pushWeeklyMarket(); }, WEEK_MS);
  }, delay);
}
