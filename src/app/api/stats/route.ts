/**
 * GET /api/stats — 总览统计
 *
 * 返回：{ servers: {total,installed,enabled,programming,reverse},
 *         plugins: {total,operit,anthropic},
 *         logs: 最近 10 条导入日志 }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { logToDto } from "@/lib/serialize";

export async function GET() {
  try {
    await ensureSeeded();

    const [total, installed, enabled, programming, reverse] = await Promise.all([
      db.mcpServer.count(),
      db.mcpServer.count({ where: { installed: true } }),
      db.mcpServer.count({ where: { enabled: true } }),
      db.mcpServer.count({ where: { category: "programming" } }),
      db.mcpServer.count({ where: { category: "reverse" } }),
    ]);

    const [pluginTotal, operit, anthropic] = await Promise.all([
      db.plugin.count(),
      db.plugin.count({ where: { format: "operit" } }),
      db.plugin.count({
        where: { format: { in: ["anthropic-marketplace", "anthropic-skill"] } },
      }),
    ]);

    const logs = await db.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      servers: { total, installed, enabled, programming, reverse },
      plugins: { total: pluginTotal, operit, anthropic },
      logs: logs.map(logToDto),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "统计查询失败" },
      { status: 500 },
    );
  }
}
