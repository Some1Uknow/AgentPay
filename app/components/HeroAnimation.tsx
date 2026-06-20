'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { UsdcLogo } from './brand';

export function AnimatedHeroConversation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Loop the animation
    const sequence = [
      800,  // Show user message
      2000, // Show agent typing
      2500, // Show agent response with proof
    ];
    
    let isMounted = true;
    let timeouts: NodeJS.Timeout[] = [];

    const runAnimation = () => {
      setStep(0);
      let cumulativeTime = 0;
      
      // Step 1
      cumulativeTime += sequence[0];
      timeouts.push(setTimeout(() => { if (isMounted) setStep(1); }, cumulativeTime));
      
      // Step 2
      cumulativeTime += sequence[1];
      timeouts.push(setTimeout(() => { if (isMounted) setStep(2); }, cumulativeTime));
      
      // Step 3
      cumulativeTime += sequence[2];
      timeouts.push(setTimeout(() => { if (isMounted) setStep(3); }, cumulativeTime));
      
      // Reset after a delay
      cumulativeTime += 6000;
      timeouts.push(setTimeout(() => { if (isMounted) runAnimation(); }, cumulativeTime));
    };

    runAnimation();

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="hero-visual" style={{ placeItems: 'center right' }}>
      <div className="conversation premium-conversation hero-animation-chat floating-card" style={{
        width: 'min(680px, 100%)', padding: '28px', background: 'rgba(17,18,24,0.6)', 
        borderRadius: '24px', border: '1px solid var(--line-strong)',
        backdropFilter: 'blur(16px)',
        minHeight: '440px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: 'var(--shadow)',
        position: 'relative'
      }}>
        
        {step >= 1 && (
          <div className="pro-bubble" data-role="user" style={{ animation: 'riseIn 0.5s ease-out forwards', maxWidth: '85%' }}>
            <span>user</span>
            <div>Find the safest Avalanche yield strategy and buy the risk report.</div>
          </div>
        )}

        {step >= 2 && (
          <div className="pro-bubble" data-role="assistant" style={{ animation: 'riseIn 0.5s ease-out forwards', maxWidth: '92%' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <img src="/branding_dark.png" alt="AgentPay" style={{ height: '14px', objectFit: 'contain' }} />
            </span>
            {step === 2 ? (
              <div className="agent-working" style={{ margin: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
                <div className="typing-indicator"><span /><span /><span /></div>
                <p>Checking budget and searching APIs...</p>
              </div>
            ) : (
              <div className="answer-block">
                <div className="decision-proof selected">
                  <div>
                    <strong>Defi Risk Scoring API</strong>
                    <b style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12} /> x402 paid</b>
                  </div>
                  <span>Passed reputation rules. Purchased report.</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UsdcLogo /> 0.05 USDC 
                    · 0x2f8b...a1c9
                  </span>
                </div>
                <p>The safest strategy is <strong>GLP on Aave</strong> with 4.2% APY. The paid risk report confirms no critical vulnerabilities.</p>
              </div>
            )}
          </div>
        )}

        {step === 0 && (
          <div style={{ opacity: 0.5, textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
            Awaiting instruction...
          </div>
        )}
      </div>
    </div>
  );
}
