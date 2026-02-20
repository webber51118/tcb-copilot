/**
 * INPUT: HTTP POST（base64 圖片 + token + 文件類型）
 * OUTPUT: 解析結果 JSON
 * POS: API 層，供 LIFF 上傳頁面呼叫的文件解析端點
 *
 * 路由：
 *   POST /api/parse-document  — LIFF 上傳文件並解析
 */

import { Router, Request, Response } from 'express';
import { validateToken } from '../config/sessionTokenStore';
import { getSession, updateSession } from '../core/sessionStore';
import { parseMyDataDoc, parseLandRegistryDoc } from '../services/documentParser';
import { LoanType, BuildingType } from '../models/enums';

export const parseDocumentRouter = Router();

/** POST /api/parse-document */
parseDocumentRouter.post('/parse-document', async (req: Request, res: Response) => {
  const { token, docType, imageBase64 } = req.body as {
    token: string;
    docType: 'mydata' | 'landRegistry';
    imageBase64: string;
  };

  if (!token || !docType || !imageBase64) {
    res.status(400).json({ success: false, message: '缺少必要參數（token, docType, imageBase64）' });
    return;
  }

  if (docType !== 'mydata' && docType !== 'landRegistry') {
    res.status(400).json({ success: false, message: 'docType 必須為 mydata 或 landRegistry' });
    return;
  }

  const userId = validateToken(token);
  if (!userId) {
    res.status(401).json({ success: false, message: 'Token 無效或已過期，請重新開始申請流程' });
    return;
  }

  const session = getSession(userId);

  try {
    let result;
    if (docType === 'mydata') {
      result = await parseMyDataDoc(imageBase64);
      if (result.success && result.mydata) {
        const { name, idNumber, annualIncome, employer, phone } = result.mydata;
        if (name) session.applicantName = name;
        if (idNumber) session.idNumber = idNumber;
        if (annualIncome) {
          session.annualIncome = annualIncome;
          // 換算為月收入
          session.basicInfo.income = Math.round(annualIncome / 12);
        }
        if (employer) session.employer = employer;
        if (phone) session.applicantPhone = phone;
        session.mydataReady = true;
        session.parsedFromDoc = true;
        updateSession(session);
      }
    } else {
      result = await parseLandRegistryDoc(imageBase64);
      if (result.success && result.landRegistry) {
        const { buildingType, floor, areaPing, propertyAge } = result.landRegistry;
        if (buildingType) {
          // 標準化建物類型
          const btMap: Record<string, BuildingType> = {
            '大樓': BuildingType.APARTMENT,
            '華廈': BuildingType.MANSION,
            '公寓': BuildingType.WALK_UP,
            '透天': BuildingType.TOWNHOUSE,
            '套房': BuildingType.STUDIO,
          };
          const normalized = Object.keys(btMap).find((k) =>
            buildingType.includes(k)
          );
          if (normalized) session.propertyInfo.buildingType = btMap[normalized];
        }
        if (floor) session.propertyInfo.floor = floor;
        if (areaPing) session.propertyInfo.areaPing = areaPing;
        if (propertyAge) session.propertyInfo.propertyAge = propertyAge;
        if (session.loanType !== LoanType.PERSONAL) {
          session.landRegistryReady = true;
        }
        session.parsedFromDoc = true;
        updateSession(session);
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[parseDocument] 解析失敗:', err);
    res.status(500).json({ success: false, message: '文件解析失敗，請重試' });
  }
});
