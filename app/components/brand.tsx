import Image from 'next/image';
import Link from 'next/link';
import { Bot, Database, Search, ShieldCheck, Wallet, Zap } from 'lucide-react';

export const snowtraceTx = (hash?: string) => hash ? `https://testnet.snowtrace.io/tx/${hash}` : '#';
export const snowtraceAddress = (address?: string) => address ? `https://testnet.snowtrace.io/address/${address}` : '#';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`ap-brand ${compact ? 'is-compact' : ''}`} aria-label="AgentPay home">
      {compact ? (
        <span className="ap-mark"><AvalancheLogo /></span>
      ) : (
        <Image className="ap-brand-image" src="/branding_dark.png" alt="AgentPay" width={300} height={100} priority />
      )}
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

export function UsdcLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="USDC" style={{ flexShrink: 0 }}>
      <path d="M48 95C73.9574 95 95 73.9574 95 48C95 22.0426 73.9574 1 48 1C22.0426 1 1 22.0426 1 48C1 73.9574 22.0426 95 48 95Z" fill="#0B53BF"/>
      <path d="M56.4609 13.7778V19.8291C68.5341 23.4716 77.3759 34.6928 77.3759 47.9997C77.3759 61.3066 68.5341 72.5278 56.4609 76.1703V82.2216C71.8534 78.4616 83.2509 64.5672 83.2509 47.9997C83.2509 31.4322 71.8534 17.5378 56.4609 13.7778Z" fill="white"/>
      <path d="M18.625 47.9997C18.625 34.6928 27.4669 23.4716 39.54 19.8291V13.7778C24.1475 17.5378 12.75 31.4322 12.75 47.9997C12.75 64.5672 24.1475 78.4616 39.54 82.2216V76.1703C27.4669 72.5572 18.625 61.3066 18.625 47.9997Z" fill="white"/>
      <path d="M60.6319 54.5506C60.6319 42.5362 41.8025 47.4713 41.8025 40.8325C41.8025 38.4531 43.7119 36.9256 47.3544 36.9256C51.7019 36.9256 53.2 39.0406 53.67 41.89H59.6625C59.1279 36.5426 56.0588 33.1662 50.9382 32.1604V27.4375H45.0632V31.9918C39.4534 32.7062 35.9275 35.973 35.9275 40.8325C35.9275 52.9056 54.7863 48.3819 54.7863 54.9031C54.7863 57.3706 52.4069 59.0156 48.3825 59.0156C43.1244 59.0156 41.3913 56.695 40.745 53.4931H34.8994C35.2781 59.3502 38.8897 63.0159 45.0632 63.9307V68.5625H50.9382V63.9923C56.9633 63.2139 60.6319 59.7089 60.6319 54.5506Z" fill="white"/>
    </svg>
  );
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

export function AppFooter() {
  return (
    <footer className="app-footer">
      <Image className="footer-brand-image" src="/branding_dark.png" alt="AgentPay" width={300} height={100} />
      <p>AI agents pay tools with x402 and write reputation on Avalanche.</p>
      <div>
        <Link href="/agent">Demo</Link>
        <Link href="/registry">Registry</Link>
        <Link href="/developer">Developers</Link>
      </div>
    </footer>
  );
}
