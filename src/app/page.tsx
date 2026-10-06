"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  Puzzle,
  Server,
  Store,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HubHeader } from "@/components/hub/header";
import { HubFooter } from "@/components/hub/footer";
import { StatsCards } from "@/components/hub/stats-cards";
import { OverviewTab } from "@/components/hub/overview-tab";
import { MarketTab } from "@/components/hub/market-tab";
import { ServersTab } from "@/components/hub/servers-tab";
import { ImportExportTab } from "@/components/hub/import-export-tab";
import { PluginsTab } from "@/components/hub/plugins-tab";
import type { HubTab } from "@/components/hub/nav";

/**
 * Android Guru Agent · MCP & 插件枢纽
 * 单页应用：sticky header + 统计卡 + 5 Tab + sticky footer
 */
export default function Home() {
  const [activeTab, setActiveTab] = useState<HubTab>("overview");

  return (
    <div className="flex min-h-screen flex-col">
      <HubHeader />

      <main className="hub-grid-bg flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <StatsCards />

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as HubTab)}
            className="mt-8 gap-6"
          >
            <div className="w-full">
              <TabsList className="h-auto w-full grid grid-cols-3 gap-1.5 rounded-xl p-1 sm:grid-cols-5">
                <TabsTrigger value="overview" className="gap-1.5 px-1.5 py-2 text-xs sm:text-sm">
                  <LayoutDashboard className="size-4 shrink-0" />
                  总览
                </TabsTrigger>
                <TabsTrigger value="market" className="gap-1.5 px-1.5 py-2 text-xs sm:text-sm">
                  <Store className="size-4 shrink-0" />
                  MCP 市场
                </TabsTrigger>
                <TabsTrigger value="servers" className="gap-1.5 px-1.5 py-2 text-xs sm:text-sm">
                  <Server className="size-4 shrink-0" />
                  我的服务器
                </TabsTrigger>
                <TabsTrigger value="import" className="gap-1.5 px-1.5 py-2 text-xs sm:text-sm">
                  <ArrowLeftRight className="size-4 shrink-0" />
                  导入 / 导出
                </TabsTrigger>
                <TabsTrigger value="plugins" className="gap-1.5 px-1.5 py-2 text-xs sm:text-sm">
                  <Puzzle className="size-4 shrink-0" />
                  插件中心
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-2">
              <OverviewTab onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="market" className="mt-2">
              <MarketTab />
            </TabsContent>
            <TabsContent value="servers" className="mt-2">
              <ServersTab onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="import" className="mt-2">
              <ImportExportTab />
            </TabsContent>
            <TabsContent value="plugins" className="mt-2">
              <PluginsTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <HubFooter />
    </div>
  );
}
