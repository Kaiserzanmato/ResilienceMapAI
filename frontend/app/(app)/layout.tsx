"use client";
import { AIAgentPanel } from "@/components/ai/AIAgentPanel";
import { TopNav } from "@/components/layout/TopNav";
import { useAppStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { aiOpen } = useAppStore();
  return (
    <>
      <TopNav />
      <main
        id="main"
        className="pt-[calc(var(--banner-h)+var(--nav-h)+20px)]"
        style={{
          paddingRight: aiOpen ? "420px" : "0",
          transition: "padding-right 300ms ease-in-out",
        }}
      >
        {children}
      </main>
      <AIAgentPanel />
    </>
  );
}
