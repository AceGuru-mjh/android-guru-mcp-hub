/**
 * PATCH  /api/plugins/[id] — 部分更新（enabled / name / description / tags / ...）
 * DELETE /api/plugins/[id] — 删除
 *
 * → { ok: true } | 404 { ok:false, error }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pluginToDto } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

const FORMATS = ["operit", "anthropic-marketplace", "anthropic-skill"] as const;

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad("请求体不是合法 JSON");
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return bad("请求体必须是对象");
    }
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ("name" in b) {
      if (typeof b.name !== "string" || !b.name.trim()) return bad("name 不能为空");
      data.name = b.name.trim();
    }
    if ("description" in b) {
      if (typeof b.description !== "string") return bad("description 必须是字符串");
      data.description = b.description;
    }
    if ("version" in b) {
      if (typeof b.version !== "string" || !b.version.trim()) return bad("version 必须是非空字符串");
      data.version = b.version.trim();
    }
    if ("author" in b) {
      if (typeof b.author !== "string") return bad("author 必须是字符串");
      data.author = b.author;
    }
    if ("format" in b) {
      if (!(FORMATS as readonly string[]).includes(b.format as string)) {
        return bad("format 必须是 operit | anthropic-marketplace | anthropic-skill");
      }
      data.format = b.format;
    }
    if ("pluginType" in b) {
      if (typeof b.pluginType !== "string" || !b.pluginType.trim()) return bad("pluginType 必须是非空字符串");
      data.pluginType = b.pluginType.trim();
    }
    if ("config" in b) {
      if (typeof b.config !== "object" || b.config === null || Array.isArray(b.config)) {
        return bad("config 必须是对象");
      }
      data.config = JSON.stringify(b.config);
    }
    if ("skillBody" in b) {
      if (b.skillBody !== null && typeof b.skillBody !== "string") return bad("skillBody 必须是字符串或 null");
      data.skillBody = b.skillBody;
    }
    if ("sourceUrl" in b) {
      if (b.sourceUrl !== null && typeof b.sourceUrl !== "string") return bad("sourceUrl 必须是字符串或 null");
      data.sourceUrl = b.sourceUrl === "" ? null : b.sourceUrl;
    }
    if ("repo" in b) {
      if (b.repo !== null && typeof b.repo !== "string") return bad("repo 必须是字符串或 null");
      data.repo = b.repo === "" ? null : b.repo;
    }
    if ("tags" in b) {
      if (!Array.isArray(b.tags) || !b.tags.every((x) => typeof x === "string")) {
        return bad("tags 必须是字符串数组");
      }
      data.tags = JSON.stringify(b.tags);
    }
    for (const key of ["enabled", "installed"] as const) {
      if (key in b) {
        if (typeof b[key] !== "boolean") return bad(`${key} 必须是布尔值`);
        data[key] = b[key];
      }
    }

    if (Object.keys(data).length === 0) return bad("没有可更新的字段");

    const existing = await db.plugin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "插件不存在" }, { status: 404 });
    }

    const row = await db.plugin.update({ where: { id }, data });
    return NextResponse.json({ ok: true, plugin: pluginToDto(row) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "更新失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await db.plugin.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "插件不存在" }, { status: 404 });
    }
    await db.plugin.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "删除失败" },
      { status: 500 },
    );
  }
}
