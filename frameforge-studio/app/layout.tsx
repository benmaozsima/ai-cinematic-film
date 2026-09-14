import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frameforge — Film Production Studio',
  description:
    'A complete AI film production workspace. Story, continuity, generation, review, and the final cut.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body>{children}</body>
    </html>
  );
}
