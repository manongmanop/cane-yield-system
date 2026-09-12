const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Authenticate user login
 */
export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
  }
  return data;
}

/**
 * Fetch all plots strictly from Database via Express API
 */
export async function fetchAllPlots() {
  const response = await fetch(`${API_BASE_URL}/plots`);
  if (!response.ok) {
    throw new Error(`ไม่สามารถดึงข้อมูลจาก API ฐานข้อมูล ได้ (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Fetch specific plot details from Express Database Backend
 */
export async function fetchPlotById(plotId) {
  const response = await fetch(`${API_BASE_URL}/plots/${plotId}`);
  if (!response.ok) {
    throw new Error(`ไม่พบแปลง ${plotId} ในฐานข้อมูล (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Register new farmer and plot in Database via Express API
 */
export async function createPlotInDatabase(plotData) {
  const response = await fetch(`${API_BASE_URL}/plots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(plotData),
  });
  if (!response.ok) {
    throw new Error(`ไม่สามารถขึ้นทะเบียนเกษตรกรใหม่ลงฐานข้อมูลได้ (HTTP ${response.status})`);
  }
  return await response.json();
}

/**
 * Update plot details and GIS coordinates in Database via Express API
 */
export async function updatePlotInDatabase(plotId, data) {
  const response = await fetch(`${API_BASE_URL}/plots/${plotId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      totalRai: data.totalRai,
      actualTons: data.actualTons,
      targetYieldPerRai: data.targetYieldPerRai,
      coordinates: data.coordinates, // ส่งพิกัดการวาดรูปแปลง GIS ไปยังฐานข้อมูล
    }),
  });
  if (!response.ok) {
    throw new Error(`ไม่สามารถบันทึกลงฐานข้อมูลได้ (HTTP ${response.status})`);
  }
  return await response.json();
}
