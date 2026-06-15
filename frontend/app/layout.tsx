import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Document Verification Portal',
  description: 'Upload, verify and track identity documents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
