import Link from 'next/link';
import { Bot, Database, Search, ShieldCheck, Wallet, Zap } from 'lucide-react';

export const snowtraceTx = (hash?: string) => hash ? `https://testnet.snowtrace.io/tx/${hash}` : '#';
export const snowtraceAddress = (address?: string) => address ? `https://testnet.snowtrace.io/address/${address}` : '#';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="ap-brand" aria-label="AgentPay home">
      <span className="ap-mark"><AvalancheLogo /></span>
      {!compact && <span><strong>AgentPay</strong><small>agents hiring tools</small></span>}
    </Link>
  );
}

export function AvalancheLogo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="avax-logo">
      <circle cx="32" cy="32" r="32" fill="currentColor" />
      <path fill="white" d="M42.2 35.2c1.4 2.4 2.3 3.7 2.5 4.2.4.9-.2 1.8-1.3 1.8h-7.3c-1.1 0-1.8-.6-2.3-1.5l-3.1-5.5c-.5-.9-.5-1.8 0-2.7l4.6-8c.5-.9 1.8-.9 2.3 0l4.1 7.1c.5.9.5 1.8 0 2.7l-.1.2Zm-11.7-20c.5-.9 1.8-.9 2.3 0l2 3.5c.5.9.5 1.8 0 2.7L24.6 39.7c-.5.9-1.2 1.5-2.3 1.5h-6.9c-1.1 0-1.7-.9-1.2-1.8L30.5 15.2Z" />
    </svg>
  );
}

export function UsdcLogo() {
  return <span className="usdc-logo" aria-label="USDC">$</span>;
}

export function ProtocolBadge({ type, label }: { type: 'avax' | 'usdc' | 'x402' | 'erc8004'; label: string }) {
  const icon = type === 'avax' ? <AvalancheLogo /> : type === 'usdc' ? <UsdcLogo /> : type === 'x402' ? <Zap size={14} /> : <Database size={14} />;
  return <span className={`protocol-badge ${type}`}>{icon}{label}</span>;
}

export function AgentAvatar({ name }: { name: string }) {
  const Icon = name.includes('Risk') ? ShieldCheck : name.includes('Scout') ? Search : Bot;
  return <span className="agent-avatar"><Icon size={20} /></span>;
}

export function TxLink({ hash, label = 'View tx' }: { hash?: string; label?: string }) {
  if (!hash) return <span className="empty-hash">pending</span>;
  return <a className="tx-link" href={snowtraceTx(hash)} target="_blank" rel="noreferrer">{label}</a>;
}

export function WalletIcon() { return <Wallet size={16} />; }
