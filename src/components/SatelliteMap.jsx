import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, MapPin, Eraser, PenTool, Navigation, Search, ChevronUp, ChevronDown } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet default marker icons for Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const defaultCoords = [
  [14.6465, 103.4215],
  [14.6515, 103.4215],
  [14.6515, 103.4275],
  [14.6465, 103.4275]
];

// Smart GeoJSON & Array Coordinate Parser
function getValidCoords(plot) {
  if (!plot || !plot.coordinates) return defaultCoords;
  let raw = plot.coordinates;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return defaultCoords;
    }
  }

  // Handle standard GeoJSON Feature or Geometry: {"type": "Polygon", "coordinates": [[[103.4201, 14.6465], ...]]}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.type === 'Feature' && raw.geometry) {
      raw = raw.geometry.coordinates;
    } else if (raw.type === 'Polygon' && raw.coordinates) {
      raw = raw.coordinates;
    }
  }

  // Handle 3D array GeoJSON: [[[lng, lat], [lng, lat], ...]]
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]) && Array.isArray(raw[0][0])) {
    raw = raw[0];
  }

  // Ensure points are array of [lat, lng] for Leaflet
  if (Array.isArray(raw) && raw.length >= 3 && Array.isArray(raw[0])) {
    const formatted = raw.map(pt => {
      if (!Array.isArray(pt) || pt.length < 2) return null;
      let val1 = parseFloat(pt[0]);
      let val2 = parseFloat(pt[1]);
      if (isNaN(val1) || isNaN(val2)) return null;
      // If val1 is Longitude (> 50, e.g. 103.42), swap to [Lat, Lng] -> [val2, val1]
      if (val1 > 50) {
        return [val2, val1];
      }
      return [val1, val2];
    }).filter(pt => pt !== null);

    if (formatted.length >= 3) return formatted;
  }

  return defaultCoords;
}

// 2. Component ตัวดักจับการคลิกแผนที่เพื่อวางหมุดพิกัด
function MapClickHandler({ isDrawMode, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (isDrawMode) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

// Helper component เพื่อ Re-center แผนที่อัตโนมัติเมื่อเลือกแปลงใหม่
function MapRecenter({ centerLat, centerLng }) {
  const map = useMap();
  useEffect(() => {
    if (!isNaN(centerLat) && !isNaN(centerLng)) {
      map.flyTo([centerLat, centerLng], 15, { duration: 1.2 });
    }
  }, [centerLat, centerLng, map]);
  return null;
}

// Helper component สำหรับบินไปยังพิกัดเป้าหมาย (Fly to Location Animation)
function MapFlyController({ flyTarget }) {
  const map = useMap();
  useEffect(() => {
    if (flyTarget && flyTarget.length === 2 && !isNaN(flyTarget[0]) && !isNaN(flyTarget[1])) {
      map.flyTo(flyTarget, 16, { duration: 1.5 });
    }
  }, [flyTarget, map]);
  return null;
}

export default function SatelliteMap({ 
  plot, 
  actualYieldPerRai,
  isDrawMode,
  setIsDrawMode,
  plotPoints,
  handleAddPoint,
  handleClearPoints,
  calculatedRai
}) {
  // คำนวณพิกัดกลางแบบ Smart Center (รองรับ center_lat, center_lng จากฐานข้อมูล)
  const coords = getValidCoords(plot);
  let centerLat = 14.6490;
  let centerLng = 103.4245;

  if (plot && plot.centerLat && plot.centerLng && !isNaN(plot.centerLat) && !isNaN(plot.centerLng)) {
    centerLat = parseFloat(plot.centerLat);
    centerLng = parseFloat(plot.centerLng);
  } else if (coords && coords.length > 0) {
    const lats = coords.map(pt => pt[0]).filter(val => typeof val === 'number' && !isNaN(val));
    const lngs = coords.map(pt => pt[1]).filter(val => typeof val === 'number' && !isNaN(val));
    if (lats.length > 0) centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    if (lngs.length > 0) centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  }

  const center = [centerLat, centerLng];

  // State สำหรับช่องกรอกค้นหาพิกัด Fly to Location (เริ่มต้นเป็นค่าว่างเมื่อรีเฟรชหน้าจอ)
  const [searchLat, setSearchLat] = useState('');
  const [searchLng, setSearchLng] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);
  const [searchMarker, setSearchMarker] = useState(null);

  // เมื่อเลือกเกษตรกรคนใหม่ (plotId เปลี่ยน) ให้แสดงพิกัด Lat, Lng กลางแปลงในช่องค้นหาอัตโนมัติ
  useEffect(() => {
    if (plot && plot.plotId) {
      setFlyTarget(null);
      setSearchMarker(null);
      if (centerLat && centerLng && !isNaN(centerLat) && !isNaN(centerLng)) {
        setSearchLat(centerLat.toFixed(6));
        setSearchLng(centerLng.toFixed(6));
      }
    }
  }, [plot?.plotId, centerLat, centerLng]);

  // State สำหรับการย่อ/ขยายกล่องเครื่องมือวาดแปลง
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  // ฟังก์ชันบินไปยังพิกัดเป้าหมาย
  const handleFlyToSearch = () => {
    if (!searchLat || !searchLng) {
      alert('โปรดระบุพิกัด Latitude และ Longitude ให้ถูกต้อง');
      return;
    }
    const lat = parseFloat(searchLat);
    const lng = parseFloat(searchLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const target = [lat, lng];
      setFlyTarget(target);
      setSearchMarker(target);
      setIsDrawMode(true);
    } else {
      alert('โปรดระบุพิกัด Latitude และ Longitude ให้ถูกต้อง');
    }
  };

  const polygonOptions = {
    color: '#eab308',
    fillColor: '#ca8a04',
    fillOpacity: 0.45,
    weight: 2
  };

  const drawPolygonOptions = {
    color: '#22c55e',
    fillColor: '#16a34a',
    fillOpacity: 0.5,
    weight: 3
  };

  return (
    <div className="w-full lg:w-7/12 xl:w-2/3 h-[450px] sm:h-[550px] lg:h-full relative border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0 select-none">
      
      {/* กล่องเครื่องมือบนแผนที่ (Responsive Controls Widget) */}
      <div className="absolute top-3 left-3 sm:left-14 right-3 sm:right-auto z-[1000] flex flex-col gap-2.5 pointer-events-none max-w-full sm:max-w-md">
        
        {/* 1. แถบควบคุมโหมดแผนที่ */}
        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700/80 shadow-2xl flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-200">ภาพถ่ายดาวเทียม Esri World Imagery</span>
          </div>
          
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setIsDrawMode(!isDrawMode)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                isDrawMode ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400/80' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{isDrawMode ? 'โหมดวาด' : 'เปิดโหมดวาด'}</span>
            </button>
          </div>
        </div>

        {/* 2. กล่องบินไปยังพิกัด (Fly to Location Widget) */}
        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700/80 shadow-2xl flex flex-wrap items-center gap-2 sm:gap-3 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Navigation className="w-4 h-4 shrink-0" />
            <span>ค้นหาพิกัด:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <input
              type="number"
              placeholder="Lat (Y)"
              value={searchLat}
              onChange={(e) => setSearchLat(e.target.value)}
              step="any"
              className="w-full sm:w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500 transition"
            />
            <input
              type="number"
              placeholder="Lng (X)"
              value={searchLng}
              onChange={(e) => setSearchLng(e.target.value)}
              step="any"
              className="w-full sm:w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500 transition"
            />
            <button
              onClick={handleFlyToSearch}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ค้นหา</span>
            </button>
          </div>
        </div>

        {/* 3. กล่องเครื่องมือวาดแปลง */}
        {isDrawMode && (
          <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-emerald-500/50 shadow-2xl max-w-xs sm:w-80 pointer-events-auto transition-all duration-300">
            <div className="px-3.5 py-2 flex justify-between items-center border-b border-slate-800">
              <h3 className="text-emerald-400 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" /> วาดระบุพิกัดแปลงอ้อย
              </h3>
              
              <button
                onClick={() => setIsWidgetMinimized(!isWidgetMinimized)}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                title={isWidgetMinimized ? "ขยายกล่องเครื่องมือ" : "ย่อกล่องเครื่องมือ"}
              >
                {isWidgetMinimized ? (
                  <><span>ขยาย</span><ChevronDown className="w-3.5 h-3.5" /></>
                ) : (
                  <><span>ย่อกล่อง</span><ChevronUp className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>

            {!isWidgetMinimized && (
              <div className="p-3 space-y-2.5">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  คลิกบนแผนที่อย่างน้อย 3 จุดตามมุมแปลงอ้อย เพื่อให้ระบบคำนวณพื้นที่ให้อัตโนมัติด้วย Turf.js
                </p>

                <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400">จำนวนจุดพิกัด:</span>
                  <span className="font-mono text-emerald-300 font-bold text-xs sm:text-sm">{plotPoints.length} หมุด</span>
                </div>

                {calculatedRai > 0 && (
                  <div className="bg-emerald-950/60 p-2 rounded-lg border border-emerald-500/40 text-center">
                    <span className="text-[10px] text-emerald-300 block">พื้นที่คำนวณได้จากพิกัด:</span>
                    <p className="text-lg sm:text-xl font-extrabold text-emerald-400 font-mono">
                      {calculatedRai.toFixed(2)} <span className="text-xs text-slate-300 font-normal">ไร่</span>
                    </p>
                  </div>
                )}

                <button 
                  onClick={handleClearPoints}
                  className="w-full flex justify-center items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" /> ล้างข้อมูลเริ่มวาดใหม่
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* แผนที่ดาวเทียม Leaflet */}
      <MapContainer center={center} zoom={15} className="h-full w-full">
        {!flyTarget && <MapRecenter centerLat={centerLat} centerLng={centerLng} />}
        {flyTarget && <MapFlyController flyTarget={flyTarget} />}

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        
        {/* ตัวดักจับคลิกเมื่ออยู่ในโหมดวาด */}
        <MapClickHandler isDrawMode={isDrawMode} onAddPoint={handleAddPoint} />

        {/* หมุดเป้าหมายการบินจากการค้นหาพิกัด */}
        {searchMarker && (
          <Marker position={searchMarker}>
            <Popup>
              <div className="text-slate-900 text-xs font-bold">
                📍 จุดพิกัดเป้าหมายจากการค้นหา:<br />
                {searchMarker[0]}, {searchMarker[1]}
              </div>
            </Popup>
          </Marker>
        )}

        {/* วาดหมุด (Marker) ตรงจุดที่ผู้ใช้คลิก */}
        {plotPoints.map((pos, idx) => (
          <Marker key={idx} position={pos}>
            <Popup>
              <div className="text-slate-900 text-xs font-mono">
                <strong className="text-emerald-800 font-bold">📍 หมุดที่ {idx + 1}</strong><br />
                Lat: {parseFloat(pos[0]).toFixed(6)}<br />
                Lng: {parseFloat(pos[1]).toFixed(6)}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ถ้าอยู่ในโหมดวาดและมี 3 จุดขึ้นไป ให้ลากเส้น Polygon ที่คำนวณสด */}
        {plotPoints.length >= 3 && (
          <Polygon 
            positions={plotPoints} 
            pathOptions={isDrawMode ? drawPolygonOptions : polygonOptions}
          >
            {!isDrawMode && plot && (
              <Popup>
                <div className="text-slate-900 text-sm space-y-1">
                  <p className="font-bold text-emerald-800">{plot.plotName}</p>
                  <p>เกษตรกร: <strong>{plot.farmerName}</strong> ({plot.plotId})</p>
                  <p>ขนาด: <strong>{plot.totalRai} ไร่</strong></p>
                  <p>ผลผลิตเฉลี่ย: {actualYieldPerRai} ตัน/ไร่</p>
                  <div className="pt-1 text-xs border-t border-slate-300 font-mono text-slate-700">
                    📍 พิกัดกลาง: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            )}
          </Polygon>
        )}

        {/* แสดง Polygon รูปแปลงปกติของเกษตรกร เฉพาะเมื่อไม่ได้อยู่ในโหมดวาด */}
        {!isDrawMode && plotPoints.length < 3 && plot && (
          <Polygon positions={coords} pathOptions={polygonOptions}>
            <Popup>
              <div className="text-slate-900 text-sm space-y-1">
                <p className="font-bold text-emerald-800">{plot.plotName}</p>
                <p>เกษตรกร: <strong>{plot.farmerName}</strong> ({plot.plotId})</p>
                <p>ขนาด: <strong>{plot.totalRai} ไร่</strong></p>
                <p>ผลผลิตเฉลี่ย: {actualYieldPerRai} ตัน/ไร่</p>
                <div className="pt-1 text-xs border-t border-slate-300 font-mono text-slate-700">
                  📍 พิกัดกลาง: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Polygon>
        )}
      </MapContainer>
    </div>
  );
}
