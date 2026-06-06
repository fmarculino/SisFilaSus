'use client'

import React, { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

export function DashboardShell({ 
  children, 
  role, 
  email
}: { 
  children: React.ReactNode
  role: string
  email: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-background transition-transform duration-300 ease-in-out lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar role={role} onLinkClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full lg:pl-72 print:pl-0 transition-all duration-300 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-muted/50 via-background to-background">
        <div className="no-print">
          <Header 
            email={email} 
            role={role} 
            onMenuClick={() => setSidebarOpen(true)} 
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 print:p-0 animate-in">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
