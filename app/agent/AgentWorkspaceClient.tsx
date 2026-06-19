'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, Send, Settings, Sparkles, X } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { useEffect, useState } from 'react';
import { AgentAvatar, BrandLogo, ProtocolBadge, TxLink } from '../components/brand';

type AnyObj = any;
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  run?: AnyObj;
  error?: string;
};

const defaultTask = 'Find the safest Avalanche yield opportunity for 1,000 USDC';
const capabilityOptions = ['avalanche-defi-yield-search', 'defi-risk-scoring'];
const defaultPolicy = {
  maxBudgetAtomic: 100000,
  minReputation: 4,
  allowedCapabilities: capabilityOptions,
  maxTools: 2
};
const formatUsdc = (atomic?: number | string) => `${(Number(atomic || 0) / 1_000_000).toFixed(Number(atomic || 0) >= 10000 ? 2 : 3)} USDC`;

export default function AgentWorkspaceClient({ initialAgents, initialError = null }: { initialAgents: AnyObj[]; initialError?: string | null }) {
  const [agents, setAgents] = useState<AnyObj[]>(initialAgents);
  const [task, setTask] = useState(defaultTask);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [run, setRun] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [leftOpen, setLeftOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  async function loadAgents() {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (res.ok) setAgents(Array.isArray(data.agents) ? data.agents : []);
  }

  async function runAgent(next?: string) {
    const trimmed = (typeof next === 'string' ? next : task).trim();
    if (!trimmed || loading) return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: trimmed };
    setTask(trimmed);
    setMessages(current => [...current, userMessage]);
    setLoading(true);
    setRun(null);
    setError(null);
    try {
      const res = await fetch('/api/run-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: trimmed, ...policy })
      });
      const data = await res.json();
      if (res.ok) {
        setRun(data);
        setError(null);
        setMessages(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: data.result || 'Done.', run: data }]);
      } else {
        const message = data.error || 'Agent run failed';
        setRun(null);
        setError(message);
        setMessages(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: message, error: message }]);
      }
      await loadAgents();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Agent run failed';
      setError(message);
      setMessages(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: message, error: message }]);
    } finally {
      setLoading(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    runAgent();
  }

  useEffect(() => { loadAgents(); }, []);

  const activePolicy = run?.allowancePolicy || policy;
  const spent = Number(run?.totalSpentAtomic || 0);
  const remaining = Number(run?.remainingBudgetAtomic ?? Math.max(Number(activePolicy.maxBudgetAtomic || 0) - spent, 0));
  const isEmptyChat = messages.length === 0 && !loading && !error;

  return (
    <main className={`pro-chat agent-console inline-proof-layout ${isEmptyChat ? 'is-empty' : ''} ${!leftOpen ? 'left-collapsed' : ''}`}>
      <aside className="pro-sidebar">
        <div className="side-top"><BrandLogo compact={!leftOpen} /><button onClick={() => setLeftOpen(v => !v)} aria-label="Toggle sidebar">{leftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button></div>
        <div className="side-content" aria-hidden={!leftOpen}>
          <button className="new-thread" onClick={() => { setMessages([]); setRun(null); setError(initialError); setTask(defaultTask); }}>New session</button>
          <div className="run-history"><p>Spend limit</p><div className="history-item active"><span /><div><strong>{formatUsdc(policy.maxBudgetAtomic)}</strong><small>max the agent can spend</small></div></div></div>
          <div className="run-history"><p>Paid APIs</p><div className="mini-market-count"><strong>{agents.length}</strong><span>available tools</span></div></div>
          <nav className="side-links"><Link href="/registry">Tool registry</Link><Link href="/developer">Developer setup</Link><Link href="/">Landing</Link></nav>
        </div>
      </aside>

      <section className="pro-chat-main">
        <header className="pro-chat-header">
          <div><span>{run?.model ? `OpenAI · ${run.model}` : 'AI agent with a spend limit'}</span><h1>Ask a task. The agent can buy APIs only within your rules.</h1></div>
          <div className="header-badges">
            <div className="budget-card spend-card nav-spend-card" aria-label="Agent allowance">
              <div><span>Limit</span><strong>{formatUsdc(activePolicy.maxBudgetAtomic)}</strong></div><div><span>Spent</span><strong>{formatUsdc(spent)}</strong></div><div><span>Left</span><strong>{formatUsdc(remaining)}</strong></div>
              <div className="budget-bar"><i style={{ width: `${Math.min((spent / Number(activePolicy.maxBudgetAtomic || 1)) * 100, 100)}%` }} /></div>
            </div>
            <ProtocolBadge type="avax" label="Fuji" />
            <ProtocolBadge type="usdc" label="USDC" />
            <button className="icon-toggle" onClick={() => setPolicyOpen(true)} aria-label="Open allowance policy"><Settings size={18} /></button>
          </div>
        </header>

        <div className="conversation premium-conversation">
          {isEmptyChat ? <div className="empty-chat-center">
            <StartScreen agents={agents} />
            <Composer task={task} setTask={setTask} loading={loading} onRun={runAgent} onKeyDown={handleComposerKeyDown} />
          </div> : <>
            {!messages.length && error ? <Bubble role="assistant"><ErrorBlock error={error} /></Bubble> : null}
            {messages.map(message => (
              <Bubble key={message.id} role={message.role}>
                {message.error ? <ErrorBlock error={message.error} /> : message.run ? <Answer run={message.run} /> : message.content}
              </Bubble>
            ))}
            {loading ? <Bubble role="assistant"><Thinking /></Bubble> : null}
          </>}
        </div>

        {!isEmptyChat ? <footer className="pro-composer premium-composer">
          <Composer task={task} setTask={setTask} loading={loading} onRun={runAgent} onKeyDown={handleComposerKeyDown} />
        </footer> : null}
      </section>

      {policyOpen && (
        <div className="policy-modal-backdrop">
          <section className="policy-modal" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title">
            <div className="policy-modal-head">
              <div><span>Spend controls</span><h2 id="policy-modal-title">Allowance policy</h2></div>
              <button className="icon-toggle" onClick={() => setPolicyOpen(false)} aria-label="Close allowance policy"><X size={18} /></button>
            </div>
            <PolicyProof policy={policy} />
            <PolicyEditor policy={policy} setPolicy={setPolicy} disabled={loading} />
            <div className="policy-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setPolicy(defaultPolicy)} disabled={loading}>Reset</button>
              <button className="primary-button" type="button" onClick={() => setPolicyOpen(false)}>Done</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function StartScreen({ agents }: { agents: AnyObj[] }) {
  return <div className="start-screen console-start"><div className="start-orb"><Sparkles size={28} /></div><p className="console-kicker">Safe API spending for agents</p><h2>Ask for a job. The agent buys APIs if it needs them.</h2><p>It can choose from {agents.length || 3} paid APIs, but only if they fit your budget, reputation rule, and allowed task type. Every payment and result is shown back to you.</p></div>;
}
function Composer({
  task,
  setTask,
  loading,
  onRun,
  onKeyDown
}: {
  task: string;
  setTask: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  onRun: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  return <div className="input-row"><textarea value={task} onChange={e => setTask(e.target.value)} onKeyDown={onKeyDown} aria-label="Agent instruction" /><button onClick={() => onRun()} disabled={loading} aria-label="Run agent">{loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}</button></div>;
}
function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) { return <article className="pro-bubble" data-role={role}><span>{role}</span><div>{children}</div></article>; }
function Thinking() {
  return <div className="agent-working" aria-label="Agent is working">
    <div className="typing-indicator"><span /><span /><span /></div>
    <p>Choosing APIs, paying if allowed, and waiting for proof.</p>
  </div>;
}
function shortError(error: string) {
  if (error.includes('did not complete any approved paid tool call')) return 'I could not complete a paid tool call for this request. Try a concrete Avalanche yield/risk task or loosen the allowance policy.';
  return error.length > 180 ? `${error.slice(0, 180)}...` : error;
}
function ErrorBlock({ error }: { error: string }) {
  const short = shortError(error);
  return <div className="agent-error"><strong>Run blocked</strong><p>{short}</p>{short !== error ? <details><summary>Technical details</summary><p>{error}</p></details> : null}</div>;
}
function Answer({ run }: { run: AnyObj }) {
  const isChat = run?.mode === 'chat';
  return <div className="answer-block">
    <Streamdown className="markdown-answer" controls={false} linkSafety={{ enabled: false }}>{run?.result || ''}</Streamdown>
    {!isChat ? <>
      <div className="answer-summary-grid"><strong>{run?.selectedTools?.length || 0}</strong><span>tools hired</span><strong>{run?.totalSpentDisplay}</strong><span>paid</span><strong>{run?.rejectedTools?.length || 0}</strong><span>rejected</span></div>
      <InlineRunProof run={run} />
    </> : null}
  </div>;
}
function ProofSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="proof-section-card"><h3>{title}</h3>{children}</section>; }
function InlineRunProof({ run }: { run: AnyObj }) {
  const selectedIds = new Set((run?.selectedTools || []).map((tool: AnyObj) => tool.agentId));
  const rejectedIds = new Set((run?.rejectedTools || []).map((tool: AnyObj) => tool.agentId));
  const tools = run?.discoveredTools || [];
  const agentEvents = (run?.agentEvents || []).filter((event: AnyObj) => ['inspect-tool-market', 'paid-tool-call', 'payment-denied'].includes(event.type));

  return <div className="inline-proof-trail" aria-label="Execution proof">
    <div className="spend-approval-note">
      <strong>Why it paid</strong>
      <span>Your request needed paid yield/risk data. The current rules allowed up to {formatUsdc(run?.allowancePolicy?.maxBudgetAtomic)}, {run?.allowancePolicy?.maxTools || 0} APIs, and providers with reputation {run?.allowancePolicy?.minReputation}/5 or better.</span>
    </div>
    <ProofSection title="Tool market">{tools.length ? tools.map((tool: AnyObj) => <ToolProof key={tool.agentId} tool={tool} selected={selectedIds.has(tool.agentId)} rejected={rejectedIds.has(tool.agentId)} />) : <p className="empty-copy">No paid tool market was needed for this response.</p>}</ProofSection>
    <ProofSection title="Agent API calls">{agentEvents.length ? agentEvents.map((event: AnyObj, i: number) => <AgentEventProof key={`${event.type}-${i}`} event={event} />) : <p className="empty-copy">No paid calls were requested.</p>}</ProofSection>
    <ProofSection title="Decision trace">{(run?.decisionTrace || []).length ? run.decisionTrace.map((entry: AnyObj) => <DecisionProof key={entry.agentId} entry={entry} />) : <p className="empty-copy">No policy decisions were needed.</p>}</ProofSection>
    <ProofSection title="x402 receipts">{(run?.payments || []).length ? run.payments.map((p: AnyObj, i: number) => <TxProof key={p.txHash || i} title={p.tool} meta={formatUsdc(p.amount)} hash={p.txHash} />) : <p className="empty-copy">No payment was sent.</p>}</ProofSection>
    <ProofSection title="Reputation writes">{(run?.reputationUpdates || []).length ? run.reputationUpdates.map((u: AnyObj) => <TxProof key={u.feedbackTxHash} title={u.name} meta="validated · 5/5" hash={u.feedbackTxHash} />) : <p className="empty-copy">No reputation write was created.</p>}</ProofSection>
  </div>;
}
function PolicyEditor({ policy, setPolicy, disabled }: { policy: typeof defaultPolicy; setPolicy: React.Dispatch<React.SetStateAction<typeof defaultPolicy>>; disabled: boolean }) {
  function toggleCapability(capability: string) {
    setPolicy(current => {
      const has = current.allowedCapabilities.includes(capability);
      const next = has ? current.allowedCapabilities.filter(item => item !== capability) : [...current.allowedCapabilities, capability];
      return { ...current, allowedCapabilities: next.length ? next : current.allowedCapabilities };
    });
  }

  return <div className="policy-editor" aria-label="Allowance policy">
    <label><span>Allowance</span><input disabled={disabled} type="number" min="1" step="1000" value={policy.maxBudgetAtomic} onChange={e => setPolicy(p => ({ ...p, maxBudgetAtomic: Number(e.target.value) }))} /></label>
    <label><span>Min rep</span><input disabled={disabled} type="number" min="0" max="5" step="0.1" value={policy.minReputation} onChange={e => setPolicy(p => ({ ...p, minReputation: Number(e.target.value) }))} /></label>
    <label><span>Max tools</span><input disabled={disabled} type="number" min="1" max="3" step="1" value={policy.maxTools} onChange={e => setPolicy(p => ({ ...p, maxTools: Number(e.target.value) }))} /></label>
    <div className="cap-toggle-row">{capabilityOptions.map(capability => <button key={capability} type="button" disabled={disabled} className={policy.allowedCapabilities.includes(capability) ? 'active' : ''} onClick={() => toggleCapability(capability)}>{capability.replace('avalanche-defi-', '').replace('defi-', '')}</button>)}</div>
  </div>;
}
function PolicyProof({ policy }: { policy: AnyObj }) {
  return <div className="policy-proof"><div><span>max spend</span><strong>{formatUsdc(policy.maxBudgetAtomic)}</strong></div><div><span>min reputation</span><strong>{policy.minReputation}/5</strong></div><div><span>max APIs</span><strong>{policy.maxTools}</strong></div><p>{(policy.allowedCapabilities || []).join(', ')}</p></div>;
}
function ToolProof({ tool, selected, rejected }: { tool: AnyObj; selected: boolean; rejected: boolean }) {
  const label = selected ? 'hired' : rejected ? 'rejected' : 'available';
  const rep = tool.scoring?.score ? `score ${tool.scoring.score}` : `${Number(tool.reputationSummary?.score || tool.reputation || 0).toFixed(1)}/5 rep`;
  return <div className={`tool-proof ${selected ? 'selected' : ''} ${rejected ? 'rejected' : ''}`}><AgentAvatar name={tool.name} /><div><strong>{tool.name}</strong><span>{rep} · {tool.pricing?.display}</span></div><b>{label}</b></div>;
}
function DecisionProof({ entry }: { entry: AnyObj }) {
  return <div className={`decision-proof ${entry.action}`}><div><strong>{entry.name}</strong><b>{entry.action}</b></div><span>{entry.reasons?.[0]}</span><span>{entry.reasons?.[1]}</span><span>{entry.reasons?.[2]}</span></div>;
}
function AgentEventProof({ event }: { event: AnyObj }) {
  const output = event.output || {};
  if (event.type === 'inspect-tool-market') return <div className="decision-proof selected"><div><strong>OpenAI inspected market</strong><b>{output.tools?.length || 0} tools</b></div><span>Remaining allowance: {formatUsdc(output.remainingBudgetAtomic)}</span></div>;
  if (event.type === 'payment-denied') return <div className="decision-proof rejected"><div><strong>{output.tool || `Agent #${output.agentId}`}</strong><b>denied</b></div><span>{output.denialReason}</span></div>;
  return <div className="decision-proof selected"><div><strong>{output.tool}</strong><b>paid</b></div><span>{output.reason}</span><span>{output.amountDisplay} · {output.paymentTxHash || 'receipt pending'}</span></div>;
}
function TxProof({ title, meta, hash }: { title: string; meta: string; hash?: string }) { return <div className="tx-proof"><div><strong>{title}</strong><span>{meta}</span></div><TxLink hash={hash} /></div>; }
