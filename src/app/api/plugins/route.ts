/**
 * /api/plugins — 插件中心
 *
 * GET  ?format=all|operit|anthropic-marketplace|anthropic-skill & q=
 *      → { plugins: PluginDto[] }（config 解析为对象，skillBody 原样返回）
 *
 * POST body: { name, description?, version?, author?, format, pluginType?,
 *              config?, skillBody?, sourceUrl?, repo?, tags? }
 *      → { ok, plugin } | 400 { ok:false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { pluginToDto } from "@/lib/serialize";

const FORMATS = ["operit", "anthropic-marketplace", "anthropic-skill"] as const;

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();

    const sp = req.nextUrl.searchParams;
    const format = sp.get("format") ?? "all";
    const q = (sp.get("q") ?? "").trim();

    const where: Prisma.PluginWhereInput = {};
    if ((FORMATS as readonly string[]).includes(format)) where.format = format;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
      ];
    }

    const rows = await db.plugin.findMany({ where, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ plugins: rows.map(pluginToDto) });
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
      return bad("请求体不是合法 JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return bad("请求体必须是插件配置对象");
    }
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("name 不能为空");
    const format = typeof b.format === "string" ? b.format : "";
    if (!(FORMATS as readonly string[]).includes(format)) {
      return bad("format 必须是 operit | anthropic-marketplace | anthropic-skill");
    }

    // pluginType 缺省按格式推导：Anthropic 两类是 skill，Operit 结构是 mcp
    const pluginType =
      typeof b.pluginType === "string" && b.pluginType.trim()
        ? b.pluginType.trim()
        : format === "operit"
          ? "mcp"
          : "skill";

    const config =
      b.config && typeof b.config === "object" && !Array.isArray(b.config)
        ? (b.config as Record<string, unknown>)
        : {};

    const row = await db.plugin.create({
      data: {
        name,
        description: typeof b.description === "string" ? b.description : "",
        version: typeof b.version === "string" && b.version.trim() ? b.version.trim() : "1.0.0",
        author: typeof b.author === "string" ? b.author : "",
        format,
        pluginType,
        config: JSON.stringify(config),
        skillBody: typeof b.skillBody === "string" ? b.skillBody : null,
        enabled: b.enabled === true,
        installed: true,
        sourceUrl: typeof b.sourceUrl === "string" && b.sourceUrl ? b.sourceUrl : null,
        repo: typeof b.repo === "string" && b.repo ? b.repo : null,
        tags: JSON.stringify(
          Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === "string") : [],
        ),
      },
    });

    return NextResponse.json({ ok: true, plugin: pluginToDto(row) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "创建失败" },
      { status: 500 },
    );
  }
}
