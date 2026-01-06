import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claude Remote Control',
  description: 'Web terminal access to Claude Code from anywhere',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
