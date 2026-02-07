import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OneJellyInvest - 주식 공시 정보',
  description: '한국 주식 공시 정보를 중립적으로 제공합니다.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
          {/* Header — glassmorphism */}
          <header
            className="sticky top-0 z-10"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--glass-border)',
              boxShadow: '0 4px 24px var(--glass-shadow)',
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
                    OneJellyInvest
                  </h1>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    공시/뉴스
                  </span>
                </div>
                <nav className="flex space-x-1">
                  <a
                    href="/"
                    className="btn-secondary px-3 py-1.5 text-sm rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    피드
                  </a>
                  <a
                    href="/valuations"
                    className="btn-secondary px-3 py-1.5 text-sm rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    밸류에이션
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main>{children}</main>

          {/* Footer — subtle glass */}
          <footer
            className="mt-12"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                본 서비스는 공시 및 재무 정보를 정리하여 제공하며, 투자 조언을 목적으로 하지 않습니다. 모든 투자 결정은 이용자 본인의 판단과 책임 하에 이루어져야 합니다.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
