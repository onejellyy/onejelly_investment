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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    OneJellyInvest
                  </h1>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    공시/뉴스
                  </span>
                </div>
                <nav className="flex space-x-4">
                  <a
                    href="/"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    피드
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main>{children}</main>

          {/* Footer */}
          <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
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
