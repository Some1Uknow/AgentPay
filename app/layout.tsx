import 'streamdown/styles.css';
import './styles.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AgentPay MCP',
  description: 'x402 payments and ERC-8004 trust records for autonomous agent tools on Avalanche Fuji'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
