import React from 'react';
import type { AnalyticsSummary } from 'shared';
import { ShieldAlert, TrendingUp, Users, RefreshCw, BarChart2, ShieldCheck, Zap } from 'lucide-react';

interface FraudAlert {
  id: string;
  type: string;
  entityId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  timestamp: string;
}

interface AdminPanelProps {
  metrics: AnalyticsSummary | null;
  fraudAlerts: FraudAlert[];
  onRefreshMetrics: () => void;
  surgeOverride: number;
  onSetSurgeOverride: (val: number) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  metrics,
  fraudAlerts,
  onRefreshMetrics,
  surgeOverride,
  onSetSurgeOverride
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      {/* Metrics Card Grid */}
      <div className="glass-panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart2 size={16} /> SYSTEM METRICS
          </h3>
          <button 
            onClick={onRefreshMetrics}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <RefreshCw size={14} style={{ transition: 'transform 0.5s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'rotate(180deg)'} />
          </button>
        </div>

        {metrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Revenue Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.08) 100%)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>TOTAL REVENUE</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-purple)', marginTop: '2px' }}>
                  ${metrics.totalRevenue.toFixed(2)}
                </div>
              </div>
              <TrendingUp size={24} style={{ color: 'var(--accent-purple)' }} />
            </div>

            {/* Minor Grid Items */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>TOTAL RIDES</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} style={{ color: 'var(--accent-purple)' }} /> {metrics.totalRides}
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>ACTIVE DRIVERS</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }}></span> {metrics.activeDrivers}
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>AVG MATCH TIME</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {metrics.matchingLatencyAvg.toFixed(1)}s
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block' }}>CANCEL RATE</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {metrics.cancellationRate}%
                </span>
              </div>

            </div>

          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Loading metrics...</div>
        )}
      </div>

      {/* Pricing Control Surges */}
      <div className="glass-panel" style={{ padding: '18px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '15px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Zap size={16} fill="none" /> PRICING SYSTEM SURGE
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Manual Surge Multiplier</span>
            <span style={{ color: 'var(--accent-gold)' }}>{surgeOverride.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={surgeOverride}
            onChange={(e) => onSetSurgeOverride(parseFloat(e.target.value))}
            style={{
              accentColor: 'var(--accent-gold)',
              cursor: 'pointer',
              width: '100%',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              height: '6px',
              appearance: 'auto',
              outline: 'none'
            }}
          />
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px' }}>
            Adjusting this adjusts pricing algorithm globally.
          </div>
        </div>
      </div>

      {/* Fraud Alert Panel */}
      <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={16} /> RADAR FRAUD ALERTS
        </h3>

        {fraudAlerts.length === 0 ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-emerald)' }}>
            <ShieldCheck size={18} />
            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NO THREATS DETECTED. SYSTEM SAFE.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {fraudAlerts.map((alert) => (
              <div 
                key={alert.id}
                style={{ 
                  background: 'rgba(244,63,94,0.08)', 
                  border: '1px solid rgba(244,63,94,0.25)', 
                  borderRadius: '8px', 
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '0.7rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span style={{ color: 'var(--accent-red)' }}>⚠️ {alert.type}</span>
                  <span className="badge badge-red" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>{alert.severity}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{alert.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
export default AdminPanel;
