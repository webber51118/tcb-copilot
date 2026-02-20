/**
 * INPUT: 圖片 base64（MYDATA 所得資料 / 土地建物謄本）
 * OUTPUT: DocumentParseResult（解析出的結構化資料）
 * POS: 服務層，使用 Claude Vision API 解析文件圖片
 */

import Anthropic from '@anthropic-ai/sdk';
import { DocumentParseResult } from '../models/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/** 將 base64 轉為 Anthropic media type */
function getMediaType(base64WithPrefix: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  if (base64WithPrefix.startsWith('data:image/png')) return 'image/png';
  if (base64WithPrefix.startsWith('data:image/webp')) return 'image/webp';
  if (base64WithPrefix.startsWith('data:image/gif')) return 'image/gif';
  return 'image/jpeg';
}

/** 去除 base64 data URL 前綴 */
function stripPrefix(base64: string): string {
  return base64.replace(/^data:image\/[a-z]+;base64,/, '');
}

/**
 * 解析 MyData 所得資料圖片
 * 提取：姓名、身分證字號、年度所得總額、就業單位/雇主、電話（若有）
 */
export async function parseMyDataDoc(imageBase64: string): Promise<DocumentParseResult> {
  try {
    const mediaType = getMediaType(imageBase64);
    const base64Data = stripPrefix(imageBase64);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `請從這份台灣 MyData 所得資料文件中，擷取以下欄位，並以 JSON 格式回傳。
若某欄位無法辨識，請填入 null。
格式如下（只回傳 JSON，不要其他文字）：
{
  "name": "姓名（中文）",
  "idNumber": "身分證字號（格式：A123456789）",
  "annualIncome": 年度所得總額（整數，單位：新台幣元，例如：600000）,
  "employer": "就業單位或雇主名稱",
  "phone": "電話號碼（若文件中有的話，格式：09XXXXXXXX，否則 null）"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: '無法從 MyData 文件中解析結構化資料' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      mydata: {
        name: parsed.name || undefined,
        idNumber: parsed.idNumber || undefined,
        annualIncome: typeof parsed.annualIncome === 'number' ? parsed.annualIncome : undefined,
        employer: parsed.employer || undefined,
        phone: parsed.phone || undefined,
      },
    };
  } catch (err) {
    console.error('[documentParser] MyData 解析失敗:', err);
    return { success: false, error: 'MyData 文件解析發生錯誤，請重新上傳或手動填寫' };
  }
}

/**
 * 解析土地建物謄本圖片
 * 提取：建物種類/構造、所在樓層、建築面積（坪）、建築完成日期/屋齡
 */
export async function parseLandRegistryDoc(imageBase64: string): Promise<DocumentParseResult> {
  try {
    const mediaType = getMediaType(imageBase64);
    const base64Data = stripPrefix(imageBase64);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `請從這份台灣土地建物謄本文件中，擷取以下欄位，並以 JSON 格式回傳。
若某欄位無法辨識，請填入 null。
格式如下（只回傳 JSON，不要其他文字）：
{
  "buildingType": "建物種類/構造（如：大樓、華廈、公寓、透天、套房）",
  "floor": 所在樓層（整數，例如：5）,
  "areaPing": 建築面積（坪數，浮點數，例如：32.5）,
  "propertyAge": 屋齡（整數，從建築完成日期計算至今的年數，例如：15）
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: '無法從謄本文件中解析結構化資料' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      success: true,
      landRegistry: {
        buildingType: parsed.buildingType || undefined,
        floor: typeof parsed.floor === 'number' ? Math.round(parsed.floor) : undefined,
        areaPing: typeof parsed.areaPing === 'number' ? parsed.areaPing : undefined,
        propertyAge: typeof parsed.propertyAge === 'number' ? Math.round(parsed.propertyAge) : undefined,
      },
    };
  } catch (err) {
    console.error('[documentParser] 謄本解析失敗:', err);
    return { success: false, error: '土地建物謄本解析發生錯誤，請重新上傳或手動填寫' };
  }
}

/**
 * 解析 LINE Bot 接收到的圖片（by message content stream）
 * 傳入 Uint8Array buffer，轉為 base64 後呼叫解析
 */
export async function parseImageBuffer(
  buffer: Buffer,
  docType: 'mydata' | 'landRegistry',
): Promise<DocumentParseResult> {
  const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  if (docType === 'mydata') return parseMyDataDoc(base64);
  return parseLandRegistryDoc(base64);
}
