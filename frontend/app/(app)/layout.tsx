"use client";
import { useEffect, useState } from "react";
import { AIAgentPanel } from "@/components/ai/AIAgentPanel";
import { TopNav } from "@/components/layout/TopNav";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { aiOpen } = useAppStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <>
        <TopNav />
        <main id="main" className="pt-[calc(var(--banner-h)+var(--nav-h)+20px)]">
          {children}
        </main>
        <AIAgentPanel />
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main
        id="main"
        className={cn(
          "pt-[calc(var(--banner-h)+var(--nav-h)+20px)] transition-[padding-right] duration-300",
          aiOpen && "md:pr-[420px]"
        )}
      >
        {children}
      </main>
      <AIAgentPanel />
    </>
  );
}
