/**
 * POST /api/mcp/install — 目录批量安装
 *
 * body: { ids: string[] } → 选中条目 installed=true, enabled=false（安装 ≠ 启动）
 * → { ok, installed: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
    }
    const ids = (body as { ids?: unknown } | null)?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) {
      return NextResponse.json({ ok: false, error: "ids 必须是非空字符串数组" }, { status: 400 });
    }

    const result = await db.mcpServer.updateMany({
      where: { id: { in: ids } },
      data: { installed: true, enabled: false },
    });

    return NextResponse.json({ ok: true, installed: result.count });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "安装失败" },
      { status: 500 },
    );
  }
}
