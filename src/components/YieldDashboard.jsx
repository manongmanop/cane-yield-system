import React, { useState } from 'react';
import { Database, MapPin, Navigation, TrendingUp, TrendingDown, Activity, Calculator, CheckCircle2, XCircle, Save, Server, ServerCrash, UserCheck, UserPlus, Image as ImageIcon, Search, AlertTriangle, LogOut, User } from 'lucide-react';

function parseCoordinatesToPoints(coords) {
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
      if (val1 > 50) return [val2, val1];
      return [val1, val2];
    }).filter(pt => pt !== null);

    return formatted.length >= 3 ? formatted : null;
  }
  return null;
}

export default function YieldDashboard({
  plot,
  setPlot,
  calculatedRai,
  handleInputChange,
  handleSaveToDatabase,
  dbStatus,
  plotList,
  handleFarmerSelect,
  isNewFarmerMode,
  setIsNewFarmerMode,
  newFarmerData,
  setNewFarmerData,
  uploadedImage,
  setUploadedImage,
  handleImageUpload,
  handleClearPoints,
  handleSaveNewFarmer,
  plotPoints,
  actualYieldPerRai,
  varianceFormatted,
  varianceVal,
  isPass,
  currentUser,
  onLogout
}) {
  const totalRaiDisplay = parseFloat(plot ? plot.totalRai : 0) || 0;
  const actualTonsDisplay = parseFloat(plot ? plot.actualTons : 0) || 0;

  // State สำหรับค้นหาเกษตรกร (ด้วยชื่อหรือเบอร์โทรศัพท์)
  const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
  const [searchAlertModal, setSearchAlertModal] = useState({ show: false, query: '', message: '' });

  // ฟังก์ชันค้นหาเกษตรกรจากชื่อหรือเบอร์โทรศัพท์
  const handleSearchFarmer = () => {
    const term = farmerSearchTerm.trim().toLowerCase();
    if (!term) {
      setSearchAlertModal({ show: true, query: '', message: 'โปรดกรอกชื่อ-นามสกุล หรือเบอร์โทรศัพท์ของเกษตรกรในช่องค้นหา' });
      return;
    }

    const cleanTerm = term.replaceAll('-', '').replaceAll(' ', '');

    const matched = plotList.find(p => {
      const nameMatch = p.farmerName && p.farmerName.toLowerCase().includes(term);
      const phoneRaw = p.phoneNumber ? p.phoneNumber.replaceAll('-', '').replaceAll(' ', '') : '';
      const phoneMatch = phoneRaw && phoneRaw.includes(cleanTerm);
      const plotNameMatch = p.plotName && p.plotName.toLowerCase().includes(term);
      const idMatch = (p.plotId && p.plotId.toLowerCase().includes(term)) || (p.farmerId && p.farmerId.toLowerCase().includes(term));
      return nameMatch || phoneMatch || plotNameMatch || idMatch;
    });

    if (matched) {
      handleFarmerSelect({ target: { value: matched.plotId } });
      setFarmerSearchTerm('');
    } else {
      setSearchAlertModal({
        show: true,
        query: farmerSearchTerm,
        message: `ไม่พบรายชื่อเกษตรกรหรือเบอร์โทรศัพท์ "${farmerSearchTerm}" ในระบบ โปรดตรวจสอบข้อมูลอีกครั้ง`
      });
    }
  };

  return (
    <div className="w-full lg:w-5/12 xl:w-1/3 h-auto lg:h-full p-4 sm:p-6 flex flex-col justify-between overflow-y-auto bg-slate-900/95 text-slate-100 space-y-5 sm:space-y-6 shrink-0 relative">
      
      {/* Alert Modal แจ้งเตือนบนหน้าจอเมื่อไม่พบข้อมูลเกษตรกรที่ค้นหา */}
      {searchAlertModal.show && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/60 rounded-2xl p-6 max-w-sm sm:max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-extrabold text-rose-300">ไม่พบรายชื่อเกษตรกรในระบบ</h3>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans bg-slate-950/90 p-3.5 rounded-xl border border-slate-800">
                {searchAlertModal.message}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSearchAlertModal({ show: false, query: '', message: '' })}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <span>ตกลง / ปิดหน้าต่าง (ตรวจสอบใหม่)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 sm:space-y-6">
        
        {/* Header & Connection Status Badge */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Database className="w-5 h-5 shrink-0" />
              <span className="text-xs tracking-wider uppercase font-extrabold text-emerald-400">Raw Materials System</span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* สถานะการเชื่อมต่อฐานข้อมูล */}
              <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border shadow-sm ${
                dbStatus.isConnected 
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                {dbStatus.isConnected ? <Server className="w-3 h-3 text-emerald-400" /> : <ServerCrash className="w-3 h-3 text-amber-400" />}
                <span className="font-medium">{dbStatus.isConnected ? 'เชื่อมต่อฐานข้อมูลแล้ว' : 'ฐานข้อมูลออฟไลน์'}</span>
              </div>

              {/* ปุ่มออกจากระบบ (Logout) */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-700/60 hover:bg-rose-600/80 text-slate-300 hover:text-white text-[11px] font-medium rounded-full border border-slate-600/60 transition cursor-pointer shadow-sm"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-3 h-3" />
                  <span>ออกจากระบบ</span>
                </button>
              )}
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-extrabold text-slate-100">ระบบคำนวณและประเมินผลผลิตอ้อย</h1>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> โรงงานน้ำตาล จ.สุรินทร์ (อ.ปราสาท)
          </p>
        </div>

        {/* ---------------- 1️⃣ กล่องเลือกเกษตรกร / ขึ้นทะเบียนเกษตรกรใหม่ ---------------- */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
          
          {/* ส่วนหัว: ปุ่มสลับโหมด */}
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
              {isNewFarmerMode ? <UserPlus className="w-4 h-4 text-emerald-400" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
              <span>{isNewFarmerMode ? '📝 ขึ้นทะเบียนเกษตรกรใหม่' : '👥 เลือกเกษตรกรในระบบ'}</span>
            </label>
            <button 
              onClick={() => {
                setIsNewFarmerMode(!isNewFarmerMode);
                setUploadedImage(null); 
                handleClearPoints(); 
              }}
              className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium cursor-pointer shadow"
            >
              {isNewFarmerMode ? 'ยกเลิก / กลับไปเลือกคนเดิม' : '+ เพิ่มเกษตรกรใหม่'}
            </button>
          </div>

          {/* โหมดที่ 1: เลือกเกษตรกรเดิม (Dropdown + ช่องค้นหาด้วยชื่อ/เบอร์โทร) */}
          {!isNewFarmerMode && (
            <div className="space-y-3">
              {/* ช่องค้นหาด้วยชื่อ หรือ เบอร์โทรศัพท์ */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-300 font-medium flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ค้นหาเกษตรกร (ด้วยชื่อ-นามสกุล หรือ เบอร์โทรศัพท์):</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อ หรือ เบอร์โทร เช่น 081-234-5678..."
                    value={farmerSearchTerm}
                    onChange={(e) => setFarmerSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchFarmer()}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition font-sans"
                  />
                  <button
                    onClick={handleSearchFarmer}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>ค้นหา</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">รายชื่อเกษตรกรในระบบ (Multi-farmer Selection):</label>
                {plotList && plotList.length > 0 && (
                  <select 
                    value={plot ? plot.plotId : ''}
                    onChange={handleFarmerSelect}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-sm text-emerald-300 font-semibold focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="" disabled hidden={plot !== null}>-- โปรดเลือกเกษตรกรเพื่อเริ่มการคำนวณ --</option>
                    {plotList.map(p => (
                      <option key={p.plotId} value={p.plotId}>
                        {p.farmerName} {p.phoneNumber ? `(${p.phoneNumber})` : ''} — {p.plotName} ({p.plotId})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* โหมดที่ 2: ฟอร์มขึ้นทะเบียนคนใหม่ + อัปโหลดภาพ */}
          {isNewFarmerMode && (
            <div className="space-y-3 bg-slate-900/50 p-4 rounded-lg border border-slate-600">
              
              {/* กรอกชื่อและแปลง */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">ชื่อ-นามสกุล เกษตรกรใหม่</label>
                  <input 
                    type="text" 
                    placeholder="เช่น นายสมหมาย ใจดี" 
                    value={newFarmerData.fullName}
                    onChange={(e) => setNewFarmerData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500" 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">ชื่อแปลงอ้อย</label>
                  <input 
                    type="text" 
                    placeholder="เช่น แปลงหนองบัว 1" 
                    value={newFarmerData.plotName}
                    onChange={(e) => setNewFarmerData(prev => ({ ...prev, plotName: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500" 
                  />
                </div>
              </div>

              {/* อัปโหลดภาพจำลอง / เอกสาร */}
              <div className="pt-2">
                <label className="text-xs text-slate-400 block mb-1 font-medium flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>อัปโหลดภาพจำลองแปลง / รูปถ่ายโดรน / โฉนด</span>
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
                
                {/* แสดง Preview รูปภาพที่อัปโหลด */}
                {uploadedImage && (
                  <div className="mt-3 relative rounded-lg overflow-hidden border border-slate-600">
                    <img src={uploadedImage} alt="Plot Preview" className="w-full h-32 object-cover" />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-slate-900/90 to-transparent flex items-end p-2.5">
                      <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> รูปภาพแนบสำเร็จ
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs text-amber-400 bg-amber-950/40 p-2.5 rounded border border-amber-500/30">
                * หลังจากกรอกข้อมูล โปรดคลิกเปิดโหมดวาดพิกัดแปลงบนแผนที่ดาวเทียม เพื่อคำนวณพื้นที่สุทธิเป็นไร่
              </div>

              <button
                onClick={handleSaveNewFarmer}
                disabled={dbStatus.isSaving}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{dbStatus.isSaving ? 'กำลังบันทึกลงฐานข้อมูล...' : 'ขึ้นทะเบียนเกษตรกรใหม่ลงฐานข้อมูล'}</span>
              </button>
            </div>
          )}

        </div>

        {/* ---------------- การ์ดกรณีที่ยังไม่ได้เลือกเกษตรกร ---------------- */}
        {!plot && !isNewFarmerMode && calculatedRai === 0 && (
          <div className="bg-slate-800/80 p-8 rounded-xl border border-dashed border-slate-700 text-center space-y-3 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200">ยังไม่ได้เลือกแปลงเกษตรกร</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              โปรดเลือกเกษตรกรจากเมนูด้านบน หรือกดปุ่ม <strong className="text-emerald-400">+ เพิ่มเกษตรกรใหม่</strong> หรือกรอกพิกัดค้นหาบนแผนที่เพื่อเริ่มต้นใช้งานระบบคำนวณ
            </p>
          </div>
        )}

        {/* ---------------- การ์ดข้อมูลเกษตรกรและแปลงที่เลือก + พิกัด ---------------- */}
        {!isNewFarmerMode && plot && (() => {
          const parsedPts = parseCoordinatesToPoints(plot.coordinates);
          const displayPoints = (plotPoints && plotPoints.length >= 3) ? plotPoints : (parsedPts || []);
          
          let displayCenterLat = '-';
          let displayCenterLng = '-';

          if (plot.centerLat && plot.centerLng && !isNaN(plot.centerLat) && !isNaN(plot.centerLng)) {
            displayCenterLat = parseFloat(plot.centerLat).toFixed(6);
            displayCenterLng = parseFloat(plot.centerLng).toFixed(6);
          } else if (displayPoints && displayPoints.length > 0) {
            const lats = displayPoints.map(pt => parseFloat(pt[0])).filter(val => !isNaN(val));
            const lngs = displayPoints.map(pt => parseFloat(pt[1])).filter(val => !isNaN(val));
            if (lats.length > 0) displayCenterLat = (lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(6);
            if (lngs.length > 0) displayCenterLng = (lngs.reduce((a, b) => a + b, 0) / lngs.length).toFixed(6);
          }

          return (
            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 space-y-2.5 text-sm shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-700/80 pb-2">
                <span className="text-slate-400 text-xs font-medium">รหัสแปลง:</span>
                <span className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">{plot.plotId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ชื่อเกษตรกร:</span>
                <span className="font-semibold text-slate-100">{plot.farmerName}</span>
              </div>
              {plot.phoneNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-400">เบอร์โทรศัพท์:</span>
                  <span className="font-mono text-emerald-300 font-semibold">{plot.phoneNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">ชื่อแปลง:</span>
                <span className="text-slate-200">{plot.plotName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">สายพันธุ์อ้อย:</span>
                <span className="text-emerald-300 font-medium">{plot.caneVariety}</span>
              </div>

              {/* ส่วนแสดงพิกัดภูมิศาสตร์ GIS (Center Lat, Lng & Points) */}
              <div className="pt-2 border-t border-slate-700/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>พิกัดแปลงอ้อย (GIS Location):</span>
                </div>
                
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 flex justify-around items-center shadow-inner">
                  <div><span className="text-slate-500 text-[10px] block">Lat (Y):</span>{displayCenterLat}</div>
                  <div className="h-6 w-[1px] bg-slate-800"></div>
                  <div><span className="text-slate-500 text-[10px] block">Lng (X):</span>{displayCenterLng}</div>
                </div>

                {/* แสดงรายการพิกัดหมุดมุมแปลง */}
                {displayPoints && displayPoints.length > 0 && (
                  <details className="text-xs text-slate-400 cursor-pointer pt-1 group">
                    <summary className="hover:text-emerald-300 transition flex items-center justify-between font-medium select-none">
                      <span className="flex items-center gap-1">📍 รายละเอียดพิกัดหมุดมุมแปลง ({displayPoints.length} หมุด)</span>
                      <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-2 space-y-1 max-h-36 overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[11px]">
                      {displayPoints.map((pt, idx) => (
                        <div key={idx} className="flex justify-between text-slate-300 hover:text-emerald-300 py-0.5 border-b border-slate-900 last:border-none">
                          <span className="text-slate-500">หมุดที่ {idx + 1}:</span>
                          <span className="text-emerald-400/90">{parseFloat(pt[0]).toFixed(6)}, {parseFloat(pt[1]).toFixed(6)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })()}

        {/* ---------------- แสดงส่วนคำนวณเมื่อมีแปลงที่เลือก / กำลังวาด / เพิ่มเกษตรกรใหม่ ---------------- */}
        {(plot || isNewFarmerMode || calculatedRai > 0) && (
          <>
            {/* ---------------- ข้อมูลพื้นที่ที่คำนวณได้จากพิกัดแผนที่ (Turf.js GIS) ---------------- */}
            <div className="bg-slate-800 p-4 rounded-xl border border-emerald-500/40 space-y-3">
              <h2 className="text-sm font-bold text-slate-200">ข้อมูลพื้นที่ที่คำนวณได้ (ระบบคำนวณจากพิกัด Turf.js)</h2>
              
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                <label className="text-xs text-slate-400 block mb-1">พื้นที่ปลูกสุทธิ (ตารางเมตร ➔ ไร่)</label>
                <div className="flex items-baseline gap-2">
                  <h1 className="text-4xl font-extrabold text-emerald-400 font-mono">
                    {calculatedRai > 0 ? calculatedRai.toFixed(2) : totalRaiDisplay.toFixed(2)}
                  </h1>
                  <span className="text-slate-400 text-sm">ไร่</span>
                </div>

                {plotPoints && plotPoints.length >= 3 ? (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/50 p-2 rounded border border-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 
                    <span>ดึงข้อมูลพิกัดภูมิศาสตร์สำเร็จ (คำนวณ {calculatedRai.toFixed(2)} ไร่)</span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/50 p-2 rounded border border-amber-800">
                    <span>* คุณสามารถเปิดโหมดวาดแปลงและคลิกบนแผนที่อย่างน้อย 3 หมุด เพื่อคำนวณพื้นที่จริง</span>
                  </div>
                )}
              </div>
            </div>

            {/* ---------------- ป้อนข้อมูลคำนวณตัวเลข (น้ำหนักอ้อย / เป้าหมาย) ---------------- */}
            {plot && (
              <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <Calculator className="w-4 h-4" />
                    <span>ป้อนข้อมูลคำนวณ</span>
                  </div>
                  
                  {!isNewFarmerMode && (
                    <button
                      onClick={handleSaveToDatabase}
                      disabled={dbStatus.isSaving}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-md"
                      title="บันทึกข้อมูลลงฐานข้อมูล"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{dbStatus.isSaving ? 'กำลังบันทึก...' : 'บันทึกลงฐานข้อมูล'}</span>
                    </button>
                  )}
                </div>

                {/* Inputs ตัวเลข */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium flex items-center justify-between">
                      <span>พื้นที่ปลูก (ไร่)</span>
                      <span className="text-[9px] text-emerald-400/80 font-mono">(GIS Read-only)</span>
                    </label>
                    <input
                      type="number"
                      name="totalRai"
                      value={plot.totalRai}
                      readOnly
                      disabled
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-emerald-400 font-mono focus:outline-none cursor-not-allowed opacity-90 font-bold"
                      placeholder="120"
                      step="any"
                      title="พื้นที่ปลูกถูกคำนวณอัตโนมัติจากพิกัดแผนที่ GIS (Read-only)"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">น้ำหนักอ้อย (ตัน)</label>
                    <input
                      type="number"
                      name="actualTons"
                      value={plot.actualTons}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500 transition"
                      placeholder="1680"
                      step="any"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">เป้าหมาย (ตัน/ไร่)</label>
                    <input
                      type="number"
                      name="targetYieldPerRai"
                      value={plot.targetYieldPerRai}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500 transition"
                      placeholder="13.00"
                      step="any"
                    />
                  </div>
                </div>

                {/* ข้อความแจ้งเตือนสถานะบันทึก */}
                {dbStatus.message && (
                  <p className={`text-[11px] font-mono text-right ${dbStatus.isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dbStatus.message}
                  </p>
                )}
              </div>
            )}

            {/* 2️⃣ การแสดงผลการคำนวณอัตราผลผลิตจริง */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 p-5 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-emerald-300">ผลผลิตเฉลี่ยจริง (Yield)</span>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {actualYieldPerRai} <span className="text-sm font-normal text-slate-300">ตัน/ไร่</span>
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-emerald-500/50" />
              </div>
              <p className="text-xs text-emerald-400/80 mt-2 font-mono">
                สูตรคำนวณ: {actualTonsDisplay.toLocaleString()} ตัน ÷ {totalRaiDisplay.toLocaleString()} ไร่ = {actualYieldPerRai} ตัน/ไร่
              </p>
            </div>

            {/* 3️⃣ & 4️⃣ ผลการตรวจสอบเงื่อนไขและผลต่าง (Variance & Pass/Fail Status) */}
            <div 
              className={`p-5 rounded-xl border transition-all duration-300 ${
                isPass 
                  ? 'bg-emerald-950/50 border-emerald-500/60 shadow-lg shadow-emerald-950/20' 
                  : 'bg-rose-950/50 border-rose-500/60 shadow-lg shadow-rose-950/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">ผลต่างเทียบเป้าหมาย (Variance)</span>
                {isPass ? (
                  <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านเกณฑ์ (Pass)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <XCircle className="w-3.5 h-3.5" /> ตกเกณฑ์ (Fail)
                  </span>
                )}
              </div>
              
              <div className="flex items-baseline justify-between mt-1">
                <p className={`text-3xl font-extrabold ${isPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {varianceFormatted} <span className="text-sm font-normal text-slate-300">ตัน/ไร่</span>
                </p>
                {isPass ? (
                  <TrendingUp className="w-8 h-8 text-emerald-400/60" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-rose-400/60" />
                )}
              </div>

              <p className={`text-xs mt-2 font-mono ${isPass ? 'text-emerald-300/80' : 'text-rose-300/80'}`}>
                เป้าหมาย: {parseFloat(plot ? plot.targetYieldPerRai : 0) || 0} ตัน/ไร่ ({isPass ? 'สูงกว่าหรือเท่ากับเป้าหมาย' : 'ต่ำกว่าเป้าหมาย'})
              </p>
            </div>
          </>
        )}

      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
        Raw Materials Information System • Assessment Project
      </div>

    </div>
  );
}
