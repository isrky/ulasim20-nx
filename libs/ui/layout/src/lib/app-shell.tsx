import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-background text-foreground">{children}</div>
}
