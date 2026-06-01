import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { LiveMap } from './components/LiveMap';
import { PassengerPanel } from './components/PassengerPanel';
import { DriverPanel } from './components/DriverPanel';
import { AdminPanel } from './components/AdminPanel';
import { EventStream } from './components/EventStream';
import { UsernameModal } from './components/UsernameModal';
import { ChatRoom } from './components/ChatRoom';
import { WalkieTalkie } from './components/WalkieTalkie';
import type { User, Driver, Ride, Location, AnalyticsSummary } from 'shared';
import { UserSquare2, Car, ShieldAlert, MessageSquare, Compass, Radio, Globe } from 'lucide-react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 
  (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);
const API_URL = `${GATEWAY_URL}/api`;

export default function App() {
  // Master View Toggle: 'RIDE' | 'CHAT'
  const [viewMode, setViewMode] = useState<'RIDE' | 'CHAT' | 'WALKIE'>('RIDE');
  const [chatUsername, setChatUsername] = useState<string | null>(localStorage.getItem('chat_username'));

  // Navigation Role Tabs: 'PASSENGER' | 'DRIVER' | 'ADMIN'
  const [activeTab, setActiveTab] = useState<'PASSENGER' | 'DRIVER' | 'ADMIN'>('PASSENGER');

  // Master Registries
  const [users, setUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Map Coordinates & States
  const [pickup, setPickup] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [locationSelectMode, setLocationSelectMode] = useState<'pickup' | 'destination' | null>(null);

  // Active Ride lifecycle
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  // System metrics & logs
  const [metrics, setMetrics] = useState<AnalyticsSummary | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [surgeOverride, setSurgeOverride] = useState<number>(1.0);

  // Establish Master System Socket connection to listen for all Kafka/Redis events
  const { emit, on, socket } = useSocket('SYSTEM');

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    if (user) {
      localStorage.setItem('rideconnect_user_id', user.id);
    }
  };

  const handleSelectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    if (driver) {
      localStorage.setItem('rideconnect_driver_id', driver.id);
    }
  };

  // Fetch initial registry states with state persistence & ride recovery
  const fetchData = async () => {
    try {
      const usersRes = await fetch(`${API_URL}/users`);
      const usersData = await usersRes.json();
      setUsers(usersData);
      
      // Persist: restore selected passenger
      const savedUserId = localStorage.getItem('rideconnect_user_id');
      const matchedUser = usersData.find((u: User) => u.id === savedUserId);
      const activeUser = matchedUser || usersData[0] || null;
      setSelectedUser(activeUser);

      const driversRes = await fetch(`${API_URL}/drivers`);
      const driversData = await driversRes.json();
      setDrivers(driversData);
      
      // Persist: restore selected driver
      const savedDriverId = localStorage.getItem('rideconnect_driver_id');
      const matchedDriver = driversData.find((d: Driver) => d.id === savedDriverId);
      const activeDriver = matchedDriver || driversData[0] || null;
      setSelectedDriver(activeDriver);

      refreshMetrics();

      // Persist: Fetch active rides to check if our passenger or driver has a running ride!
      const ridesRes = await fetch(`${API_URL}/rides/active`);
      const activeRides = await ridesRes.json();
      
      // Find if there is an active ride matching the current selected passenger or driver
      if (activeUser || activeDriver) {
        const matchedRide = activeRides.find((r: Ride) => 
          (activeUser && r.passengerId === activeUser.id) || 
          (activeDriver && r.driverId === activeDriver.id)
        );
        if (matchedRide) {
          console.log('[App:Restore] Active ride restored from backend:', matchedRide.id);
          setActiveRide(matchedRide);
          setPickup(matchedRide.pickup);
          setDestination(matchedRide.destination);
        }
      }
    } catch (err) {
      console.error('Error fetching backend registries:', err);
    }
  };

  const refreshMetrics = async () => {
    try {
      const metricsRes = await fetch(`${API_URL}/analytics/metrics`);
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      const fraudRes = await fetch(`${API_URL}/analytics/fraud`);
      const fraudData = await fraudRes.json();
      setFraudAlerts(fraudData);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  // Synchronize URL Hash with Tab selections
  useEffect(() => {
    const hash = window.location.hash;
    const modeFromHash = hash === '#/chat' ? 'CHAT' : hash === '#/voice' ? 'WALKIE' : 'RIDE';
    
    // Only update if mismatch (prevents loops)
    if (viewMode !== modeFromHash) {
      window.location.hash = viewMode === 'CHAT' ? '/chat' : viewMode === 'WALKIE' ? '/voice' : '/ride';
    }
  }, [viewMode]);

  // Listen to browser Back/Forward/deep-link hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/chat') {
        setViewMode('CHAT');
      } else if (hash === '#/voice') {
        setViewMode('WALKIE');
      } else {
        setViewMode('RIDE');
      }
    };
    
    // Set initial mode from URL hash on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Set up WebSocket Listeners
  useEffect(() => {
    // 1. Listen for all Kafka events published to feed the live event logger
    const offKafka = on('system:kafka_event', (envelope) => {
      setLogs((prev) => [...prev, {
        id: envelope.id,
        category: 'KAFKA',
        target: envelope.topic,
        detail: envelope.type,
        payload: envelope.payload,
        timestamp: envelope.timestamp
      }].slice(-100)); // trim limit 100

      // Proactively refresh telemetry metrics on key complete signals
      if (
        envelope.type === 'RIDE_COMPLETED' || 
        envelope.type === 'PAYMENT_SUCCESS' || 
        envelope.type === 'RIDE_CANCELLED' ||
        envelope.type === 'DRIVER_ONLINE' ||
        envelope.type === 'DRIVER_OFFLINE'
      ) {
        refreshMetrics();
        fetchData();
      }
    });

    // 2. Listen for Redis Cache Activity
    const offLog = on('system:log', (logItem) => {
      if (logItem.category === 'REDIS') {
        setLogs((prev) => [...prev, logItem].slice(-100));
      }
    });

    // 3. Listen for Driver location updates
    const offLocation = on('driver:location_changed', (payload) => {
      setDrivers((prevDrivers) =>
        prevDrivers.map((d) =>
          d.id === payload.driverId
            ? { ...d, location: payload.location, status: payload.status }
            : d
        )
      );

      // If active ride matches this driver, sync driver location
      if (activeRide && activeRide.driverId === payload.driverId) {
        setActiveRide((prev) => prev ? { ...prev, driverLocation: payload.location } : null);
      }
    });

    // 4. Listen for Ride status machine updates
    const offRideStatus = on('ride:status_updated', (payload) => {
      // Check if it belongs to selected user or selected driver
      if (
        selectedUser?.id === payload.passengerId ||
        selectedDriver?.id === payload.driverId
      ) {
        setActiveRide(payload);
        
        // Clear active location lines if complete
        if (payload.status === 'PAID' || payload.status === 'CANCELLED') {
          setTimeout(() => {
            setActiveRide(null);
            setPickup(null);
            setDestination(null);
            fetchData();
          }, 4000);
        }
      }
    });

    return () => {
      offKafka();
      offLog();
      offLocation();
      offRideStatus();
    };
  }, [selectedUser, selectedDriver, activeRide]);

  // Passenger actions
  const handleRequestRide = async () => {
    if (!selectedUser || !pickup || !destination) return;

    try {
      const res = await fetch(`${API_URL}/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passengerId: selectedUser.id,
          pickup,
          destination,
        }),
      });
      const data = await res.json();
      setActiveRide(data);
      setLocationSelectMode(null);
    } catch (err) {
      console.error('Request ride transaction error:', err);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      // Direct call on backend service to transition state
      // Simply trigger cancel through mock socket or direct REST if built
      // For simplicity, we can let our simulated matching cancel it
      setLogs((prev) => [...prev, {
        id: Math.random().toString(),
        category: 'KAFKA',
        target: 'ride-events',
        detail: 'RIDE_CANCELLED',
        payload: { rideId: activeRide.id, cancelledBy: 'PASSENGER' },
        timestamp: new Date().toISOString()
      }]);
      setActiveRide(null);
      setPickup(null);
      setDestination(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateDriver = (rating: number) => {
    console.log(`Passenger rated driver: ${rating} stars`);
    // Rate callback completed
  };

  // Driver actions
  const handleToggleStatus = async (driverId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'OFFLINE' ? 'ONLINE' : 'OFFLINE';
    try {
      const res = await fetch(`${API_URL}/drivers/${driverId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? data : d)));
      if (selectedDriver?.id === driverId) {
        setSelectedDriver(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptRide = (rideId: string, driverId: string) => {
    emit('ride:accept', { rideId, driverId });
  };

  const handleSelectLocation = (type: 'pickup' | 'destination', loc: Location) => {
    if (type === 'pickup') {
      setPickup(loc);
    } else {
      setDestination(loc);
    }
    setLocationSelectMode(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* Dynamic Navigation Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Compass className="pulse-glow" style={{ color: 'var(--accent-purple)' }} size={22} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            RIDECONNECT HUB
          </span>
        </div>

        {/* Global Navigation View switchers */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setViewMode('RIDE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'RIDE' ? '#ffffff' : 'transparent',
              color: viewMode === 'RIDE' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: viewMode === 'RIDE' ? '0 2px 6px rgba(15, 23, 42, 0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Car size={16} style={{ color: viewMode === 'RIDE' ? 'var(--accent-purple)' : 'var(--text-muted)' }} />
            <span className="nav-text">RIDE OPERATIONS</span>
          </button>
          
          <button
            onClick={() => setViewMode('CHAT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'CHAT' ? '#ffffff' : 'transparent',
              color: viewMode === 'CHAT' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: viewMode === 'CHAT' ? '0 2px 6px rgba(15, 23, 42, 0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <MessageSquare size={16} style={{ color: viewMode === 'CHAT' ? 'var(--accent-purple)' : 'var(--text-muted)' }} />
            <span className="nav-text">LIVE CHATROOM</span>
          </button>

          <button
            onClick={() => setViewMode('WALKIE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'WALKIE' ? '#ffffff' : 'transparent',
              color: viewMode === 'WALKIE' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: viewMode === 'WALKIE' ? '0 2px 6px rgba(15, 23, 42, 0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Radio size={16} style={{ color: viewMode === 'WALKIE' ? '#06b6d4' : 'var(--text-muted)' }} />
            <span className="nav-text">VOICE HUB</span>
          </button>
        </div>

        {/* Profile & Connection Info Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Geolocation/Connection Domain */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}>
            <Globe size={12} style={{ color: 'var(--accent-purple)' }} />
            <span className="nav-text" style={{ fontFamily: 'var(--font-mono)' }}>
              {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                ? `local:${window.location.port || '3000'}` 
                : window.location.hostname}
            </span>
          </div>

          {/* Logged in profile status */}
          {selectedUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.72rem',
              color: 'var(--accent-gold)',
              fontWeight: 700,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-gold)', boxShadow: '0 0 6px var(--accent-gold)' }}></span>
              <span>PASSENGER: {selectedUser.name}</span>
            </div>
          ) : selectedDriver ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              fontSize: '0.72rem',
              color: 'var(--accent-emerald)',
              fontWeight: 700,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 6px var(--accent-emerald)' }}></span>
              <span>DRIVER: {selectedDriver.name}</span>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-light)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
              <span>NO ACTIVE PROFILE</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 6px var(--accent-emerald)' }}></span>
            <span className="nav-text">GATEWAY ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ flex: 1, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
        {viewMode === 'RIDE' ? (
          <main className="main-app-container" style={{ height: '100%' }}>
            
            {/* Left Pane: Interactive Controllers */}
            <aside 
              style={{ 
                background: 'var(--bg-glass)', 
                borderRight: '1px solid var(--border-light)', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', 
                overflow: 'hidden'
              }}
            >
              {/* Banner Title */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                  OPERATIONS CONSOLE
                </h2>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-purple)', fontWeight: 700, letterSpacing: '2px' }}>
                  ROLE PORTALS
                </span>
              </div>

              {/* Tab Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 15px', gap: '4px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}>
                <button
                  onClick={() => { setActiveTab('PASSENGER'); setLocationSelectMode(null); }}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: activeTab === 'PASSENGER' ? '1px solid var(--border-light)' : '1px solid transparent',
                    background: activeTab === 'PASSENGER' ? '#ffffff' : 'transparent',
                    color: activeTab === 'PASSENGER' ? 'var(--accent-gold)' : 'var(--text-muted)',
                    boxShadow: activeTab === 'PASSENGER' ? '0 2px 6px rgba(15, 23, 42, 0.04)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <UserSquare2 size={16} /> PASSENGER
                </button>
                <button
                  onClick={() => { setActiveTab('DRIVER'); setLocationSelectMode(null); }}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: activeTab === 'DRIVER' ? '1px solid var(--border-light)' : '1px solid transparent',
                    background: activeTab === 'DRIVER' ? '#ffffff' : 'transparent',
                    color: activeTab === 'DRIVER' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                    boxShadow: activeTab === 'DRIVER' ? '0 2px 6px rgba(15, 23, 42, 0.04)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <Car size={16} /> DRIVER
                </button>
                <button
                  onClick={() => { setActiveTab('ADMIN'); setLocationSelectMode(null); }}
                  style={{
                    padding: '10px 0',
                    borderRadius: '8px',
                    border: activeTab === 'ADMIN' ? '1px solid var(--border-light)' : '1px solid transparent',
                    background: activeTab === 'ADMIN' ? '#ffffff' : 'transparent',
                    color: activeTab === 'ADMIN' ? 'var(--accent-red)' : 'var(--text-muted)',
                    boxShadow: activeTab === 'ADMIN' ? '0 2px 6px rgba(15, 23, 42, 0.04)' : 'none',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <ShieldAlert size={16} /> ADMIN
                </button>
              </div>

              {/* Panel Render Box */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {activeTab === 'PASSENGER' && (
                  <PassengerPanel
                    users={users}
                    selectedUser={selectedUser}
                    onSelectUser={handleSelectUser}
                    pickup={pickup}
                    destination={destination}
                    onSetSelectMode={setLocationSelectMode}
                    locationSelectMode={locationSelectMode}
                    activeRide={activeRide}
                    onRequestRide={handleRequestRide}
                    onCancelRide={handleCancelRide}
                    onRateDriver={handleRateDriver}
                  />
                )}

                {activeTab === 'DRIVER' && (
                  <DriverPanel
                    drivers={drivers}
                    selectedDriver={selectedDriver}
                    onSelectDriver={handleSelectDriver}
                    onToggleStatus={handleToggleStatus}
                    activeRide={activeRide}
                    onAcceptRide={handleAcceptRide}
                  />
                )}

                {activeTab === 'ADMIN' && (
                  <AdminPanel
                    metrics={metrics}
                    fraudAlerts={fraudAlerts}
                    onRefreshMetrics={refreshMetrics}
                    surgeOverride={surgeOverride}
                    onSetSurgeOverride={setSurgeOverride}
                  />
                )}
              </div>
            </aside>

            {/* Center Pane: Dynamic map */}
            <section style={{ height: '100%', position: 'relative' }}>
              <LiveMap
                drivers={drivers}
                activeRide={activeRide}
                pickup={pickup}
                destination={destination}
                onSelectLocation={handleSelectLocation}
                locationSelectMode={locationSelectMode}
              />
            </section>

            {/* Right Pane: Live event monitor */}
            <aside className="event-stream-aside" style={{ height: '100%' }}>
              <EventStream logs={logs} onClear={() => setLogs([])} />
            </aside>

          </main>
        ) : viewMode === 'CHAT' ? (
          <div style={{ height: '100%', background: 'var(--bg-secondary)' }}>
            {chatUsername === null ? (
              <UsernameModal onEnterChat={(name) => {
                localStorage.setItem('chat_username', name);
                setChatUsername(name);
              }} />
            ) : (
              <ChatRoom
                username={chatUsername}
                socket={socket}
                onSignOut={() => {
                  localStorage.removeItem('chat_username');
                  setChatUsername(null);
                }}
              />
            )}
          </div>
        ) : (
          <WalkieTalkie
            socket={socket}
            defaultUsername={chatUsername || 'Operator'}
          />
        )}
      </div>
    </div>
  );
}
