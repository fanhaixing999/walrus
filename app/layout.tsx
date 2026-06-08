import './globals.css';

export const metadata = {
  title: 'World Cup Walrus Memory Agent',
  description: 'AI Agent with persistent decentralized memory on Walrus Mainnet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
