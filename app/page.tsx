import Link from 'next/link';
import { ArrowRight, CheckCircle2, Database, ReceiptText, Search, ShieldCheck, Zap } from 'lucide-react';
import { BrandLogo, ProtocolBadge } from './components/brand';

export default function Home() {
  return (
    <main className="premium-page">
      <header className="premium-nav">
        <BrandLogo />
        <nav><Link href="/agent">Demo</Link><Link href="/registry">Registry</Link><Link href="/developer">Developers</Link></nav>
        <Link className="primary-button" href="/agent">Launch demo <ArrowRight size={16} /></Link>
      </header>

      <section className="premium-hero">
        <div className="hero-text">
          <div className="badge-row"><ProtocolBadge type="avax" label="Avalanche Fuji" /><ProtocolBadge type="x402" label="x402 payments" /><ProtocolBadge type="erc8004" label="agent reputation" /></div>
          <h1>Safe API spending for AI agents.</h1>
          <p>AgentPay lets an AI agent buy paid APIs without getting a blank check. You set the budget and rules, the agent chooses tools, x402 pays, and Avalanche records proof.</p>
          <div className="hero-ctas"><Link className="primary-button big" href="/agent">Open agent console</Link><Link className="secondary-button" href="/registry">View paid APIs</Link></div>
        </div>
        <div className="hero-visual">
          <div className="payment-card floating-card">
            <div className="card-top"><span>Agent allowance</span><strong>0.10 USDC max</strong></div>
            <FlowRow icon={<Search />} title="Find APIs" body="yield and risk tools" />
            <FlowRow icon={<ShieldCheck />} title="Check rules" body="budget, reputation, capability" />
            <FlowRow icon={<Zap />} title="Pay safely" body="x402 payment on Fuji" />
            <FlowRow icon={<ReceiptText />} title="Show proof" body="receipts and reputation writes" />
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <Stat value="0.10" label="USDC allowance" />
        <Stat value="x402" label="API payments" />
        <Stat value="Fuji" label="testnet proof" />
        <Stat value="5/5" label="tool reputation" />
      </section>

      <section className="premium-section">
        <div className="section-copy"><span>How it works</span><h2>The agent gets a budget, not your wallet.</h2><p>You give the agent a task and a spend limit. It can only buy APIs that match your rules.</p></div>
        <div className="step-grid">
          <Step n="01" icon={<Database />} title="APIs list prices" body="Each paid API publishes what it does, what it costs, and where payment goes." />
          <Step n="02" icon={<Search />} title="The agent picks" body="OpenAI decides which API is useful for the task instead of calling everything." />
          <Step n="03" icon={<Zap />} title="x402 pays" body="If the API passes policy, the agent sends a real testnet payment." />
          <Step n="04" icon={<CheckCircle2 />} title="Proof is saved" body="The app shows receipts and writes reputation for successful API work." />
        </div>
      </section>

      <section className="premium-section">
        <div className="section-copy"><span>The problem</span><h2>Agents need tools, but payments are unsafe without rules.</h2><p>An AI agent may need live data, risk checks, or paid APIs. AgentPay makes sure it cannot overspend or buy from low-trust providers.</p></div>
        <div className="step-grid">
          <Step n="01" icon={<ShieldCheck />} title="Budget cap" body="Set the most the agent can spend before it starts working." />
          <Step n="02" icon={<Database />} title="Allowed work" body="Limit what kinds of APIs the agent is allowed to buy." />
          <Step n="03" icon={<Search />} title="Trust filter" body="Block providers that do not meet your reputation bar." />
          <Step n="04" icon={<ReceiptText />} title="Clear audit trail" body="See what it bought, why it bought it, and what happened onchain." />
        </div>
      </section>

      <section className="premium-section">
        <div className="section-copy"><span>For builders</span><h2>Turn an API into something agents can pay for.</h2><p>API providers get a simple paid endpoint. Agent operators get policy, receipts, and reputation in one place.</p></div>
        <div className="step-grid">
          <Step n="API" icon={<Zap />} title="Paid API access" body="HTTP 402 asks for payment before the endpoint responds." />
          <Step n="ID" icon={<Database />} title="Tool identity" body="The API advertises its wallet, price, endpoint, and capabilities." />
          <Step n="REP" icon={<CheckCircle2 />} title="Reputation" body="Good paid work improves the provider's score." />
          <Step n="UX" icon={<ShieldCheck />} title="Operator console" body="The user sees the agent's answer and the payment proof together." />
        </div>
      </section>

      <section className="premium-section final-cta-section">
        <div className="final-cta-card">
          <div><span>Fuji demo</span><h2>Try an agent that buys APIs with a spending limit.</h2><p>Ask for an Avalanche yield task. The agent chooses paid APIs, spends testnet USDC through x402, and shows the proof.</p></div>
          <Link className="primary-button big" href="/agent">Open agent console <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}

function FlowRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="flow-row"><span>{icon}</span><div><strong>{title}</strong><small>{body}</small></div></div>;
}
function Stat({ value, label }: { value: string; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function Step({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) { return <article className="premium-step"><div><span>{n}</span>{icon}</div><h3>{title}</h3><p>{body}</p></article>; }
