import type { Metadata } from 'next'
import { Outfit, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "SisFilaSus - Gestão de Filas Eletivas",
  description: "Sistema Integrado de Gestão e Transparência de Filas Eletivas do SUS",
  manifest: "/manifest.json",
}

export const viewport = {
  themeColor: "#0f766e", // Teal primary color matching viewport theme
}

import { SystemModalProvider } from "@/components/ui/SystemModal"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${plusJakartaSans.variable} antialiased font-body min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SystemModalProvider>
            {children}
          </SystemModalProvider>
        </ThemeProvider>

        {/* Registro Automático do Service Worker para suporte a PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) {
                      console.log('PWA Service Worker registrado no escopo:', reg.scope);
                    },
                    function(err) {
                      console.error('Erro ao registrar Service Worker do PWA:', err);
                    }
                  );
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
