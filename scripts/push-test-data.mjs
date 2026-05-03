// 重推測試資料到 Power BI（UTF-8 正確編碼）
// 執行：node scripts/push-test-data.mjs

const PUSH_URL = process.env.POWER_BI_PUSH_URL;

if (!PUSH_URL) {
  console.error('請先設定 POWER_BI_PUSH_URL 環境變數');
  process.exit(1);
}

const rows = [
  {
    ApplicationId: 'TEST-001',
    CustomerName: '測試王大明',
    LoanType: '房屋貸款',
    LoanAmount: 8000000,
    RecommendedProduct: '青安貸款',
    InterestRate: 1.565,
    MonthlyPayment: 22000,
    ValuationP50: 10000000,
    ValuationP5: 9200000,
    ValuationP95: 10800000,
    FraudScore: 12,
    AlertLevel: 'LOW',
    TopRiskFactor1: '收入穩定性',
    TopRiskFactor2: '',
    TopRiskFactor3: '',
    ReviewTimestamp: '2026-05-03T10:00:00Z',
  },
  {
    ApplicationId: 'TEST-002',
    CustomerName: '李小華',
    LoanType: '房屋貸款',
    LoanAmount: 12000000,
    RecommendedProduct: '一般房貸',
    InterestRate: 2.1,
    MonthlyPayment: 45000,
    ValuationP50: 15000000,
    ValuationP5: 13800000,
    ValuationP95: 16200000,
    FraudScore: 35,
    AlertLevel: 'MEDIUM',
    TopRiskFactor1: '高額貸款',
    TopRiskFactor2: '負債比偏高',
    TopRiskFactor3: '',
    ReviewTimestamp: '2026-05-03T10:05:00Z',
  },
  {
    ApplicationId: 'TEST-003',
    CustomerName: '張美玲',
    LoanType: '信用貸款',
    LoanAmount: 500000,
    RecommendedProduct: '薪轉優惠信貸',
    InterestRate: 3.5,
    MonthlyPayment: 9500,
    ValuationP50: 0,
    ValuationP5: 0,
    ValuationP95: 0,
    FraudScore: 8,
    AlertLevel: 'LOW',
    TopRiskFactor1: '',
    TopRiskFactor2: '',
    TopRiskFactor3: '',
    ReviewTimestamp: '2026-05-03T10:10:00Z',
  },
  {
    ApplicationId: 'TEST-004',
    CustomerName: '陳志成',
    LoanType: '信用貸款',
    LoanAmount: 800000,
    RecommendedProduct: '國軍優惠信貸',
    InterestRate: 2.88,
    MonthlyPayment: 14800,
    ValuationP50: 0,
    ValuationP5: 0,
    ValuationP95: 0,
    FraudScore: 72,
    AlertLevel: 'HIGH',
    TopRiskFactor1: '多筆債務',
    TopRiskFactor2: '近期信照查詢頻繁',
    TopRiskFactor3: 'DBR 接近上限',
    ReviewTimestamp: '2026-05-03T10:15:00Z',
  },
  {
    ApplicationId: 'TEST-005',
    CustomerName: '林佳蓉',
    LoanType: '房屋貸款',
    LoanAmount: 9500000,
    RecommendedProduct: '青安貸款',
    InterestRate: 1.745,
    MonthlyPayment: 26000,
    ValuationP50: 12000000,
    ValuationP5: 11000000,
    ValuationP95: 13100000,
    FraudScore: 5,
    AlertLevel: 'LOW',
    TopRiskFactor1: '',
    TopRiskFactor2: '',
    TopRiskFactor3: '',
    ReviewTimestamp: '2026-05-03T10:20:00Z',
  },
  {
    ApplicationId: 'TEST-006',
    CustomerName: '王建國',
    LoanType: '房屋貸款',
    LoanAmount: 6000000,
    RecommendedProduct: '一般房貸',
    InterestRate: 2.3,
    MonthlyPayment: 25500,
    ValuationP50: 8000000,
    ValuationP5: 7200000,
    ValuationP95: 8800000,
    FraudScore: 91,
    AlertLevel: 'HIGH',
    TopRiskFactor1: '地址異常',
    TopRiskFactor2: '收入來源不明',
    TopRiskFactor3: '擔保品疑慮',
    ReviewTimestamp: '2026-05-03T10:25:00Z',
  },
];

const resp = await fetch(PUSH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(rows),
});

console.log(`HTTP ${resp.status}`);
if (resp.ok) {
  console.log(`✅ 成功推送 ${rows.length} 筆資料`);
} else {
  const text = await resp.text();
  console.error('❌ 推送失敗：', text);
}
