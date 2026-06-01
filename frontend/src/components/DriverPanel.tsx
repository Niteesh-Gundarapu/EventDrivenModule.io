import React from 'react';
import type { Driver, Ride } from 'shared';
import { ToggleLeft, ToggleRight, Star, Shield, Car, Wallet, AlertOctagon } from 'lucide-react';

interface DriverPanelProps {
  drivers: Driver[];
  selectedDriver: Driver | null;
  onSelectDriver: (driver: Driver) => void;
  onToggleStatus: (driverId: string, currentStatus: string) => void;
  activeRide: Ride | null;
  onAcceptRide: (rideId: string, driverId: string) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  drivers,
  selectedDriver,
  onSelectDriver,
  onToggleStatus,
  activeRide,
  onAcceptRide
}) => {
  
  const isOnline = selectedDriver?.status === 'ONLINE' || selectedDriver?.status === 'BUSY';
  
  // Checks if the driver has an unaccepted offer (assigned on ride, status is requested/searching)
  const incomingOffer = activeRide && 
                        activeRide.driverId === selectedDriver?.id && 
                        (activeRide.status === 'REQUESTED' || activeRide.status === 'SEARCHING_DRIVER');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      {/* Driver Selector */}
      <div className="glass-panel" style={{ padding: '18px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Car size={16} /> DRIVER SESSION
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {drivers.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectDriver(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                background: selectedDriver?.id === d.id ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
                border: `1px solid ${selectedDriver?.id === d.id ? 'var(--accent-emerald)' : 'var(--border-light)'}`,
                color: selectedDriver?.id === d.id ? 'var(--accent-emerald)' : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{d.vehicle.color} {d.vehicle.model}</div>
              </div>
              <span className={`badge ${
                d.status === 'ONLINE' ? 'badge-emerald' : 
                d.status === 'BUSY' ? 'badge-purple' : 'badge-red'
              }`}>
                {d.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Driver Controls */}
      {selectedDriver && (
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* Online/Offline Status Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>DUTY STATUS:</span>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isOnline ? 'RECEIVING TRIP DISPATCH OFFERS' : 'OFFLINE - INACTIVE'}
              </div>
            </div>
            <button
              onClick={() => onToggleStatus(selectedDriver.id, selectedDriver.status)}
              disabled={selectedDriver.status === 'BUSY'}
              style={{ background: 'none', border: 'none', cursor: selectedDriver.status === 'BUSY' ? 'not-allowed' : 'pointer' }}
            >
              {isOnline ? (
                <ToggleRight size={38} style={{ color: 'var(--accent-emerald)' }} />
              ) : (
                <ToggleLeft size={38} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
          </div>

          <div style={{ height: '1px', background: 'var(--border-light)' }} />

          {/* Core Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>RATING</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Star size={14} fill="var(--accent-gold)" style={{ color: 'var(--accent-gold)' }} /> {selectedDriver.rating.toFixed(1)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>ACCEPT RATE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Shield size={14} /> {Math.round(selectedDriver.acceptanceRate * 100)}%
              </div>
            </div>
          </div>

          {/* Earnings Wallet Tracker */}
          <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '15px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px', color: 'var(--accent-emerald)' }}>
              <Wallet size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>DAILY EARNINGS</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                ${selectedDriver.earningsDaily.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Popup offer */}
      {incomingOffer && activeRide && (
        <div className="glass-panel pulse-glow" style={{ padding: '18px', border: '2px solid var(--accent-purple)', background: '#ffffff', boxShadow: '0 12px 40px rgba(99, 102, 241, 0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)' }}>
            <AlertOctagon size={18} className="pulse-glow" />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '1px' }}>
              INCOMING TRIP REQUEST
            </span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            Passenger: <strong style={{ color: 'var(--text-primary)' }}>{activeRide.passengerName}</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <Star size={10} fill="var(--accent-gold)" style={{ color: 'var(--accent-gold)' }} /> {activeRide.passengerRating} Rating
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>📍 Pickup: {activeRide.pickup.address}</div>
            <div>🏁 Dropoff: {activeRide.destination.address}</div>
            <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '5px', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Est. Distance:</span>
              <span>{activeRide.distance} km</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
              ${activeRide.fare}
            </span>
            <button
              onClick={() => selectedDriver && onAcceptRide(activeRide.id, selectedDriver.id)}
              className="glass-button glass-button-emerald"
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              ACCEPT TRIP
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default DriverPanel;
