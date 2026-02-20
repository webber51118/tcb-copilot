/**
 * INPUT: data/applications.json
 * OUTPUT: LoanApplication CRUD 操作
 * POS: 設定層，貸款申請 JSON 儲存層（MVP，後期可替換為 Azure Cosmos DB）
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoanApplication, BasicInfo, PropertyInfo } from '../models/types';
import { LoanType } from '../models/enums';

const DATA_FILE = path.resolve(__dirname, '../../../../data/applications.json');

/** 讀取所有申請（從 JSON 檔案） */
export function getAllApplications(): LoanApplication[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as LoanApplication[];
}

/** 取得今日日期字串 YYYYMMDD */
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** 產生案件編號 TCB-YYYYMMDD-XXXX */
function generateCaseId(): string {
  const today = getTodayStr();
  const all = getAllApplications();
  const todayApps = all.filter((a) => a.id.startsWith(`TCB-${today}-`));
  const seq = (todayApps.length + 1).toString().padStart(4, '0');
  return `TCB-${today}-${seq}`;
}

/** 新增申請 */
export function createApplication(
  lineUserId: string,
  applicantName: string,
  applicantPhone: string,
  loanType: LoanType,
  basicInfo: BasicInfo,
  propertyInfo: PropertyInfo,
  recommendedProductId: string,
  mydataReady: boolean,
  landRegistryReady: boolean | null,
): LoanApplication {
  const id = generateCaseId();
  const app: LoanApplication = {
    id,
    lineUserId,
    applicantName,
    applicantPhone,
    loanType,
    basicInfo,
    propertyInfo,
    recommendedProductId,
    mydataReady,
    landRegistryReady,
    status: 'pending',
    appliedAt: new Date().toISOString(),
  };

  const list = getAllApplications();
  list.push(app);

  // 確認 data 目錄存在
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  return app;
}

/** 取得單一申請 */
export function getApplicationById(id: string): LoanApplication | null {
  return getAllApplications().find((a) => a.id === id) ?? null;
}

/** 更新申請狀態 */
export function updateApplicationStatus(
  id: string,
  status: LoanApplication['status'],
): LoanApplication | null {
  const list = getAllApplications();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  list[idx]!.status = status;
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  return list[idx]!;
}
