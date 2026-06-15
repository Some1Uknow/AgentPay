'use client';

import { useEffect, useMemo, useState } from 'react';

type AnyObj = any;

const defaultTask = 'Find the safest Avalanche yield opportunity for 1,000 USDC';

const formatUsdc = (atomic?: number | string) => {
  const value = Number(atomic || 0) / 1_000_000;
  return `${value.toFixed(value >= 0.01 ? 2 : 3)} USDC`;
};

export default function Home() {
  const [agents, setAgents] = useState<AnyObj[]>([]);
  const [task, setTask] = useState(defaultTask);
  const [run, setRun] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAgents() {
    const res = await fetch('/api/agents');
    const data = await res.json();
    setAgents(Array.isArray(data.agents) ? data.agents : []);
    setError(res.ok ? null : data.error || 'Failed to load agents');
  }

  async function runAgent() {
    setLoading(true);
    setRun(null);
    setError(null);
    try {
      const res = await fetch('/api/run-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, maxBudgetAtomic: '100000' })
      });
      const data = await res.json();
      setRun(data);
      setError(res.ok ? null : data.error || 'Agent run failed');
      await loadAgents();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAgents(); }, []);

  const selectedIds = useMemo(() => new Set((run?.selectedTools || []).map((tool: AnyObj) => tool.agentId)), [run]);
  const totalTools = agents.length;
  const x402Tools = agents.filter(agent => agent.metadata?.x402Support || agent.x402Support !== false).length;

  return (
    <main className="app-shell">
      <div className="page-noise" aria-hidden="true" />
      <div className="page-columns" aria-hidden="true" />

      <header className="site-header">
        <a href="#top" className="brand-mark" aria-label="AgentPay MCP home">
          <span className="brand-glyph">AP</span>
          <span>AgentPay MCP</span>
        </a>
        <nav className="topnav" aria-label="Primary">
          <a href="#registry">Registry</a>
          <a href="#run">Run agent</a>
          <a href="#receipts">Receipts</a>
        </nav>
        <button className="nav-cta" onClick={runAgent} disabled={loading}>{loading ? 'Running…' : 'Run flow'}</button>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Avalanche Fuji · x402 · ERC-8004 trust</p>
          <h1>Paid MCP tools need a trust layer.</h1>
          <p className="hero-lede">
            AgentPay lets AI agents discover MCP tools, compare price and reputation, pay with x402, and update payment-backed trust on Avalanche.
          </p>
          <div className="hero-actions">
            <button className="hero-cta" onClick={runAgent} disabled={loading}>{loading ? 'Executing testnet flow…' : 'Run agentic payment demo'}</button>
            <a className="hero-link" href="#registry">View registered tools</a>
          </div>
        </div>

        <div className="control-plane" aria-label="AgentPay flow preview">
          <div className="terminal-topbar">
            <div className="terminal-dots"><span /><span /><span /></div>
            <span>agentpay/control-plane</span>
          </div>
          <div className="flow-panel">
            <FlowStep number="01" title="Discover" body={`${totalTools || 3} MCP tools listed in ERC-8004 registry`} />
            <FlowStep number="02" title="Rank" body="Capability match + reputation + price" active />
            <FlowStep number="03" title="Pay" body="HTTP 402 → x402 USDC on Avalanche Fuji" />
            <FlowStep number="04" title="Trust" body="Successful paid calls update reputation" />
          </div>
          <div className="mini-metrics">
            <Metric value={String(totalTools || 3)} label="registered tools" />
            <Metric value={String(x402Tools || 3)} label="x402 enabled" />
            <Metric value="0.08" label="USDC target spend" />
          </div>
        </div>
      </section>

      <section className="statement-band">
        Agents should not guess which tool to trust. They should pay, verify, and remember.
      </section>

      <section className="content-section" id="run">
        <div className="section-heading">
          <p className="section-kicker">Agent run</p>
          <h2>One task. Multiple paid tools. One rational choice.</h2>
        </div>
        <div className="run-console">
          <label htmlFor="task">Task for the buyer agent</label>
          <textarea id="task" value={task} onChange={e => setTask(e.target.value)} />
          <div className="console-footer">
            <span>Budget cap: 0.10 USDC · Network: eip155:43113</span>
            <button onClick={runAgent} disabled={loading}>{loading ? 'Waiting for x402…' : 'Execute flow'}</button>
          </div>
        </div>
      </section>

      <section className="content-section alt-surface" id="registry">
        <div className="section-heading split-heading">
          <div>
            <p className="section-kicker">Registry</p>
            <h2>Paid MCP supply, made legible.</h2>
          </div>
          <p>Each server exposes metadata, pricing, capabilities, and reputation signals agents can reason over.</p>
        </div>
        {error && <div className="error-card"><strong>API error</strong><p>{error}</p></div>}
        <div className="tool-registry">
          {agents.map((agent) => <ToolCard key={agent.agentId} agent={agent} selected={selectedIds.has(agent.agentId)} />)}
        </div>
      </section>

      <section className="content-section proof-section" id="receipts">
        <div className="section-heading">
          <p className="section-kicker">Execution proof</p>
          <h2>{run ? 'The agent made the market choice.' : 'Run the flow to see payment proof.'}</h2>
        </div>

        {!run && (
          <div className="empty-state">
            <span className="empty-code">402</span>
            <p>No run yet. Execute the demo to show discovered tools, selected tools, payment receipts, and trust updates.</p>
          </div>
        )}

        {run?.error && <div className="error-card"><strong>Flow blocked</strong><p>{run.error}</p></div>}

        {run && !run.error && (
          <div className="execution-grid">
            <div className="decision-panel">
              <p className="panel-label">Tool ranking</p>
              {(run.discoveredTools || []).map((tool: AnyObj) => (
                <div className={`ranking-row ${selectedIds.has(tool.agentId) ? 'is-selected' : ''}`} key={tool.agentId}>
                  <div>
                    <strong>{tool.name}</strong>
                    <span>{selectedIds.has(tool.agentId) ? 'Selected' : 'Rejected'} · score {tool.scoring?.score ?? '—'}</span>
                  </div>
                  <div className="rank-price">{formatUsdc(tool.priceAtomic)}</div>
                </div>
              ))}
            </div>

            <div className="decision-panel">
              <p className="panel-label">Payment receipts</p>
              {(run.payments || []).length ? (run.payments || []).map((payment: AnyObj, index: number) => (
                <div className="receipt-row" key={payment?.txHash || payment?.transaction || payment?.paymentRef || index}>
                  <span>{payment?.tool || `Payment ${index + 1}`}</span>
                  <strong>{payment?.network || run.network || 'Avalanche Fuji'}</strong>
                  <code>{payment?.txHash || payment?.transaction || payment?.id || payment?.paymentRef || 'PAYMENT-RESPONSE received'}</code>
                </div>
              )) : <p className="muted">Payment response will appear here after successful x402 settlement.</p>}
              <div className="total-spend">Total spent <strong>{run.totalSpentDisplay}</strong></div>
            </div>

            <div className="decision-panel">
              <p className="panel-label">Reputation writeback</p>
              {(run.reputationUpdates || []).length ? (run.reputationUpdates || []).map((update: AnyObj) => (
                <div className="receipt-row" key={update.feedbackTxHash || update.paymentRef}>
                  <span>{update.name}</span>
                  <strong>{update.validation?.ok ? 'validated' : 'blocked'}</strong>
                  <code>{update.feedbackTxHash || update.successfulCallTxHash || update.paymentRef}</code>
                </div>
              )) : <p className="muted">Successful paid calls will be recorded on the reputation registry.</p>}
            </div>

            <div className="result-panel">
              <p className="panel-label">Final recommendation</p>
              <pre>{typeof run.result === 'string' ? run.result : JSON.stringify(run.result, null, 2)}</pre>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ToolCard({ agent, selected }: { agent: AnyObj; selected: boolean }) {
  const rep = agent.reputationSummary || {};
  const reputation = Number(rep.score ?? agent.reputation ?? 0);
  const displayRep = reputation > 0 ? `${reputation.toFixed(1)}/5` : 'new';

  return (
    <article className={`tool-card ${selected ? 'selected-card' : ''}`}>
      <div className="tool-topline">
        <span className="tool-id">#{agent.agentId}</span>
        <span className="price-pill">{agent.pricing?.display || formatUsdc(agent.priceAtomic)}</span>
      </div>
      <h3>{agent.name}</h3>
      <p>{agent.description}</p>
      <div className="trust-strip">
        <div><span>Reputation</span><strong>{displayRep}</strong></div>
        <div><span>Calls</span><strong>{rep.successfulCalls ?? agent.successfulCalls ?? 0}</strong></div>
      </div>
      <div className="capability-list">
        {(agent.capabilities || []).map((cap: string) => <span key={cap}>{cap}</span>)}
      </div>
      <code>{agent.endpoint}</code>
    </article>
  );
}

function FlowStep({ number, title, body, active }: { number: string; title: string; body: string; active?: boolean }) {
  return <div className={`flow-step ${active ? 'active' : ''}`}><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
