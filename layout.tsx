import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KODEX — AI Full-Stack Builder',
  description: 'Build production-ready full-stack apps with a single prompt. Free forever.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
