import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, MessageSquare, Compass, Bell, LogOut } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  readBy: string[];
  isSystem?: boolean;
  reactions?: { [emoji: string]: string[] };
}

interface ChatRoomProps {
  username: string;
  socket: Socket | null;
  onSignOut: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ username, socket, onSignOut }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typers, setTypers] = useState<string[]>([]);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Request browser push permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    // Join room
    socket.emit('chat:join', { username });

    // Sync online users list
    socket.on('chat:online_users', (users: string[]) => {
      setOnlineUsers(users);
    });

    // Load message history on entry
    socket.on('chat:history', (history: Message[]) => {
      setMessages(history);
      // Trigger read sync
      socket.emit('chat:read', { username });
    });

    // Receive message
    socket.on('chat:message', (message: Message) => {
      setMessages((prev) => [...prev, message].slice(-50));
      
      // Auto-send read acknowledgement if visible
      if (!document.hidden) {
        socket.emit('chat:read', { username });
      }

      // HTML5 Desktop Notification (only if message is not ours and window is hidden)
      if (
        message.username !== username && 
        message.username !== 'System' && 
        document.hidden && 
        'Notification' in window && 
        Notification.permission === 'granted'
      ) {
        new Notification(`RideConnect Dev Chat: ${message.username}`, {
          body: message.text,
          icon: '/favicon.ico' // fallback
        });
      }
    });

    // Sync typing indicators
    socket.on('chat:typing', (data: { username: string; isTyping: boolean }) => {
      setTypers((prev) => {
        if (data.isTyping) {
          if (!prev.includes(data.username)) return [...prev, data.username];
        } else {
          return prev.filter((name) => name !== data.username);
        }
        return prev;
      });
    });

    // Synchronize read receipts and reactions
    socket.on('chat:read_receipts', (receipts: Message[]) => {
      setMessages(receipts);
    });

    // Clean up listeners on unmount
    return () => {
      socket.off('chat:online_users');
      socket.off('chat:history');
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('chat:read_receipts');
    };
  }, [socket, username]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typers]);

  // Mark all read on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (socket) {
        socket.emit('chat:read', { username });
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [socket, username]);

  // Manage Typing Indicators on key strokes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('chat:typing', { username, isTyping: true });
    }

    // Debounce stops typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('chat:typing', { username, isTyping: false });
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;

    // Send payload
    socket.emit('chat:message', { text, username });
    
    // Stop typing state
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('chat:typing', { username, isTyping: false });
    
    setText('');
    inputRef.current?.focus();
  };

  const handleReactToMessage = (messageId: string, emoji: string) => {
    if (socket) {
      socket.emit('chat:react', { messageId, username, emoji });
    }
    setHoveredMessageId(null); // Close on click
  };

  return (
    <div 
      className="glass-panel main-app-container" 
      style={{ 
        display: 'grid',
        gridTemplateColumns: '260px 1fr', 
        height: 'calc(100vh - 100px)', 
        margin: '20px', 
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
        border: '1px solid var(--border-light)'
      }}
    >
      
      {/* 1. Left Sidebar: Active online members (Slack/Steel Light style) */}
      <aside 
        style={{ 
          background: 'var(--bg-secondary)', 
          borderRight: '1px solid var(--border-light)', 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* User Card Session info */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifySelf: 'start', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700 }}>LOGGED IN AS</span>
            <button 
              onClick={onSignOut}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 600 }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <LogOut size={10} /> CHANGE
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-purple-glow)', border: '1px solid var(--accent-purple)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
              {username.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{username}</span>
          </div>
        </div>

        {/* Members Header */}
        <div style={{ padding: '15px 20px 5px 20px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700 }}>
          <Users size={14} /> ACTIVE MEMBERS ({onlineUsers.length})
        </div>

        {/* Live member list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {onlineUsers.map((user) => (
            <div 
              key={user}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '8px',
                background: user === username ? 'rgba(99, 102, 241, 0.06)' : 'rgba(0, 0, 0, 0.01)',
                border: `1px solid ${user === username ? 'rgba(99, 102, 241, 0.15)' : 'transparent'}`
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: user === username ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                {user} {user === username && '(You)'}
              </span>
              <span 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: 'var(--accent-emerald)', 
                  boxShadow: '0 0 6px var(--accent-emerald)'
                }} 
              />
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Center Panel: Chat viewport */}
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', background: 'var(--bg-glass)' }}>
        
        {/* Workspace Title */}
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border-light)', background: '#ffffff', display: 'flex', justifySelf: 'start', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <MessageSquare size={16} style={{ color: 'var(--accent-purple)' }} />
            PLATFORM LIVE WORKSPACE
          </h3>
          <Bell size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* Message Bubble List */}
        <div 
          ref={scrollRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '25px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            background: '#f8fafc'
          }}
        >
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '10px', height: '100%' }}>
              <Compass size={32} style={{ color: 'var(--text-muted)', animation: 'spin 20s linear infinite' }} />
              <span style={{ fontSize: '0.8rem' }}>Workspace established. Start typing to begin...</span>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.isSystem) {
                // System notification bubble
                return (
                  <div 
                    key={msg.id}
                    style={{
                      alignSelf: 'center',
                      background: 'var(--border-light)',
                      borderRadius: '8px',
                      padding: '4px 12px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      margin: '5px 0',
                      letterSpacing: '0.3px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                    }}
                  >
                    {msg.text}
                  </div>
                );
              }

              const isMe = msg.username === username;
              
              // Calculate seen list (excluding author)
              const seenBy = msg.readBy.filter(name => name !== msg.username);
              const readString = seenBy.length > 0 ? `Seen by ${seenBy.join(', ')}` : 'Delivered';

              return (
                <div 
                  key={msg.id}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '65%',
                    position: 'relative',
                    animation: 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                  }}
                >
                  {/* Emoji Floating Reaction Bar on Bubble Hover */}
                  {hoveredMessageId === msg.id && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '-28px',
                        right: isMe ? '10px' : 'auto',
                        left: isMe ? 'auto' : '10px',
                        background: '#ffffff',
                        border: '1px solid var(--border-light)',
                        borderRadius: '20px',
                        padding: '2px 8px',
                        display: 'flex',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        zIndex: 50,
                        animation: 'fadeIn 0.15s ease'
                      }}
                    >
                      {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReactToMessage(msg.id, emoji)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '2px',
                            transition: 'transform 0.1s',
                            outline: 'none'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bubble Sender Label */}
                  {!isMe && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: '6px', fontWeight: 600 }}>
                      {msg.username}
                    </span>
                  )}
                  
                  {/* Bubble text card */}
                  <div 
                    style={{
                      background: isMe 
                        ? 'linear-gradient(135deg, var(--accent-purple) 0%, #4f46e5 100%)' 
                        : '#ffffff',
                      color: isMe ? '#ffffff' : 'var(--text-primary)',
                      padding: '12px 16px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      border: isMe ? 'none' : '1px solid var(--border-light)',
                      fontSize: '0.85rem',
                      boxShadow: isMe ? '0 4px 12px var(--accent-purple-glow)' : '0 2px 4px rgba(15,23,42,0.015)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word'
                    }}
                  >
                    {msg.text}
                  </div>

                  {/* Reaction Chips counter */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div 
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '6px',
                        alignSelf: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {Object.entries(msg.reactions).map(([emoji, reactors]) => {
                        const hasReacted = reactors.includes(username);
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReactToMessage(msg.id, emoji)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: hasReacted ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
                              border: `1px solid ${hasReacted ? 'var(--accent-purple)' : 'var(--border-light)'}`,
                              borderRadius: '12px',
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: hasReacted ? 'var(--accent-purple)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              transition: 'var(--transition-smooth)',
                              outline: 'none'
                            }}
                          >
                            <span>{emoji}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{reactors.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Read Receipts & Timestamp */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      gap: '15px', 
                      fontSize: '0.62rem', 
                      color: 'var(--text-muted)', 
                      marginTop: '4px',
                      paddingLeft: '4px',
                      paddingRight: '4px'
                    }}
                  >
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <span style={{ color: seenBy.length > 0 ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: 500 }}>{seenBy.length > 0 ? `✓ ${readString}` : '✓ Delivered'}</span>}
                  </div>
                </div>
              );
            })
          )}

          {/* Real-time active typers list */}
          {typers.length > 0 && (
            <div 
              style={{ 
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ffffff',
                padding: '8px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                animation: 'fadeIn 0.2s ease'
              }}
            >
              {/* Dynamic typing dots */}
              <div style={{ display: 'flex', gap: '3px' }}>
                <span className="dot-blink" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
                <span className="dot-blink" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)', animationDelay: '0.2s' }}></span>
                <span className="dot-blink" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-muted)', animationDelay: '0.4s' }}></span>
              </div>
              <span>
                <strong>{typers.join(', ')}</strong> {typers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}
        </div>

        {/* Input Footer Form */}
        <form 
          onSubmit={handleSendMessage}
          style={{ 
            padding: '15px 20px', 
            borderTop: '1px solid var(--border-light)', 
            background: '#ffffff', 
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center' 
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Type your message here..."
            value={text}
            onChange={handleInputChange}
            className="glass-input"
            style={{ flex: 1, padding: '12px 16px' }}
          />
          <button 
            type="submit" 
            className="glass-button"
            disabled={!text.trim() || !socket}
            style={{ 
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: text.trim() && socket ? 'pointer' : 'not-allowed',
              opacity: text.trim() && socket ? 1 : 0.6
            }}
          >
            <Send size={16} />
          </button>
        </form>

      </section>

    </div>
  );
};
export default ChatRoom;
