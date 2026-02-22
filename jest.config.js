/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/main/typescript/services/**/*.ts',
    'src/main/typescript/models/**/*.ts',
    'src/main/typescript/data/**/*.ts',
    'src/main/typescript/api/**/*.ts',
    // 排除需要外部依賴（LINE SDK, Claude API, PDF, DB）的服務
    '!src/main/typescript/services/creditReportGenerator.ts',
    '!src/main/typescript/services/pdfGenerator.ts',
    '!src/main/typescript/services/documentParser.ts',
    '!src/main/typescript/services/conversationHandler.ts',
    '!src/main/typescript/services/valuationClient.ts',
    '!src/main/typescript/services/creditReviewService.ts',
    '!src/main/typescript/services/promotionEngine.ts',
    '!src/main/typescript/services/ragService.ts',
    // 排除呼叫 Claude API 的多代辦服務（需要外部 Anthropic 連線）
    '!src/main/typescript/services/committeeReviewService.ts',
    '!src/main/typescript/services/workflowService.ts',
    // 排除 webhook（LINE middleware 強依賴）與 admin（DB 依賴）
    '!src/main/typescript/api/webhook.ts',
    '!src/main/typescript/api/promotionAdmin.ts',
    '!src/main/typescript/api/applicationAdmin.ts',
    '!src/main/typescript/api/parseDocument.ts',
    '!src/main/typescript/api/submitApplication.ts',
    '!src/main/typescript/api/recommend.ts',
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 50 },
  },
};
