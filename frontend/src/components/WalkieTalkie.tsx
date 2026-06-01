// ============================================================================
// WalkieTalkie — Voice Hub UI Component
// ============================================================================
// Screens:
//   1. Room Browser — grid of all active rooms; create/join actions
//   2. Active Room — PTT button, waveform visualizer, user roster, mini chat
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useWalkie } from '../hooks/useWalkie';
import type { WalkieRoom, WalkieMember } from '../hooks/useWalkie';
import {
  Radio, Plus, LogOut, Mic, MicOff, Users, Lock, Globe,
  MapPin, Clock, Wifi, Signal, Volume2, MessageCircle, Send,
  X, Eye, EyeOff, RefreshCw, Shield
} from 'lucide-react';

// ============================================================
// ANIMATED CANVAS BACKGROUND — Particle Network + Sine Wave
// ============================================================
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number; // 180–260 (cyan to indigo)
  alpha: number;
}

function VoiceHubBackground({ isTalking = false }: { isTalking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const talkingRef = useRef(isTalking);

  useEffect(() => { talkingRef.current = isTalking; }, [isTalking]);

  const initParticles = useCallback((w: number, h: number) => {
    particlesRef.current = Array.from({ length: 55 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2.5 + 1,
      hue: 180 + Math.random() * 80,
      alpha: 0.5 + Math.random() * 0.5,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { width: W, height: H } = canvas;
      t += 0.008;

      // Fade trail — dark with slight transparency for motion blur
      ctx.fillStyle = 'rgba(10, 15, 30, 0.18)';
      ctx.fillRect(0, 0, W, H);

      const pts = particlesRef.current;
      const talking = talkingRef.current;
      const speed = talking ? 1.8 : 1.0;

      // Update + draw particles
      pts.forEach((p) => {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        // Glow dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + (talking ? 1 : 0), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.alpha})`;
        ctx.shadowBlur = talking ? 18 : 8;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Connecting lines between nearby particles
      const maxDist = talking ? 140 : 110;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (talking ? 0.35 : 0.15);
            const hue = (pts[i].hue + pts[j].hue) / 2;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${alpha})`;
            ctx.lineWidth = talking ? 0.8 : 0.5;
            ctx.stroke();
          }
        }
      }

      // Sine wave floor
      const waveCount = 2;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const amp = talking ? (28 + w * 12) : (14 + w * 8);
        const freq = 0.012 - w * 0.002;
        const yBase = H * 0.82 + w * 18;
        const phaseOff = w * 1.2;
        const wHue = 200 + w * 40;

        for (let x = 0; x <= W; x += 3) {
          const y = yBase + Math.sin(x * freq + t + phaseOff) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${wHue}, 80%, 65%, ${talking ? 0.5 : 0.2})`;
        ctx.lineWidth = talking ? 2 : 1;
        ctx.shadowBlur = talking ? 12 : 4;
        ctx.shadowColor = `hsl(${wHue}, 90%, 70%)`;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}



// ---- Sub-components ----

// Animated waveform bars shown while someone is talking
function AudioWave({ isActive, color = '#06b6d4' }: { isActive: boolean; color?: string }) {
  const bars = [3, 7, 5, 9, 4, 8, 6, 10, 5, 7, 3, 8, 6];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '32px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={isActive ? 'walkie-wave-bar active' : 'walkie-wave-bar'}
          style={{
            width: '3px',
            borderRadius: '2px',
            background: isActive ? color : '#cbd5e1',
            height: isActive ? `${h * 3}px` : '4px',
            animationDelay: `${i * 0.07}s`,
            transition: 'height 0.15s ease, background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

// Volume meter bar
function VolumeMeter({ level }: { level: number }) {
  const pct = Math.round(level * 100);
  return (
    <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#06b6d4',
          borderRadius: '999px',
          transition: 'width 0.05s linear',
        }}
      />
    </div>
  );
}

// Country flag emoji from country code
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const codePoints = [...code.toUpperCase()].map(
    (c) => 127397 + c.charCodeAt(0)
  );
  return String.fromCodePoint(...codePoints);
}

// Relative time formatter
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// Member card in the roster
function MemberCard({
  member,
  mySocketId,
  volumeLevel,
}: {
  member: WalkieMember;
  mySocketId: string;
  volumeLevel: number;
}) {
  const isMe = member.socketId === mySocketId;
  const talking = member.isTalking;
  const initials = member.username.slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderRadius: '12px',
        background: talking
          ? 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.04) 100%)'
          : 'rgba(248,250,252,0.8)',
        border: talking ? '1px solid rgba(6,182,212,0.4)' : '1px solid #e2e8f0',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Talking ring animation */}
      {talking && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '12px',
          boxShadow: '0 0 0 2px rgba(6,182,212,0.6)',
          animation: 'talkRing 1s ease-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: talking
            ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
            : isMe
            ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
            : 'linear-gradient(135deg, #64748b, #475569)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: '0.9rem',
          fontFamily: 'var(--font-display)',
          boxShadow: talking ? '0 0 14px rgba(6,182,212,0.5)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          {initials}
        </div>
        {talking && (
          <div style={{
            position: 'absolute', bottom: '-3px', right: '-3px',
            width: '14px', height: '14px', borderRadius: '50%',
            background: '#06b6d4',
            border: '2px solid white',
            animation: 'recordBlink 0.8s ease infinite',
          }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{
            fontWeight: 700, fontSize: '0.85rem', color: '#0f172a',
            fontFamily: 'var(--font-display)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {member.username}
          </span>
          {isMe && (
            <span style={{
              fontSize: '0.6rem', padding: '1px 6px', borderRadius: '999px',
              background: 'rgba(99,102,241,0.1)', color: '#6366f1',
              fontWeight: 700, letterSpacing: '0.5px',
            }}>YOU</span>
          )}
          {talking && (
            <span style={{
              fontSize: '0.6rem', padding: '1px 6px', borderRadius: '999px',
              background: 'rgba(6,182,212,0.15)', color: '#0891b2',
              fontWeight: 700, letterSpacing: '0.5px', animation: 'fadeInOut 1s infinite',
            }}>● LIVE</span>
          )}
        </div>

        {/* Location row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.75rem' }}>{flagEmoji(member.countryCode)}</span>
          <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
            {member.city}, {member.country}
          </span>
          <span style={{ color: '#cbd5e1', fontSize: '0.6rem' }}>•</span>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
            {member.ip}
          </span>
        </div>

        {/* Volume meter */}
        {(talking || volumeLevel > 0) && <VolumeMeter level={volumeLevel} />}

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
          <Clock size={10} color="#94a3b8" />
          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
            Joined {timeAgo(member.joinedAt)}
          </span>
        </div>
      </div>

      {/* Wave visual */}
      <div style={{ flexShrink: 0 }}>
        <AudioWave isActive={talking} color="#06b6d4" />
      </div>
    </div>
  );
}

// Room card in the browser grid
function RoomCard({
  room,
  onJoin,
}: {
  room: WalkieRoom;
  onJoin: (room: WalkieRoom) => void;
}) {
  const isFull = room.members.length >= room.maxUsers;
  const hasTalker = !!room.talkingSocketId;

  return (
    <div
      onClick={() => !isFull && onJoin(room)}
      className={`walkie-room-card ${hasTalker ? 'room-active' : ''}`}
      style={{
        padding: '18px',
        borderRadius: '16px',
        background: hasTalker
          ? 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)'
          : '#ffffff',
        border: hasTalker ? '1px solid rgba(6,182,212,0.35)' : '1px solid #e2e8f0',
        cursor: isFull ? 'not-allowed' : 'pointer',
        opacity: isFull ? 0.6 : 1,
        transition: 'all 0.25s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pulse overlay when room is active */}
      {hasTalker && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '16px',
          background: 'rgba(6,182,212,0.03)',
          animation: 'roomPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: hasTalker
              ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
              : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: hasTalker ? '0 0 12px rgba(6,182,212,0.4)' : '0 4px 10px rgba(99,102,241,0.25)',
          }}>
            <Radio size={18} color="white" />
          </div>
          <div>
            <div style={{
              fontWeight: 800, fontSize: '0.95rem', color: '#0f172a',
              fontFamily: 'var(--font-display)', marginBottom: '2px',
            }}>
              {room.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              by {room.creatorName}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {room.isLocked && <Lock size={14} color="#94a3b8" />}
          {hasTalker && (
            <span style={{
              fontSize: '0.6rem', padding: '2px 7px', borderRadius: '999px',
              background: 'rgba(6,182,212,0.15)', color: '#0891b2', fontWeight: 700,
              animation: 'fadeInOut 1.2s ease infinite',
            }}>● ON AIR</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Users size={13} color="#94a3b8" />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
            {room.members.length}/{room.maxUsers}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={13} color="#94a3b8" />
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{timeAgo(room.createdAt)}</span>
        </div>
        {isFull && (
          <span style={{
            fontSize: '0.6rem', padding: '2px 7px', borderRadius: '999px',
            background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontWeight: 700,
          }}>FULL</span>
        )}
      </div>

      {/* Member avatars */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '10px' }}>
        {room.members.slice(0, 6).map((m, idx) => (
          <div key={m.socketId} style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: m.isTalking
              ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
              : `hsl(${(idx * 60 + 200) % 360}, 60%, 55%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '0.65rem', fontWeight: 800,
            border: m.isTalking ? '2px solid #06b6d4' : '2px solid white',
            boxShadow: m.isTalking ? '0 0 8px rgba(6,182,212,0.6)' : 'none',
            transition: 'all 0.2s ease',
            marginLeft: idx > 0 ? '-6px' : 0,
            zIndex: 10 - idx,
          }}>
            {m.username.slice(0, 1).toUpperCase()}
          </div>
        ))}
        {room.members.length > 6 && (
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '2px' }}>
            +{room.members.length - 6}
          </span>
        )}
      </div>

      {/* Wave preview */}
      {hasTalker && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <AudioWave isActive={true} color="#06b6d4" />
        </div>
      )}

      {!isFull && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '8px', borderRadius: '8px',
          background: 'rgba(99,102,241,0.06)', color: '#6366f1',
          fontSize: '0.78rem', fontWeight: 700,
          marginTop: hasTalker ? '10px' : '0',
        }}>
          <Radio size={13} /> JOIN CHANNEL
        </div>
      )}
    </div>
  );
}

// Create room modal
function CreateRoomModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, password?: string, maxUsers?: number) => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [maxUsers, setMaxUsers] = useState(10);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), password.trim() || undefined, maxUsers);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '20px', padding: '32px',
          width: '420px', maxWidth: '95vw',
          boxShadow: '0 25px 60px rgba(15,23,42,0.2)',
          border: '1px solid rgba(99,102,241,0.15)',
          animation: 'slideUpFade 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Create Voice Channel
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Others can see and join your channel</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              CHANNEL NAME *
            </label>
            <input
              className="glass-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Operations Alpha, Team Bravo..."
              autoFocus
              maxLength={40}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              PASSWORD (optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="glass-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for open channel"
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              MAX USERS: {maxUsers}
            </label>
            <input
              type="range" min={2} max={20} value={maxUsers}
              onChange={(e) => setMaxUsers(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
              <span>2</span><span>20</span>
            </div>
          </div>

          <button
            type="submit"
            className="glass-button"
            style={{ marginTop: '8px', fontSize: '0.9rem', padding: '13px' }}
          >
            <Radio size={16} /> Create Channel
          </button>
        </form>
      </div>
    </div>
  );
}

// Password entry dialog for locked rooms
function JoinPasswordModal({
  room,
  onClose,
  onJoin,
}: {
  room: WalkieRoom;
  onClose: () => void;
  onJoin: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff', borderRadius: '20px', padding: '32px',
          width: '360px', maxWidth: '95vw',
          boxShadow: '0 25px 60px rgba(15,23,42,0.2)',
          border: '1px solid rgba(99,102,241,0.15)',
          animation: 'slideUpFade 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={20} color="#6366f1" />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Private Channel
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '20px' }}>
          <strong>{room.name}</strong> requires a password to join.
        </p>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            className="glass-input"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter channel password"
            style={{ paddingRight: '42px' }}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onJoin(password)}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
            }}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          className="glass-button"
          onClick={() => onJoin(password)}
          style={{ width: '100%', fontSize: '0.88rem', padding: '12px' }}
        >
          <Radio size={15} /> Enter Channel
        </button>
      </div>
    </div>
  );
}

// ---- Main WalkieTalkie Component ----
interface WalkieTalkieProps {
  socket: Socket | null;
  defaultUsername?: string;
}

export function WalkieTalkie({ socket, defaultUsername = 'Operator' }: WalkieTalkieProps) {
  const [username, setUsername] = useState(
    localStorage.getItem('walkie_username') || defaultUsername
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingJoinRoom, setPendingJoinRoom] = useState<WalkieRoom | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [roomChat, setRoomChat] = useState<{ user: string; text: string; time: string }[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [talkTimer, setTalkTimer] = useState(0);
  const talkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const {
    rooms, activeRoom, isTalking, isMuted,
    error, geoMeta, volumeLevels,
    fetchRooms, createRoom, joinRoom, leaveRoom,
    startTalking, stopTalking, toggleMute, clearError,
  } = useWalkie(socket, username);

  // Talk timer
  useEffect(() => {
    if (isTalking) {
      setTalkTimer(0);
      talkTimerRef.current = setInterval(() => setTalkTimer((t) => t + 1), 1000);
    } else {
      setTalkTimer(0);
      if (talkTimerRef.current) clearInterval(talkTimerRef.current);
    }
    return () => { if (talkTimerRef.current) clearInterval(talkTimerRef.current); };
  }, [isTalking]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomChat]);

  // Listen for active voice channel socket text messages
  useEffect(() => {
    if (!socket || !activeRoom) {
      setRoomChat([]);
      return;
    }

    const onChatMessage = (msg: { user: string; text: string; time: string }) => {
      console.log('[WalkieChat:Frontend] Received message from socket:', msg);
      setRoomChat((prev) => [...prev, msg]);
    };

    console.log('[WalkieChat:Frontend] Registering walkie:chat_message socket listener for room:', activeRoom.id);
    socket.on('walkie:chat_message', onChatMessage);

    return () => {
      console.log('[WalkieChat:Frontend] Cleaning up walkie:chat_message socket listener for room:', activeRoom.id);
      socket.off('walkie:chat_message', onChatMessage);
    };
  }, [socket, activeRoom]);

  // Persist: Save active voice room ID on join, and clear on leave
  useEffect(() => {
    if (activeRoom) {
      localStorage.setItem('walkie_active_room_id', activeRoom.id);
    } else {
      localStorage.removeItem('walkie_active_room_id');
    }
  }, [activeRoom]);

  // Persist: Auto-rejoin active voice room on reload once socket is ready
  useEffect(() => {
    if (!socket || activeRoom) return;

    const savedRoomId = localStorage.getItem('walkie_active_room_id');
    if (savedRoomId) {
      console.log('[Walkie:Restore] Reconnecting to voice room:', savedRoomId);
      joinRoom(savedRoomId);
    }
  }, [socket, activeRoom, joinRoom]);

  const mySocketId = (socket as any)?.id || '';

  const handleJoinRoom = (room: WalkieRoom) => {
    if (room.isLocked) {
      setPendingJoinRoom(room);
    } else {
      joinRoom(room.id);
    }
  };

  const sendRoomChat = () => {
    console.log('[WalkieChat:Frontend] sendRoomChat triggered. Input:', chatInput, 'Socket connected:', socket?.connected, 'ActiveRoom:', activeRoom?.id);
    if (!chatInput.trim() || !socket || !activeRoom) {
      console.warn('[WalkieChat:Frontend] Cancelled send. Missing inputs or socket.');
      return;
    }
    
    console.log('[WalkieChat:Frontend] Emitting walkie:chat_message event to backend');
    socket.emit('walkie:chat_message', {
      roomId: activeRoom.id,
      username,
      text: chatInput.trim(),
    });
    setChatInput('');
  };

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Find who is currently talking
  const talkingMember = activeRoom?.members.find((m) => m.isTalking);

  // ==================== ROOM BROWSER ====================
  if (!activeRoom) {
    return (
      <div style={{
        height: '100%',
        background: 'linear-gradient(160deg, #0d1117 0%, #0a1628 50%, #0d1b2a 100%)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Animated particle canvas background */}
        <VoiceHubBackground isTalking={false} />

        {/* All content sits above the canvas */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(6,182,212,0.35)',
              }}>
                <Radio size={20} color="white" />
              </div>
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800,
                  background: 'linear-gradient(135deg, #06b6d4 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  margin: 0,
                }}>
                  VOICE HUB
                </h1>
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>
                  Push-to-talk global channels
                </p>
              </div>
            </div>

            {/* Geo badge */}
            {geoMeta && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.9rem' }}>{flagEmoji(geoMeta.countryCode)}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  {geoMeta.city}, {geoMeta.country}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>•</span>
                <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  {geoMeta.ip}
                </span>
              </div>
            )}
          </div>

          {/* Username + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  localStorage.setItem('walkie_username', e.target.value);
                }}
                placeholder="Your callsign..."
                style={{
                  width: '160px', fontSize: '0.85rem', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.07)', color: '#e2e8f0',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                }}
                maxLength={20}
              />
            </div>
            <button
              onClick={fetchRooms}
              className="glass-button glass-button-secondary"
              style={{ padding: '10px', borderRadius: '10px' }}
              title="Refresh channels"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="glass-button"
              style={{
                padding: '10px 18px', fontSize: '0.82rem', gap: '7px',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                boxShadow: '0 4px 14px rgba(6,182,212,0.35)',
              }}
            >
              <Plus size={16} /> Create Channel
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            margin: '16px 32px 0', padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: '#dc2626', fontSize: '0.82rem', fontWeight: 600,
          }}>
            <span>{error}</span>
            <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: '24px', padding: '14px 32px',
          background: 'rgba(6,182,212,0.06)', borderBottom: '1px solid rgba(6,182,212,0.12)',
          backdropFilter: 'blur(10px)',
        }}>
          {[
            { icon: <Signal size={14} />, label: 'ACTIVE CHANNELS', value: rooms.length },
            { icon: <Users size={14} />, label: 'TOTAL USERS', value: rooms.reduce((s, r) => s + r.members.length, 0) },
            { icon: <Wifi size={14} />, label: 'ON AIR', value: rooms.filter((r) => r.talkingSocketId).length },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#06b6d4' }}>{icon}</span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{label}</span>
              <span style={{
                fontSize: '1rem', fontWeight: 800, color: '#e2e8f0',
                fontFamily: 'var(--font-display)',
              }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Room grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {rooms.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: '300px', gap: '16px',
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(99,102,241,0.05) 100%)',
                border: '1px solid rgba(6,182,212,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Radio size={36} color="#06b6d4" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', marginBottom: '6px' }}>
                  No Active Channels
                </p>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Create the first voice channel to get started
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="glass-button"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', boxShadow: '0 4px 14px rgba(6,182,212,0.35)' }}
              >
                <Plus size={16} /> Create First Channel
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}>
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={handleJoinRoom} />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {showCreateModal && (
          <CreateRoomModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(name, password, maxUsers) => createRoom(name, password, maxUsers)}
          />
        )}
        {pendingJoinRoom && (
          <JoinPasswordModal
            room={pendingJoinRoom}
            onClose={() => setPendingJoinRoom(null)}
            onJoin={(pw) => {
              joinRoom(pendingJoinRoom.id, pw);
              setPendingJoinRoom(null);
            }}
          />
        )}
        </div>
      </div>
    );
  }

  // ==================== ACTIVE ROOM VIEW ====================
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #0a0f1e 0%, #0d1627 100%)',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Animated canvas — reacts to talking state */}
      <VoiceHubBackground isTalking={!!talkingMember} />
      {/* Room header bar */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: isTalking
              ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
              : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isTalking ? '0 0 16px rgba(6,182,212,0.6)' : 'none',
            transition: 'all 0.3s ease',
          }}>
            <Radio size={16} color="white" />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem',
              color: '#f1f5f9',
            }}>
              {activeRoom.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {activeRoom.members.length} connected · LIVE CHANNEL
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowChat((prev) => !prev);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: showChat ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)',
              color: showChat ? '#a5b4fc' : '#94a3b8',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            <MessageCircle size={14} /> CHAT
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              leaveRoom();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: 'rgba(239,68,68,0.15)', color: '#f87171',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            <LogOut size={14} /> LEAVE
          </button>
        </div>
      </div>

      {/* Main body */}
      <div className="walkie-active-body">

        {/* Left: PTT + Visualizer */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px', gap: '32px',
        }}>

          {/* Talking indicator banner */}
          <div style={{
            padding: '10px 20px', borderRadius: '12px',
            background: talkingMember
              ? 'rgba(6,182,212,0.15)'
              : 'rgba(255,255,255,0.04)',
            border: talkingMember
              ? '1px solid rgba(6,182,212,0.3)'
              : '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: '12px',
            transition: 'all 0.3s ease',
            minWidth: '280px', justifyContent: 'center',
          }}>
            {talkingMember ? (
              <>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#06b6d4', animation: 'recordBlink 0.8s ease infinite' }} />
                <span style={{ color: '#67e8f9', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-display)' }}>
                  {talkingMember.socketId === mySocketId ? 'YOU ARE TRANSMITTING' : `${talkingMember.username} IS TRANSMITTING`}
                </span>
                {isTalking && (
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                    {formatTimer(talkTimer)}
                  </span>
                )}
              </>
            ) : (
              <>
                <Volume2 size={16} color="#475569" />
                <span style={{ color: '#475569', fontSize: '0.85rem' }}>Channel Clear — Push to Talk</span>
              </>
            )}
          </div>

          {/* Large waveform visualizer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            height: '80px', padding: '0 20px',
          }}>
            {Array.from({ length: 24 }).map((_, i) => {
              const baseH = [4, 8, 12, 20, 28, 36, 44, 52, 56, 60, 58, 52, 44, 40, 36, 28, 20, 16, 12, 8, 6, 4, 6, 8][i];
              return (
                <div
                  key={i}
                  className={talkingMember ? 'walkie-wave-bar active' : 'walkie-wave-bar'}
                  style={{
                    width: '5px',
                    borderRadius: '3px',
                    background: talkingMember
                      ? `rgba(6,182,212,${0.4 + (i % 3) * 0.2})`
                      : 'rgba(255,255,255,0.08)',
                    height: talkingMember ? `${baseH}px` : '6px',
                    animationDelay: `${i * 0.05}s`,
                    transition: 'height 0.15s ease, background 0.2s ease',
                  }}
                />
              );
            })}
          </div>

          {/* PTT Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <button
              className={`ptt-button ${isTalking ? 'active' : ''} ${isMuted ? 'muted' : ''}`}
              onMouseDown={startTalking}
              onMouseUp={stopTalking}
              onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
              disabled={isMuted}
              style={{
                width: '140px', height: '140px', borderRadius: '50%', border: 'none',
                background: isMuted
                  ? 'rgba(100,116,139,0.3)'
                  : isTalking
                  ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                cursor: isMuted ? 'not-allowed' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: isTalking
                  ? '0 0 0 8px rgba(6,182,212,0.2), 0 0 0 16px rgba(6,182,212,0.1), 0 8px 40px rgba(6,182,212,0.5)'
                  : isMuted
                  ? 'none'
                  : '0 8px 30px rgba(99,102,241,0.45)',
                transform: isTalking ? 'scale(1.06)' : 'scale(1)',
                transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            >
              {isMuted ? <MicOff size={40} /> : <Mic size={40} />}
              <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.5px', fontFamily: 'var(--font-display)' }}>
                {isMuted ? 'MUTED' : isTalking ? 'TRANSMIT' : 'HOLD PTT'}
              </span>
            </button>

            <p style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'center' }}>
              {isMuted ? 'Unmute to talk' : 'Hold button or press SPACE to transmit'}
            </p>

            {/* Secondary controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={toggleMute}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '10px', border: 'none',
                  background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                  color: isMuted ? '#f87171' : '#94a3b8',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                  transition: 'all 0.2s ease',
                }}
              >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                {isMuted ? 'UNMUTE' : 'MUTE SELF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: User Roster */}
        <div style={{
          width: '320px', borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.03)',
        }}>
          {/* Roster header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#94a3b8" />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px' }}>
                MEMBERS — {activeRoom.members.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={13} color="#94a3b8" />
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{activeRoom.creatorName}</span>
            </div>
          </div>

          {/* Member list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeRoom.members.map((member) => (
              <MemberCard
                key={member.socketId}
                member={member}
                mySocketId={mySocketId}
                volumeLevel={volumeLevels[member.socketId] || 0}
              />
            ))}
          </div>

          {/* Location info for self */}
          {geoMeta && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(6,182,212,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Globe size={13} color="#06b6d4" />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#67e8f9', letterSpacing: '1px' }}>YOUR LOCATION</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1rem' }}>{flagEmoji(geoMeta.countryCode)}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                  {geoMeta.city}, {geoMeta.country}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <MapPin size={11} color="#64748b" />
                <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  {geoMeta.lat.toFixed(4)}, {geoMeta.lng.toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <Wifi size={11} color="#64748b" />
                <span style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  {geoMeta.ip}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar (toggleable) */}
        {showChat && (
          <div style={{
            width: '280px', borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(255,255,255,0.02)',
            animation: 'slideInRight 0.2s ease',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={15} color="#94a3b8" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px' }}>
                  CHANNEL CHAT
                </span>
              </div>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {roomChat.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', marginTop: '20px' }}>
                  No messages yet. Say hi! 👋
                </div>
              )}
              {roomChat.map((msg, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: '10px',
                  background: msg.user === username ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: msg.user === username ? '#a5b4fc' : '#94a3b8' }}>
                      {msg.user}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#475569' }}>{msg.time}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#e2e8f0', margin: 0 }}>{msg.text}</p>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendRoomChat()}
                placeholder="Type a message..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '8px 12px', color: '#e2e8f0',
                  fontSize: '0.82rem', outline: 'none', fontFamily: 'var(--font-sans)',
                }}
              />
              <button
                onClick={sendRoomChat}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none',
                  borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: 'white',
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: '12px',
          background: 'rgba(239,68,68,0.9)', color: 'white',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.82rem', fontWeight: 600, boxShadow: '0 8px 30px rgba(239,68,68,0.4)',
          animation: 'slideUpFade 0.2s ease',
          zIndex: 100,
        }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

