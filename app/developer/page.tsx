import Link from 'next/link';
import { Code2, Database, ReceiptText, ShieldCheck, Zap } from 'lucide-react';
import { AppFooter, BrandLogo, ProtocolBadge } from '../components/brand';

const snippet = `export const POST = withX402(handler, {
  accepts: {
    scheme: "exact",
    network: "eip155:43113",
    payTo: AGENT_WALLET,
    price: {
      amount: "30000",
      asset: USDC_ADDRESS
    },
    extra: { name: "USD Coin", version: "2" }
  },
  description: "Paid MCP tool call"
});`;

export default function DeveloperPage() {
  return (
    <main className="premium-page developer-premium">
      <header className="premium-nav"><BrandLogo /><nav><Link href="/agent">Demo</Link><Link href="/registry">Registry</Link><Link href="/developer">Developers</Link></nav><Link className="primary-button" href="/agent">Run demo</Link></header>
      <section className="page-hero"><div><span>For tool builders</span><h1>Monetize an MCP tool in one wrapper.</h1><p>Add x402 to your endpoint, publish ERC-8004 metadata, and let buyer agents pay per call. Successful work builds reputation on Avalanche.</p></div><div className="badge-row"><ProtocolBadge type="x402" label="HTTP 402" /><ProtocolBadge type="erc8004" label="ERC-8004" /><ProtocolBadge type="avax" label="Fuji" /></div></section>
      <section className="developer-layout">
        <div className="code-card"><div><span><Code2 size={16} /> app/api/tools/route.ts</span><button>Copy</button></div><pre>{snippet}</pre></div>
        <div className="dev-steps"><Step icon={<Zap />} title="Wrap endpoint" body="The tool returns HTTP 402 until the buyer agent supplies a valid x402 payment." /><Step icon={<ReceiptText />} title="Set price" body="Charge exact USDC atomic units on Avalanche Fuji per tool call." /><Step icon={<Database />} title="Register identity" body="Expose endpoint, wallet, price, capabilities, and ERC-8004 identity URI." /><Step icon={<ShieldCheck />} title="Earn reputation" body="After useful work, the buyer agent validates the result and writes feedback to the registry." /></div>
      </section>
      <AppFooter />
    </main>
  );
}
function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <article className="dev-step"><span>{icon}</span><div><h3>{title}</h3><p>{body}</p></div></article>; }
