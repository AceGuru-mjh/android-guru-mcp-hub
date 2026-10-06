/**
 * GET /api/mcp/export — 多格式导出
 *
 * ?format=claude|apex|hub|operit & filter=installed|enabled|all（默认 installed） & download=1|0
 *   - download=1 → 直接下载 JSON 文件（文件名取 EXPORT_FORMATS.file）
 *   - 无 download → { ok, format, filename, content }（供前端预览模态框）
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EXPORT_FORMATS } from "@/lib/mcp-formats";
import { rowToConfig } from "@/lib/serialize";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const formatId = sp.get("format") ?? "";
    const filter = sp.get("filter") ?? "installed";
    const download = sp.get("download") === "1";

    const spec = EXPORT_FORMATS.find((f) => f.id === formatId);
    if (!spec) {
      return NextResponse.json(
        { ok: false, error: `不支持的导出格式：${formatId || "(空)"}（可选 claude | apex | hub | operit）` },
        { status: 400 },
      );
    }

    const where: Prisma.McpServerWhereInput =
      filter === "enabled"
        ? { enabled: true }
        : filter === "all"
          ? {}
          : { installed: true }; // 默认 installed

    const rows = await db.mcpServer.findMany({ where, orderBy: { name: "asc" } });
    const configs = rows.map(rowToConfig);
    const content = spec.make(configs);

    if (download) {
      return new NextResponse(content, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${spec.file}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      format: formatId,
      filename: spec.file,
      content,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "导出失败" },
      { status: 500 },
    );
  }
}
