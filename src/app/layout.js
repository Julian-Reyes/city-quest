import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'City Quest',
  description: 'Gamify your local venues - check in, unlock achievements, and explore your city!',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="bg-gray-900 bg-opacity-80 backdrop-blur-md border-b border-purple-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
              <span className="text-2xl">🗺️</span>
              <span className="text-purple-400">City</span>
              <span>Quest</span>
            </Link>
            <div className="flex gap-6">
              <Link
                href="/"
                className="text-gray-300 hover:text-purple-400 transition-colors font-medium"
              >
                Venues
              </Link>
              <Link
                href="/visited"
                className="text-gray-300 hover:text-purple-400 transition-colors font-medium"
              >
                Visited
              </Link>
              <Link
                href="/achievements"
                className="text-gray-300 hover:text-purple-400 transition-colors font-medium"
              >
                Achievements
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
