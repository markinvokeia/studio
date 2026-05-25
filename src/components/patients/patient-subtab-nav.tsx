'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface PatientSubTabItem {
  id: string
  label: string
}

interface PatientSubTabNavProps {
  tabs: PatientSubTabItem[]
  activeTab: string
  onChange: (id: string) => void
}

export function PatientSubTabNav({ tabs, activeTab, onChange }: PatientSubTabNavProps) {
  return (
    <div className="mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'border-border bg-background text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
