import React from 'react';
import type { Location, Driver, Ride } from 'shared';
import { MapPin, Compass, Car } from 'lucide-react';

interface LiveMapProps {
  drivers: Driver[];
  activeRide: Ride | null;
  pickup: Location | null;
  destination: Location | null;
  onSelectLocation: (type: 'pickup' | 'destination', location: Location) => void;
  locationSelectMode: 'pickup' | 'destination' | null;
}

// Coordinate bounding box for Manhattan map display
const MAP_BOUNDS = {
  minLat: 40.7500, // Times Square Area
  maxLat: 40.8100, // Columbia Univ Area
  minLng: -73.9950, // Hudson River Side
  maxLng: -73.9450  // East River Side
};

export const LiveMap: React.FC<LiveMapProps> = ({
  drivers,
  activeRide,
  pickup,
  destination,
  onSelectLocation,
  locationSelectMode
}) => {
  
  // Linear interpolation: Lat/Lng -> SVG ViewBox (0 to 600)
  const mapCoords = (lat: number, lng: number) => {
    const width = 600;
    const height = 600;
    
    // X axis: Longitude
    const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * width;
    // Y axis: Latitude (inverted in SVG)
    const y = height - (((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height);
    
    return { x, y };
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!locationSelectMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert SVG X/Y back to Lat/Lng
    const width = rect.width;
    const height = rect.height;

    const lng = MAP_BOUNDS.minLng + (clickX / width) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
    const lat = MAP_BOUNDS.minLat + ((height - clickY) / height) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);

    // Get street address simulation
    const address = `${locationSelectMode === 'pickup' ? 'Pickup' : 'Dropoff'} Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

    onSelectLocation(locationSelectMode, { lat, lng, address });
  };

  // Generate grid street paths for Manhattan simulation
  const streets: { x1: number; y1: number; x2: number; y2: number }[] = [];
  
  // Avenues (Vertical lines, slightly tilted in Manhattan)
  for (let i = 0.1; i <= 0.9; i += 0.08) {
    const xTop = i * 600 - 30;
    const xBottom = i * 600 + 30;
    streets.push({ x1: xTop, y1: 0, x2: xBottom, y2: 600 });
  }
  // Streets (Horizontal lines)
  for (let j = 0.05; j <= 0.95; j += 0.06) {
    streets.push({ x1: 0, y1: j * 600, x2: 600, y2: j * 600 });
  }

  // Central Park boundaries in coordinate space
  const cpTopLeft = mapCoords(40.8068, -73.9730);
  const cpBottomRight = mapCoords(40.7644, -73.9582);

  // Active locations nodes mapping
  const pickupPt = activeRide ? mapCoords(activeRide.pickup.lat, activeRide.pickup.lng) : (pickup ? mapCoords(pickup.lat, pickup.lng) : null);
  const destPt = activeRide ? mapCoords(activeRide.destination.lat, activeRide.destination.lng) : (destination ? mapCoords(destination.lat, destination.lng) : null);
  const driverPt = activeRide?.driverLocation ? mapCoords(activeRide.driverLocation.lat, activeRide.driverLocation.lng) : null;

  return (
    <div className="glass-panel scanline" style={{ height: 'calc(100vh - 40px)', margin: '20px 10px', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Header Info Overlay */}
      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, textShadow: '0 0 10px rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass style={{ color: 'var(--accent-purple)', animation: 'spin 12s linear infinite' }} size={20} />
          METROPOLIS LIVE MAP
        </h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {locationSelectMode 
            ? `CLICK ON STREET TO SET ${locationSelectMode.toUpperCase()} LOCATION` 
            : 'MONITORING REAL-TIME SYSTEM TELEMETRY'}
        </span>
      </div>

      {/* Mode Select Status */}
      {locationSelectMode && (
        <div className="pulse-gold" style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(251,191,36,0.95)', color: '#000', padding: '10px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 25px rgba(251,191,36,0.3)' }}>
          <MapPin size={16} />
          SELECT {locationSelectMode.toUpperCase()} LOCATION ON THE MAP
        </div>
      )}

      {/* SVG Canvas Map */}
      <svg 
        viewBox="0 0 600 600" 
        onClick={handleMapClick}
        style={{ 
          width: '100%', 
          height: '100%', 
          background: '#040307', 
          cursor: locationSelectMode ? 'crosshair' : 'default',
          flex: 1
        }}
      >
        {/* Background Grid Pattern */}
        <defs>
          <pattern id="dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.75" fill="#1f1837" />
          </pattern>
        </defs>
        <rect width="600" height="600" fill="url(#dot-grid)" />

        {/* Central Park */}
        <rect 
          x={Math.min(cpTopLeft.x, cpBottomRight.x)} 
          y={Math.min(cpTopLeft.y, cpBottomRight.y)} 
          width={Math.abs(cpTopLeft.x - cpBottomRight.x)} 
          height={Math.abs(cpTopLeft.y - cpBottomRight.y)} 
          fill="rgba(16, 185, 129, 0.05)" 
          stroke="rgba(16, 185, 129, 0.15)"
          strokeWidth="1.5"
          rx="5"
        />
        <text 
          x={(cpTopLeft.x + cpBottomRight.x) / 2} 
          y={(cpTopLeft.y + cpBottomRight.y) / 2} 
          fill="rgba(16, 185, 129, 0.4)" 
          fontSize="10" 
          fontWeight="bold" 
          letterSpacing="2"
          textAnchor="middle"
        >
          CENTRAL PARK
        </text>

        {/* Street Lines */}
        {streets.map((st, index) => (
          <line
            key={index}
            x1={st.x1}
            y1={st.y1}
            x2={st.x2}
            y2={st.y2}
            stroke="#16122d"
            strokeWidth="2.5"
          />
        ))}

        {/* Active Route Guideline */}
        {pickupPt && destPt && (
          <>
            {/* Pulsing glow background path */}
            <path
              d={`M ${pickupPt.x} ${pickupPt.y} L ${destPt.x} ${destPt.y}`}
              stroke="var(--accent-purple-glow)"
              strokeWidth="4"
              strokeDasharray="6,4"
              fill="none"
              style={{ animation: 'dash 30s linear infinite' }}
            />
            {/* High-contrast core path */}
            <path
              d={`M ${pickupPt.x} ${pickupPt.y} L ${destPt.x} ${destPt.y}`}
              stroke="var(--accent-purple)"
              strokeWidth="1.5"
              fill="none"
            />
          </>
        )}

        {/* Driver path to pickup */}
        {driverPt && pickupPt && (activeRide?.status === 'DRIVER_ASSIGNED' || activeRide?.status === 'DRIVER_ARRIVING') && (
          <path
            d={`M ${driverPt.x} ${driverPt.y} L ${pickupPt.x} ${pickupPt.y}`}
            stroke="var(--accent-blue-glow)"
            strokeWidth="3"
            strokeDasharray="4,4"
            fill="none"
          />
        )}

        {/* Pickup Pin */}
        {pickupPt && (
          <g>
            <circle cx={pickupPt.x} cy={pickupPt.y} r="10" fill="rgba(251,191,36,0.15)" stroke="var(--accent-gold)" strokeWidth="1" className="pulse-gold" />
            <circle cx={pickupPt.x} cy={pickupPt.y} r="4" fill="var(--accent-gold)" />
            <text x={pickupPt.x} y={pickupPt.y - 12} fill="var(--accent-gold)" fontSize="9" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">
              {activeRide ? 'PICKUP' : 'A'}
            </text>
          </g>
        )}

        {/* Destination Pin */}
        {destPt && (
          <g>
            <circle cx={destPt.x} cy={destPt.y} r="10" fill="rgba(168,85,247,0.15)" stroke="var(--accent-purple)" strokeWidth="1" className="pulse-glow" />
            <circle cx={destPt.x} cy={destPt.y} r="4" fill="var(--accent-purple)" />
            <text x={destPt.x} y={destPt.y - 12} fill="var(--accent-purple)" fontSize="9" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">
              {activeRide ? 'DESTINATION' : 'B'}
            </text>
          </g>
        )}

        {/* Active Driver (During Ride) */}
        {activeRide && driverPt && (
          <g transform={`translate(${driverPt.x}, ${driverPt.y})`}>
            <circle r="14" fill="rgba(14,165,233,0.25)" stroke="var(--accent-blue)" strokeWidth="1.5" className="pulse-glow" />
            {/* Simulated Heading direction arrow */}
            <circle r="5" fill="var(--accent-blue)" />
            <Car size={10} style={{ color: 'white', transform: 'translate(-5px, -5px)' }} />
            <text y="22" fill="var(--accent-blue)" fontSize="9" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">
              {activeRide.driverName}
            </text>
          </g>
        )}

        {/* Online Idle Drivers */}
        {!activeRide && drivers.map((driver) => {
          if (driver.status !== 'ONLINE') return null;
          const pt = mapCoords(driver.location.lat, driver.location.lng);
          return (
            <g key={driver.id} transform={`translate(${pt.x}, ${pt.y})`} style={{ transition: 'transform 1s linear' }}>
              <circle r="8" fill="rgba(16,185,129,0.2)" stroke="var(--accent-emerald)" strokeWidth="1" />
              <circle r="3.5" fill="var(--accent-emerald)" />
              <text y="14" fill="var(--text-secondary)" fontSize="8" textAnchor="middle" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.8))">
                {driver.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Map Guidelines Overlay info */}
      <div style={{ position: 'absolute', bottom: '15px', right: '15px', background: 'rgba(10,8,19,0.8)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }}></span> Available Driver
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gold)' }}></span> Pickup
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-purple)' }}></span> Destination
        </div>
      </div>
    </div>
  );
};
