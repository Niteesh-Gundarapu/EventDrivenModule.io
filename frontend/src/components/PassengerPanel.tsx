import React, { useState } from 'react';
import type { User, Ride, Location } from 'shared';
import { MapPin, Navigation, Wallet, Star, Car, ArrowRight, XCircle } from 'lucide-react';

interface PassengerPanelProps {
  users: User[];
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  pickup: Location | null;
  destination: Location | null;
  onSetSelectMode: (mode: 'pickup' | 'destination' | null) => void;
  locationSelectMode: 'pickup' | 'destination' | null;
  activeRide: Ride | null;
  onRequestRide: () => void;
  onCancelRide: () => void;
  onRateDriver: (rating: number) => void;
}

export const PassengerPanel: React.FC<PassengerPanelProps> = ({
  users,
  selectedUser,
  onSelectUser,
  pickup,
  destination,
  onSetSelectMode,
  locationSelectMode,
  activeRide,
  onRequestRide,
  onCancelRide,
  onRateDriver
}) => {
  const [hasRated, setHasRated] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  // Estimates if locations are selected but ride not booked yet
  const canRequest = selectedUser && pickup && destination && !activeRide;

  // Simple mock distance math for preview
  const getPreviewDistance = () => {
    if (!pickup || !destination) return 0;
    const dy = destination.lat - pickup.lat;
    const dx = destination.lng - pickup.lng;
    return Math.round(Math.sqrt(dx * dx + dy * dy) * 111 * 10) / 10; // degrees to km approx
  };

  const dist = getPreviewDistance();
  const estMinutes = Math.max(Math.round(dist * 2), 2);
  const estBase = 2.50 + dist * 1.50 + estMinutes * 0.40;
  const surge = 1.0;
  const estTotal = Math.round((estBase * surge + estBase * surge * 0.1) * 100) / 100;

  const handleRatingSubmit = (stars: number) => {
    onRateDriver(stars);
    setHasRated(true);
    setTimeout(() => setHasRated(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      {/* User Session Selector */}
      <div className="glass-panel" style={{ padding: '18px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wallet size={16} /> PASSENGER SESSION
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelectUser(u)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                background: selectedUser?.id === u.id ? 'rgba(217, 119, 6, 0.08)' : '#ffffff',
                border: `1px solid ${selectedUser?.id === u.id ? 'var(--accent-gold)' : 'var(--border-light)'}`,
                color: selectedUser?.id === u.id ? 'var(--accent-gold)' : 'var(--text-primary)',
                cursor: activeRide ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'var(--transition-smooth)'
              }}
              disabled={!!activeRide}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={10} fill="var(--accent-gold)" style={{ color: 'var(--accent-gold)' }} /> {u.rating} Rating
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-gold)' }}>
                ${u.walletBalance.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ride Booker Panel */}
      {!activeRide && selectedUser && (
        <div className="glass-panel" style={{ padding: '18px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, marginBottom: '15px', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation size={16} fill="none" /> BOOK A TRIP
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Set Pickup */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '5px' }}>PICKUP LOCATION</label>
              <button
                onClick={() => onSetSelectMode(locationSelectMode === 'pickup' ? null : 'pickup')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: locationSelectMode === 'pickup' ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
                  border: `1px solid ${locationSelectMode === 'pickup' ? 'var(--accent-purple)' : 'var(--border-light)'}`,
                  color: pickup ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <MapPin size={14} style={{ color: pickup ? 'var(--accent-gold)' : 'var(--text-muted)' }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  {pickup ? pickup.address : 'Click to select pickup...'}
                </span>
              </button>
            </div>

            {/* Set Destination */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '5px' }}>DESTINATION LOCATION</label>
              <button
                onClick={() => onSetSelectMode(locationSelectMode === 'destination' ? null : 'destination')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: locationSelectMode === 'destination' ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
                  border: `1px solid ${locationSelectMode === 'destination' ? 'var(--accent-purple)' : 'var(--border-light)'}`,
                  color: destination ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <MapPin size={14} style={{ color: destination ? 'var(--accent-purple)' : 'var(--text-muted)' }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  {destination ? destination.address : 'Click to select destination...'}
                </span>
              </button>
            </div>

            {/* Fare Summary Quote */}
            {pickup && destination && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border-light)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Distance:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dist} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Duration:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>~{estMinutes} mins</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--accent-gold)' }}>ESTIMATED FARE:</span>
                  <span style={{ color: 'var(--accent-gold)' }}>${estTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Request Button */}
            <button
              onClick={onRequestRide}
              disabled={!canRequest}
              className={`glass-button ${canRequest ? '' : 'glass-button-secondary'}`}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.85rem',
                cursor: canRequest ? 'pointer' : 'not-allowed',
                marginTop: '10px'
              }}
            >
              BOOK RIDECONNECT
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Tracking Panel */}
      {activeRide && (
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifySelf: 'start', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Car size={16} /> LIVE TRACKING
            </h3>
            <span className={`badge ${
              activeRide.status === 'REQUESTED' || activeRide.status === 'SEARCHING_DRIVER' ? 'badge-gold' : 
              activeRide.status === 'COMPLETED' || activeRide.status === 'PAID' ? 'badge-emerald' : 'badge-blue'
            }`}>
              {activeRide.status}
            </span>
          </div>

          {/* Steps Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeRide.status === 'REQUESTED' || activeRide.status === 'SEARCHING_DRIVER' ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeRide.status === 'REQUESTED' || activeRide.status === 'SEARCHING_DRIVER' ? 'var(--accent-gold)' : 'var(--accent-emerald)' }} />
              Searching for nearest driver...
            </div>
            
            {(activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVING' || activeRide.status === 'STARTED' || activeRide.status === 'COMPLETED' || activeRide.status === 'PAID') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVING' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeRide.status === 'DRIVER_ASSIGNED' || activeRide.status === 'DRIVER_ARRIVING' ? 'var(--accent-blue)' : 'var(--accent-emerald)' }} />
                Driver {activeRide.driverName} is arriving ({activeRide.vehicle?.color} {activeRide.vehicle?.model})
              </div>
            )}

            {(activeRide.status === 'STARTED' || activeRide.status === 'COMPLETED' || activeRide.status === 'PAID') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeRide.status === 'STARTED' ? 'var(--accent-purple)' : 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeRide.status === 'STARTED' ? 'var(--accent-purple)' : 'var(--accent-emerald)' }} />
                Trip in progress. Driving to dropoff...
              </div>
            )}

            {(activeRide.status === 'COMPLETED' || activeRide.status === 'PAID') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activeRide.status === 'COMPLETED' ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                Arrived! Processing transaction details...
              </div>
            )}
          </div>

          {/* Complete Booking Details */}
          {activeRide.driverName && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(168,85,247,0.1)', border: '1px solid var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                {activeRide.driverName.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{activeRide.driverName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{activeRide.vehicle?.color} {activeRide.vehicle?.make} • {activeRide.vehicle?.plateNumber}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                ${activeRide.fare}
              </div>
            </div>
          )}

          {/* Rating System & Cancel Buttons */}
          {activeRide.status === 'PAID' ? (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px', textAlign: 'center' }}>
              {hasRated ? (
                <div style={{ color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 600 }}>Thank you for your feedback!</div>
              ) : (
                <>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>HOW WAS YOUR TRIP?</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((stars) => (
                      <button
                        key={stars}
                        onClick={() => handleRatingSubmit(stars)}
                        onMouseEnter={() => setHoverRating(stars)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
                      >
                        <Star 
                          size={18} 
                          fill={stars <= (hoverRating || 5) ? 'var(--accent-gold)' : 'none'} 
                          style={{ color: 'var(--accent-gold)' }} 
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            activeRide.status !== 'COMPLETED' && (
              <button
                onClick={onCancelRide}
                className="glass-button glass-button-red"
                style={{ width: '100%', padding: '10px', fontSize: '0.75rem' }}
              >
                <XCircle size={14} />
                CANCEL BOOKING
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
export default PassengerPanel;
