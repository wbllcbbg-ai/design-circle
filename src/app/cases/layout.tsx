import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "装修案例 - 设计圈",
  description: "海量真实家居装修案例，发现你喜欢的装修风格",
}

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
