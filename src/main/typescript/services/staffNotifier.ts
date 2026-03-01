/**
 * INPUT: LoanApplication（新送出的申請案件）
 * OUTPUT: LINE Push 通知 → 所有設定在 STAFF_LINE_USER_IDS 的行員
 * POS: 服務層，行員新案件通知
 *
 * 使用方式：
 *   在 .env 設定 STAFF_LINE_USER_IDS=Uabc123,Udef456（逗號分隔）
 *   每筆新申請提交後呼叫 pushStaffNewCaseNotification(application)
 */

import { lineClient } from '../core/lineClient';
import { LoanApplication } from '../models/types';
import { LoanType } from '../models/enums';

// ── 常數 ─────────────────────────────────────────────────────────
const WHITE   = '#FFFFFF';
const LIGHT   = '#F0F6FF';
const BORDER  = '#E2E8F0';
const BLUE    = '#1B4F8A';
const LABEL   = '#64748B';
const VALUE   = '#1E293B';
const ORANGE  = '#D97706';   // 「新案件」badge 顏色
const GREEN   = '#166534';   // 「MyData 已備齊」

// ── 讀取行員 LINE User ID 清單 ───────────────────────────────────
function getStaffUserIds(): string[] {
  const raw = process.env.STAFF_LINE_USER_IDS || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.startsWith('U') && id.length > 10);
}

// ── 格式化輔助 ───────────────────────────────────────────────────
function loanTypeLabel(lt: LoanType | null): string {
  if (lt === LoanType.MORTGAGE) return '🏠 房屋貸款';
  if (lt === LoanType.REVERSE_ANNUITY) return '🌸 以房養老';
  return '💳 信用貸款';
}

function fmt(n: number | null | undefined, unit = ''): string {
  if (n == null) return '—';
  return `${n.toLocaleString('zh-TW')}${unit}`;
}

// ── 建立行員通知 Flex Message ─────────────────────────────────────
function buildStaffNotifyFlex(app: LoanApplication): Record<string, unknown> {
  const isMortgage =
    app.loanType === LoanType.MORTGAGE || app.loanType === LoanType.REVERSE_ANNUITY;

  const rows: Array<Record<string, unknown>> = [
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '案件編號', size: 'sm', color: LABEL, flex: 4 },
        { type: 'text', text: app.id, size: 'sm', color: BLUE, weight: 'bold', flex: 6, wrap: true },
      ],
    },
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '申請人', size: 'sm', color: LABEL, flex: 4 },
        { type: 'text', text: app.applicantName || '（未填）', size: 'sm', color: VALUE, weight: 'bold', flex: 6 },
      ],
    },
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '聯絡電話', size: 'sm', color: LABEL, flex: 4 },
        { type: 'text', text: app.applicantPhone || '（未填）', size: 'sm', color: VALUE, flex: 6 },
      ],
    },
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '貸款類型', size: 'sm', color: LABEL, flex: 4 },
        { type: 'text', text: loanTypeLabel(app.loanType), size: 'sm', color: VALUE, flex: 6 },
      ],
    },
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '申貸金額', size: 'sm', color: LABEL, flex: 4 },
        {
          type: 'text',
          text: app.basicInfo.amount ? `NT$ ${fmt(app.basicInfo.amount)} 元` : '—',
          size: 'sm', color: BLUE, weight: 'bold', flex: 6,
        },
      ],
    },
    {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '年限／收入', size: 'sm', color: LABEL, flex: 4 },
        {
          type: 'text',
          text: `${fmt(app.basicInfo.termYears, ' 年')} ／ NT$ ${fmt(app.basicInfo.income, '/月')}`,
          size: 'sm', color: VALUE, flex: 6, wrap: true,
        },
      ],
    },
  ];

  // 房貸專屬：標的物資訊
  if (isMortgage && app.propertyInfo) {
    rows.push({
      type: 'separator', margin: 'md',
    });
    rows.push({
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: '標的物', size: 'sm', color: LABEL, flex: 4 },
        {
          type: 'text',
          text: [
            app.propertyInfo.buildingType,
            app.propertyInfo.floor ? `${app.propertyInfo.floor}F` : null,
            app.propertyInfo.areaPing ? `${app.propertyInfo.areaPing}坪` : null,
            app.propertyInfo.propertyAge != null ? `屋齡${app.propertyInfo.propertyAge}年` : null,
          ].filter(Boolean).join('・') || '—',
          size: 'sm', color: VALUE, flex: 6, wrap: true,
        },
      ],
    });
  }

  // 文件備齊狀態
  rows.push({ type: 'separator', margin: 'md' });
  rows.push({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: '文件狀態', size: 'sm', color: LABEL, flex: 4 },
      {
        type: 'text',
        text: app.mydataReady
          ? (app.landRegistryReady ? '✅ MyData + 謄本' : '✅ MyData 已備')
          : '⚠️ 文件待上傳',
        size: 'sm',
        color: app.mydataReady ? GREEN : ORANGE,
        weight: 'bold', flex: 6,
      },
    ],
  });

  const appliedTime = new Date(app.appliedAt).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: BLUE,
      paddingAll: '16px',
      contents: [
        {
          type: 'box', layout: 'horizontal', contents: [
            {
              type: 'text', text: '🔔 新案件通知', weight: 'bold', size: 'md', color: WHITE, flex: 1,
            },
            {
              type: 'box', layout: 'vertical', justifyContent: 'center',
              contents: [{
                type: 'text', text: '待審核', size: 'xs', color: WHITE, weight: 'bold',
                backgroundColor: ORANGE, paddingAll: '4px', cornerRadius: '6px',
              }],
            },
          ],
        },
        {
          type: 'text', text: `申請時間：${appliedTime}`,
          size: 'xs', color: 'rgba(255,255,255,0.7)', margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: WHITE,
      paddingAll: '16px',
      spacing: 'md',
      contents: rows,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: LIGHT,
      borderColor: BORDER,
      borderWidth: '1px',
      paddingAll: '12px',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: BLUE,
          height: 'sm',
          action: {
            type: 'message',
            label: '🔍 啟動徵審',
            text: `徵審 ${app.id}`,
          },
        },
        {
          type: 'text',
          text: `回覆「徵審 ${app.id}」可直接啟動 AI 徵審流程`,
          size: 'xxs',
          color: LABEL,
          align: 'center',
          wrap: true,
        },
      ],
    },
  };
}

// ── 主要 Export ──────────────────────────────────────────────────

/**
 * 推播新案件通知給所有行員
 * @param application 剛建立的貸款申請案件
 */
export async function pushStaffNewCaseNotification(application: LoanApplication): Promise<void> {
  const staffIds = getStaffUserIds();

  if (staffIds.length === 0) {
    console.warn('[staffNotifier] STAFF_LINE_USER_IDS 未設定，略過行員通知');
    return;
  }

  const flex = buildStaffNotifyFlex(application);
  const altText = `🔔 新案件：${application.applicantName || '申請人'} ` +
    `｜${loanTypeLabel(application.loanType)}` +
    `｜NT$ ${application.basicInfo.amount?.toLocaleString() ?? '—'}` +
    `｜案件編號 ${application.id}`;

  const message = {
    type: 'flex' as const,
    altText,
    contents: flex as Parameters<typeof lineClient.pushMessage>[0]['messages'][0] extends { contents: infer C } ? C : never,
  };

  // 逐一推播（避免單一失敗影響其他行員）
  await Promise.allSettled(
    staffIds.map(async (userId) => {
      try {
        await lineClient.pushMessage({
          to: userId,
          messages: [message as unknown as Parameters<typeof lineClient.pushMessage>[0]['messages'][0]],
        });
        console.log(`[staffNotifier] 已通知行員 ${userId}：案件 ${application.id}`);
      } catch (err) {
        console.error(`[staffNotifier] 推播至 ${userId} 失敗:`, err);
      }
    }),
  );
}
