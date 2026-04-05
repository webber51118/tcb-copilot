/**
 * INPUT:  GET /admin/agents/status（Admin API Key 驗證）
 * OUTPUT: { agents: AgentStatus[], recentWorkflows, summary }
 * POS:    Admin API — Agent 即時監控看板資料端點
 *
 * 前端每 5 秒 polling 此端點，渲染軍機處 Kanban 看板
 */

import { Router, Request, Response } from 'express';
import { getAgentStatuses } from '../config/agentMonitorStore';
import { getAllApplications } from '../config/applicationStore';

export const agentMonitorRouter = Router();

agentMonitorRouter.get('/agents/status', (_req: Request, res: Response) => {
  const agents = getAgentStatuses();

  // 最近 10 筆申請摘要（供看板下方表格顯示）
  const recentWorkflows = getAllApplications()
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 10)
    .map((app) => ({
      appId:    app.id,
      loanType: app.loanType === 'mortgage' ? '房貸' : '信貸',
      status:   app.status,
      amount:   app.amount,
      createdAt: app.createdAt,
    }));

  // 今日整體統計
  const totalCallsToday  = agents.reduce((s, a) => s + a.callsToday,  0);
  const totalErrorsToday = agents.reduce((s, a) => s + a.errorsToday, 0);
  const onlineCount      = agents.filter((a) => a.status === 'online').length;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      totalAgents:     agents.length,
      onlineNow:       onlineCount,
      totalCallsToday,
      totalErrorsToday,
    },
    agents,
    recentWorkflows,
  });
});
