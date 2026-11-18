import type { Metadata } from "next";
import { OperationsShell } from "@/components/layout/OperationsShell";
import { HideNextDevOverlay } from "@/components/system/HideNextDevOverlay";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friction X 销售工作台",
  description: "辅助电机销售拓客、潜客评分和专业话术生成的销售 Agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <HideNextDevOverlay />
        <OperationsShell>{children}</OperationsShell>
      </body>
    </html>
  );
}
