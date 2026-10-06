/**
 * /api/mcp — MCP 服务器目录
 *
 * GET  ?q=&category=all|programming|reverse&filter=all|installed|enabled
 *      → { servers: McpServerDto[] }（name/description/tags 模糊匹配）
 *
 * POST body: McpServerConfig 形状（手工新增）
 *      → source="manual", installed=true, enabled 默认 false（安装 ≠ 启动）
 *      → { ok, server } | 400 { ok:false, error }
 *
 * 校验复用 @/lib/mcp-formats 的 parseMcpText（裸服务器路径），
 * 与 apex McpConfigImport 推断规则保持一致：command→STDIO；type http/sse→HTTP/SSE；仅 url→HTTP。
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseMcpText } from "@/lib/mcp-formats";
import { ensureSeeded } from "@/lib/seed";
import { isWarningError, mcpConfigToDbData, serverToDto } from "@/lib/serialize";
import type { McpServerConfig } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim();
    const category = sp.get("category") ?? "all";
    const filter = sp.get("filter") ?? "all";

    // eslint 规则见 eslint.config.mjs；where 使用 Prisma 官方类型
    const where: Prisma.McpServerWhereInput = {};
    if (category === "programming" || category === "reverse") where.category = category;
    if (filter === "installed") where.installed = true;
    if (filter === "enabled") where.enabled = true;
    if (q) {
      // tags 在 DB 中是 JSON 字符串，contains 同样能命中标签文本
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
      ];
    }

    const rows = await db.mcpServer.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json({ servers: rows.map(serverToDto) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "查询失败" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "请求体不是合法 JSON" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "请求体必须是服务器配置对象" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      return NextResponse.json({ ok: false, error: "name 不能为空" }, { status: 400 });
    }

    // 复用 mcp-formats 的裸服务器解析：传输层推断 / 冲突校验 / 字段规整全部对齐 apex 规则
    const { format, entries } = parseMcpText(JSON.stringify(raw));
    if (format === "unknown" || entries.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "无法推断传输层：需要提供 command（STDIO）或 url（HTTP/SSE），或显式声明 transport/type",
        },
        { status: 400 },
      );
    }
    const entry = entries[0];
    if (entry.error && !isWarningError(entry.error)) {
      return NextResponse.json({ ok: false, error: entry.error }, { status: 400 });
    }

    const cfg: McpServerConfig = entry.server;
    const existing = await db.mcpServer.findUnique({ where: { name: cfg.name } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: `NAME_DUPLICATE：同名服务器已存在（${cfg.name}）` },
        { status: 400 },
      );
    }

    const row = await db.mcpServer.create({
      data: {
        ...mcpConfigToDbData(cfg),
        source: "manual",
        installed: true, // 手工添加 = 直接入"我的服务器"
      },
    });

    return NextResponse.json({ ok: true, server: serverToDto(row) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "创建失败" },
      { status: 500 },
    );
  }
}
