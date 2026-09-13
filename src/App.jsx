import React, { useState, useEffect } from 'react';
import SatelliteMap from './components/SatelliteMap';
import YieldDashboard from './components/YieldDashboard';
import LoginModal from './components/LoginModal';
import { fetchAllPlots, createPlotInDatabase, updatePlotInDatabase } from './services/plotService';
import { RefreshCw, ServerCrash } from 'lucide-react';
import * as turf from '@turf/turf';

export default function App() {
  // Authentication State (ใช้ sessionStorage เพื่อให้ระบบบังคับ Login ใหม่ทุกครั้งที่ปิด Tab/เบราว์เซอร์)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      localStorage.removeItem('currentUser'); // ลบ legacy cache เก่า
      const saved = sessionStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [plotList, setPlotList] = useState([]);
  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [dbStatus, setDbStatus] = useState({ isConnected: false, isSaving: false, message: '' });

  // 1. State สำหรับสลับโหมด (คนเก่า / เพิ่มคนใหม่)
  const [isNewFarmerMode, setIsNewFarmerMode] = useState(false);

  // State สำหรับเก็บข้อมูลเกษตรกรใหม่ที่กำลังพิมพ์
  const [newFarmerData, setNewFarmerData] = useState({
    fullName: '',
    plotName: ''
  });

  // State สำหรับเก็บรูปภาพแปลงที่อัปโหลด
  const [uploadedImage, setUploadedImage] = useState(null);

  // State สำหรับโหมดวาดระบุพิกัดแปลง (GIS Drawing with Turf.js)
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [plotPoints, setPlotPoints] = useState([]);
  const [calculatedRai, setCalculatedRai] = useState(0);

  // ฟังก์ชันสกัดและแปลงพิกัด GeoJSON / [Lng, Lat] เป็น [Lat, Lng] สำหรับ Leaflet & Turf.js
  const parseCoordinatesToPoints = (coords) => {
    if (!coords) return null;
    let raw = coords;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { return null; }
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.type === 'Feature' && raw.geometry) raw = raw.geometry.coordinates;
      else if (raw.type === 'Polygon' && raw.coordinates) raw = raw.coordinates;
    }
    if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]) && Array.isArray(raw[0][0])) {
      raw = raw[0];
    }
    if (Array.isArray(raw) && raw.length >= 3 && Array.isArray(raw[0])) {
      const formatted = raw.map(pt => {
        let val1 = parseFloat(pt[0]);
        let val2 = parseFloat(pt[1]);
        if (isNaN(val1) || isNaN(val2)) return null;
        if (val1 > 50) return [val2, val1]; // สลับ [Lng, Lat] เป็น [Lat, Lng]
        return [val1, val2];
      }).filter(pt => pt !== null);

      if (formatted.length >= 3) return formatted;
    }
    return null;
  };

  // ฟังก์ชันจัดการการอัปโหลดรูป
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
    }
  };

  // ฟังก์ชันคำนวณพื้นที่ด้วย Turf.js (แปลงตารางเมตรเป็นไร่)
  const calculateArea = (points) => {
    if (!points || points.length < 3) {
      setCalculatedRai(0);
      return 0;
    }
    try {
      const turfPoints = points.map(p => [p[1], p[0]]);
      turfPoints.push(turfPoints[0]);

      const polygon = turf.polygon([turfPoints]);
      const areaSqMeters = turf.area(polygon);

      const rai = areaSqMeters / 1600;
      const formattedRai = parseFloat(rai.toFixed(2));
      setCalculatedRai(formattedRai);

      setPlot(prev => prev ? {
        ...prev,
        totalRai: formattedRai,
        coordinates: points
      } : prev);

      return formattedRai;
    } catch (error) {
      console.warn("กำลังคำนวณรูปทรง...", error);
      return 0;
    }
  };

  // 🔄 ดึงข้อมูลจากฐานข้อมูล (cane_ki_database) เมื่อเริ่มแอป (ไม่เลือกแปลงใดๆ อัตโนมัติเมื่อรีเฟรช)
  const loadDatabaseData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const data = await fetchAllPlots();
      if (data && data.length > 0) {
        setPlotList(data);
        setPlot(null); // ไม่เลือกแปลงแรกอัตโนมัติ ให้เป็นค่าว่างก่อนเมื่อรีเฟรช
        setPlotPoints([]);
        setCalculatedRai(0);
        setDbStatus({ isConnected: true, isSaving: false, message: 'ระบบเชื่อมต่อกับฐานข้อมูล' });
      } else {
        setDbError('ไม่พบข้อมูลแปลงอ้อยในตาราง cane_plots บนฐานข้อมูล');
        setDbStatus({ isConnected: false, isSaving: false, message: 'ไม่พบข้อมูลใน Database' });
      }
    } catch (err) {
      console.error('Database Connection Error:', err);
      setDbError(err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ API ฐานข้อมูล (พอร์ต 5000) ได้');
      setDbStatus({ isConnected: false, isSaving: false, message: 'การเชื่อมต่อฐานข้อมูลล้มเหลว' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  const handleAddPoint = (newPoint) => {
    const updatedPoints = [...plotPoints, newPoint];
    setPlotPoints(updatedPoints);
    if (updatedPoints.length >= 3) {
      calculateArea(updatedPoints);
    }
  };

  const handleClearPoints = () => {
    setPlotPoints([]);
    setCalculatedRai(0);
  };

  // 1️⃣ เมื่อกดเลือกเกษตรกรคนใดใน Dropdown: โหลดพิกัดแปลง, บินไปยังไร่, คำนวณไร่ Turf.js อัตโนมัติ
  const handleFarmerSelect = (e) => {
    const selectedPlotId = e.target.value;
    const targetPlot = plotList.find(p => p.plotId === selectedPlotId);
    if (targetPlot) {
      setPlot({ ...targetPlot });

      // ดึงข้อมูลแกน X, Y (boundary_geojson / center_lat / center_lng)
      const points = parseCoordinatesToPoints(targetPlot.coordinates);
      if (points) {
        setPlotPoints(points);
        calculateArea(points);
      } else {
        handleClearPoints();
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPlot(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 💾 ขึ้นทะเบียนเกษตรกรใหม่ลงฐานข้อมูล
  const handleSaveNewFarmer = async () => {
    if (!newFarmerData.fullName.trim()) {
      alert('โปรดกรอกชื่อ-นามสกุล เกษตรกรใหม่');
      return;
    }

    setDbStatus(prev => ({ ...prev, isSaving: true, message: 'กำลังขึ้นทะเบียนเกษตรกรใหม่ลงฐานข้อมูล...' }));
    
    try {
      const payload = {
        fullName: newFarmerData.fullName,
        plotName: newFarmerData.plotName || 'แปลงอ้อยใหม่',
        totalRai: calculatedRai > 0 ? calculatedRai : (plot ? plot.totalRai : 120),
        actualTons: plot ? plot.actualTons : 0,
        targetYieldPerRai: plot ? plot.targetYieldPerRai : 13.00,
        caneVariety: 'ขอนแก่น 3',
        coordinates: plotPoints.length >= 3 ? plotPoints : (plot ? plot.coordinates : null)
      };

      const result = await createPlotInDatabase(payload);
      if (result && result.plot) {
        setPlotList(prev => [result.plot, ...prev]);
        setPlot(result.plot);
        setIsNewFarmerMode(false);
        setNewFarmerData({ fullName: '', plotName: '' });
        setUploadedImage(null);
        
        const points = parseCoordinatesToPoints(result.plot.coordinates);
        if (points) {
          setPlotPoints(points);
          calculateArea(points);
        }

        setDbStatus({ isConnected: true, isSaving: false, message: `ขึ้นทะเบียน ${result.plot.farmerName} ลงฐานข้อมูลสำเร็จ!` });
      }
    } catch (err) {
      setDbStatus(prev => ({ ...prev, isSaving: false, message: 'ขึ้นทะเบียนไม่สำเร็จ (โปรดตรวจสอบการเชื่อมต่อฐานข้อมูล)' }));
    }
  };

  // 💾 บันทึกข้อมูลและพิกัดรูปแปลงวาดใหม่กลับไปยังฐานข้อมูล
  const handleSaveToDatabase = async () => {
    if (!plot) return;
    setDbStatus(prev => ({ ...prev, isSaving: true, message: 'กำลังบันทึกข้อมูลและพิกัดแปลงลงฐานข้อมูล...' }));
    try {
      const updatedPayload = {
        ...plot,
        totalRai: calculatedRai > 0 ? calculatedRai : plot.totalRai,
        coordinates: plotPoints.length >= 3 ? plotPoints : plot.coordinates
      };

      const result = await updatePlotInDatabase(plot.plotId, updatedPayload);
      if (result) {
        setPlot(updatedPayload);
        setPlotList(prev => prev.map(p => p.plotId === plot.plotId ? { ...updatedPayload } : p));
        setDbStatus({ isConnected: true, isSaving: false, message: `บันทึกข้อมูลและพิกัดแปลง ${plot.plotId} ลงฐานข้อมูลสำเร็จ!` });
      }
    } catch (err) {
      setDbStatus(prev => ({ ...prev, isSaving: false, message: 'บันทึกไม่สำเร็จ (โปรดตรวจสอบการเชื่อมต่อฐานข้อมูล)' }));
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {
      console.warn('Could not save user session to sessionStorage');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('currentUser');
    } catch (e) {
      console.warn('Could not remove user session from sessionStorage');
    }
  };

  // 🔒 หากยังไม่ได้เข้าสู่ระบบ แสดงหน้า LoginModal
  if (!currentUser) {
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-900 text-slate-100 font-sans">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-200">กำลังเชื่อมต่อและดึงข้อมูลจากฐานข้อมูล...</h2>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-900 text-slate-100 font-sans p-6">
        <div className="bg-slate-800 p-8 rounded-2xl border border-rose-500/50 max-w-lg text-center space-y-4 shadow-2xl">
          <ServerCrash className="w-16 h-16 text-rose-400 mx-auto" />
          <h2 className="text-2xl font-bold text-rose-300">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</h2>
          <p className="text-sm text-slate-300 font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-700">{dbError}</p>
          <button onClick={loadDatabaseData} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            <span>ลองเชื่อมต่อใหม่อีกครั้ง</span>
          </button>
        </div>
      </div>
    );
  }

  const totalRai = plot ? (parseFloat(plot.totalRai) || 0) : calculatedRai;
  const actualTons = plot ? (parseFloat(plot.actualTons) || 0) : 0;
  const targetYield = plot ? (parseFloat(plot.targetYieldPerRai) || 0) : 13.00;

  const actualYieldVal = totalRai > 0 ? actualTons / totalRai : 0;
  const actualYieldPerRai = actualYieldVal.toFixed(2);

  const varianceVal = actualYieldVal - targetYield;
  const varianceFormatted = (varianceVal >= 0 ? '+' : '') + varianceVal.toFixed(2);

  const isPass = varianceVal >= 0;

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-x-hidden overflow-y-auto lg:overflow-hidden">
      <SatelliteMap 
        plot={plot} 
        actualYieldPerRai={actualYieldPerRai} 
        isDrawMode={isDrawMode}
        setIsDrawMode={setIsDrawMode}
        plotPoints={plotPoints}
        handleAddPoint={handleAddPoint}
        handleClearPoints={handleClearPoints}
        calculatedRai={calculatedRai}
      />

      <YieldDashboard 
        plot={plot} 
        setPlot={setPlot}
        plotList={plotList}
        handleFarmerSelect={handleFarmerSelect}
        handleInputChange={handleInputChange}
        handleSaveToDatabase={handleSaveToDatabase}
        dbStatus={dbStatus}
        actualYieldPerRai={actualYieldPerRai} 
        varianceFormatted={varianceFormatted}
        varianceVal={varianceVal}
        isPass={isPass}
        calculatedRai={calculatedRai}
        plotPoints={plotPoints}
        isNewFarmerMode={isNewFarmerMode}
        setIsNewFarmerMode={setIsNewFarmerMode}
        newFarmerData={newFarmerData}
        setNewFarmerData={setNewFarmerData}
        uploadedImage={uploadedImage}
        setUploadedImage={setUploadedImage}
        handleImageUpload={handleImageUpload}
        handleClearPoints={handleClearPoints}
        handleSaveNewFarmer={handleSaveNewFarmer}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}
