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
    // 排除需要外部依賴（LINE SDK, Claude API, PDF, DB）的服務
    '!src/main/typescript/services/creditReportGenerator.ts',
    '!src/main/typescript/services/pdfGenerator.ts',
    '!src/main/typescript/services/documentParser.ts',
    '!src/main/typescript/services/conversationHandler.ts',
    '!src/main/typescript/services/valuationClient.ts',
    '!src/main/typescript/services/creditReviewService.ts',
    '!src/main/typescript/services/promotionEngine.ts',
    '!src/main/typescript/services/ragService.ts',
  ],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 50 },
  },
};
