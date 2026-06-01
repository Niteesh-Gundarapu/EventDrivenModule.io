import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Database, ShieldAlert, Cpu } from 'lucide-react';

interface EventLog {
  id: string;
  category: 'KAFKA' | 'REDIS';
  source: string;
  action: string;
  target: string;
  detail: string;
  payload: any;
  timestamp: string;
}

interface EventStreamProps {
  logs: EventLog[];
  onClear: () => void;
}

export const EventStream: React.FC<EventStreamProps> = ({ logs, onClear }) => {
  const [filter, setFilter] = useState<'ALL' | 'KAFKA' | 'REDIS'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new log
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.category === filter;
  });

  return (
    <div 
      className="glass-panel" 
      style={{ 
        height: 'calc(100vh - 40px)', 
        margin: '20px 10px 20px 0', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-neon)'
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '15px', 
          borderBottom: '1px solid var(--border-light)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu className="pulse-glow" style={{ color: 'var(--accent-purple)' }} size={18} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-primary)' }}>
            EVENT MONITOR (KAFKA / REDIS)
          </h3>
        </div>
        <button 
          onClick={onClear}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-muted)', 
            cursor: 'pointer', 
            fontSize: '0.75rem',
            fontWeight: 600,
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          CLEAR
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}>
        <button 
          onClick={() => setFilter('ALL')}
          style={{ 
            background: filter === 'ALL' ? '#ffffff' : 'none', 
            border: 'none', 
            color: filter === 'ALL' ? 'var(--accent-purple)' : 'var(--text-secondary)',
            borderBottom: filter === 'ALL' ? '2px solid var(--accent-purple)' : 'none',
            padding: '10px 0',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            boxShadow: filter === 'ALL' ? '0 1px 3px rgba(15, 23, 42, 0.02)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          ALL PIPELINES
        </button>
        <button 
          onClick={() => setFilter('KAFKA')}
          style={{ 
            background: filter === 'KAFKA' ? '#ffffff' : 'none', 
            border: 'none', 
            color: filter === 'KAFKA' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
            borderBottom: filter === 'KAFKA' ? '2px solid var(--accent-emerald)' : 'none',
            padding: '10px 0',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            boxShadow: filter === 'KAFKA' ? '0 1px 3px rgba(15, 23, 42, 0.02)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          KAFKA TOPICS
        </button>
        <button 
          onClick={() => setFilter('REDIS')}
          style={{ 
            background: filter === 'REDIS' ? '#ffffff' : 'none', 
            border: 'none', 
            color: filter === 'REDIS' ? 'var(--accent-gold)' : 'var(--text-secondary)',
            borderBottom: filter === 'REDIS' ? '2px solid var(--accent-gold)' : 'none',
            padding: '10px 0',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            boxShadow: filter === 'REDIS' ? '0 1px 3px rgba(15, 23, 42, 0.02)' : 'none',
            transition: 'var(--transition-smooth)'
          }}
        >
          REDIS CACHE
        </button>
      </div>

      {/* Stream Area */}
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '15px', 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.78rem',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <Terminal size={24} />
            <span>Listening for transactions...</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isKafka = log.category === 'KAFKA';
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            
            return (
              <div 
                key={log.id} 
                style={{ 
                  borderLeft: `2.5px solid ${isKafka ? 'var(--accent-emerald)' : 'var(--accent-gold)'}`,
                  paddingLeft: '10px',
                  background: isKafka ? 'rgba(16, 185, 129, 0.05)' : 'rgba(217, 119, 6, 0.04)',
                  borderRadius: '0 6px 6px 0',
                  paddingTop: '6px',
                  paddingBottom: '6px'
                }}
              >
                {/* Meta details header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.7rem', marginBottom: '3px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isKafka ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                    {isKafka ? <Terminal size={10} /> : <Database size={10} />}
                    {log.target.toUpperCase()}
                  </span>
                  <span>{timestamp}</span>
                </div>

                {/* Event Name / Details */}
                <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{log.detail}</span>
                  {log.detail.includes('FRAUD_ALERT') && <ShieldAlert size={14} style={{ color: 'var(--accent-red)' }} />}
                </div>

                {/* Payload JSON Inspector */}
                <pre 
                  style={{ 
                    marginTop: '5px', 
                    padding: '8px', 
                    background: '#1e293b', 
                    borderRadius: '4px', 
                    fontSize: '0.7rem', 
                    overflowX: 'auto',
                    color: '#cbd5e1',
                    maxHeight: '120px',
                    border: '1px solid #334155'
                  }}
                >
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default EventStream;
