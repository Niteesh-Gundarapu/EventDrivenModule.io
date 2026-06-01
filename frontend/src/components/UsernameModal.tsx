import React, { useState } from 'react';
import { User, ShieldAlert } from 'lucide-react';

interface UsernameModalProps {
  onEnterChat: (username: string) => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({ onEnterChat }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim();
    
    if (!cleanName) {
      setError('Username cannot be empty.');
      return;
    }

    if (cleanName.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (cleanName.toLowerCase() === 'system') {
      setError('Reserved system username. Please choose another.');
      return;
    }

    // Pass name back to coordinator
    onEnterChat(cleanName);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(5, 4, 8, 0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        className="glass-panel pulse-glow" 
        style={{
          width: '400px',
          padding: '30px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          background: 'rgba(20, 15, 38, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        {/* Glowing Shield/User Icon Banner */}
        <div 
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid var(--accent-purple)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-purple)',
            marginBottom: '20px',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)'
          }}
        >
          <User size={30} />
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.5px' }}>
          ENTER PLATFORM CHAT
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.4 }}>
          Enter a screen name to connect with other developers and track real-time message telemetry.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ width: '100%', position: 'relative' }}>
            <input
              type="text"
              placeholder="E.g. Neo, Trinity..."
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              maxLength={15}
              className="glass-input"
              style={{
                textAlign: 'center',
                fontSize: '1rem',
                fontWeight: 600,
                padding: '14px'
              }}
              autoFocus
            />
          </div>

          {/* Validation Alert */}
          {error && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--accent-red)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: '8px',
                padding: '8px 12px',
                textAlign: 'left'
              }}
            >
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit"
            className="glass-button"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '0.9rem',
              marginTop: '5px'
            }}
          >
            JOIN LIVE CHATROOM
          </button>
        </form>
      </div>
    </div>
  );
};
export default UsernameModal;
