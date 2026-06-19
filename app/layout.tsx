import 'streamdown/styles.css';
import './styles.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AgentPay MCP',
  description: 'Payment and trust layer for paid MCP tools'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
