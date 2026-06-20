'use client';

import Link from 'next/link';
import { ExternalLink, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AgentAvatar, AppFooter, AvalancheLogo, BrandLogo, ProtocolBadge, UsdcLogo, snowtraceAddress } from '../components/brand';

type AnyObj = any;

export default function RegistryClient({ initialAgents, initialError = null }: { initialAgents: AnyObj[]; initialError?: string | null }) {
  const [agents, setAgents] = useState<AnyObj[]>(initialAgents);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    fetch('/api/agents').then(async res => {
      const data = await res.json();
      if (res.ok) setAgents(Array.isArray(data.agents) ? data.agents : []);
      setError(res.ok ? null : data.error || 'Failed to load registry');
    }).catch(e => setError(e instanceof Error ? e.message : 'Failed to load registry'));
  }, []);

  const filtered = useMemo(() => agents.filter(a => `${a.name} ${a.description} ${(a.capabilities || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [agents, query]);

  return (
    <main className="premium-page registry-premium">
      <header className="premium-nav"><BrandLogo /><nav><Link href="/agent">Demo</Link><Link href="/registry">Registry</Link><Link href="/developer">Developers</Link></nav><Link className="primary-button" href="/agent">Run agent</Link></header>
      <section className="page-hero compact registry-hero"><div><span>Tool registry</span><h1>Paid tools your agent can hire.</h1><p>Browse live x402 providers with wallets, prices, capabilities, and reputation records on Avalanche Fuji.</p></div><div className="badge-row"><ProtocolBadge type="avax" label="Fuji" /><ProtocolBadge type="usdc" label="USDC" /><ProtocolBadge type="erc8004" label="Reputation" /></div></section>
      <section className="registry-toolbar"><div><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tools, capabilities, endpoints..." /></div><span>{filtered.length} tools</span></section>
      {error && <div className="polished-error">{error}</div>}
      <section className="premium-tool-grid">{filtered.map(agent => <RegistryCard key={agent.agentId} agent={agent} />)}</section>
      <AppFooter />
    </main>
  );
}

function RegistryCard({ agent }: { agent: AnyObj }) {
  const rep = agent.reputationSummary || {};
  const score = Number(rep.score || 0);
  return (
    <article className="premium-tool-card registry-card">
      <div className="tool-card-head"><AgentAvatar name={agent.name} /><span>Agent #{agent.agentId}</span></div>
      <h2>{agent.name}</h2><p>{agent.description}</p>
      <div className="token-row"><span><UsdcLogo /> {agent.pricing?.display}</span><span><AvalancheLogo /> Avalanche Fuji</span></div>
      <div className="rating-row"><strong>{score ? score.toFixed(1) : 'New'}</strong><span>{score ? 'rated reputation' : 'No rating yet'} · {rep.successfulCalls || 0} successful calls</span></div>
      <div className="capability-list premium-caps">{(agent.capabilities || []).map((cap: string) => <span key={cap}>{cap}</span>)}</div>
      <div className="metadata-grid"><Meta label="x402 endpoint" value={agent.endpoint} /><Meta label="seller wallet" value={agent.wallet} href={snowtraceAddress(agent.wallet)} /><Meta label="asset" value={agent.pricing?.asset} href={snowtraceAddress(agent.pricing?.asset)} /><Meta label="agent URI" value={agent.agentURI} /></div>
    </article>
  );
}
function Meta({ label, value, href }: { label: string; value?: string; href?: string }) { return <div><span>{label}</span>{href ? <a href={href} target="_blank" rel="noreferrer"><code>{value}</code><ExternalLink size={12} /></a> : <code>{value}</code>}</div>; }
