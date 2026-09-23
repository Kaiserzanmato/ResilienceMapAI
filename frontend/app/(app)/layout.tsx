"use client";
import { usePathname } from "next/navigation";
import { AIAgentPanel } from "@/components/ai/AIAgentPanel";
import { TopNav } from "@/components/layout/TopNav";
import { useAppStore } from "@/lib/store";

// Routes that already render the AI Research Agent as their main workspace;
// the side drawer would be a duplicate of the same chat there.
const AGENT_WORKSPACE_ROUTES = ["/agents"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { aiOpen, aiPanelWidth } = useAppStore();
  const pathname = usePathname();
  const showDrawer = !AGENT_WORKSPACE_ROUTES.some(
    (r) => pathname === r || pathname?.startsWith(`${r}/`)
  );
  const drawerOpen = showDrawer && aiOpen;
  return (
    <>
      <TopNav />
      <main
        id="main"
        className="pt-[calc(var(--banner-h)+var(--nav-h)+20px)]"
        style={{
          paddingRight: drawerOpen ? `${aiPanelWidth + 24}px` : "0",
          transition: "padding-right 300ms ease-in-out",
        }}
      >
        {children}
      </main>
      <AIAgentPanel hidden={!showDrawer} />
    </>
  );
}
