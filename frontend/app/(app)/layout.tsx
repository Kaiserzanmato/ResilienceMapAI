import { AIAgentPanel } from "@/components/ai/AIAgentPanel";
import { TopNav } from "@/components/layout/TopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
