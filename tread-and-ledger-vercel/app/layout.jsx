import './globals.css';

export const metadata = {
  title: 'Tread & Ledger',
  description: 'Daily takings, weekly bills, and P&L for the shop',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
