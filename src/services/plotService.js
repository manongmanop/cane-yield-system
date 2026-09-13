import { mockDatabase } from '../data/mockPlotData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// In-memory client-side cache for offline mock mode
let clientMockStore = [...mockDatabase];

/**
 * Authenticate user login (with offline fallback for judge / admin)
 */
export async function loginUser(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    if (response.ok && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('⚠️ API login unreachable, using offline authentication fallback');
  }

  // Offline fallback
  const u = (username || '').trim();
  const p = (password || '').trim();
  if (u === 'judge' && p === '123456') {
    return { success: true, user: { userId: 1, username: 'judge', fullName: 'กรรมการประเมินระบบ', role: 'judge' } };
  }
  if (u === 'admin' && p === 'admin123') {
    return { success: true, user: { userId: 2, username: 'admin', fullName: 'ผู้ดูแลระบบ', role: 'admin' } };
  }
  throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
}

/**
 * Fetch all plots (with offline fallback)
 */
export async function fetchAllPlots() {
  try {
    const response = await fetch(`${API_BASE_URL}/plots`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('⚠️ API unreachable, using client-side mock data fallback');
  }
  return clientMockStore;
}

/**
 * Fetch specific plot details (with offline fallback)
 */
export async function fetchPlotById(plotId) {
  try {
    const response = await fetch(`${API_BASE_URL}/plots/${plotId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('⚠️ API unreachable, searching in client mock store');
  }
  const found = clientMockStore.find(p => p.plotId === plotId);
  if (found) return found;
  throw new Error(`ไม่พบแปลง ${plotId} ในระบบ`);
}

/**
 * Register new farmer and plot (with offline fallback)
 */
export async function createPlotInDatabase(plotData) {
  try {
    const response = await fetch(`${API_BASE_URL}/plots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plotData),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('⚠️ API unreachable, saving new farmer to client mock store');
  }

  const timestamp = Date.now().toString().slice(-4);
  const newPlot = {
    plotId: `PL-67${timestamp}-N`,
    plotName: plotData.plotName || 'แปลงอ้อยใหม่',
    farmerName: plotData.fullName || 'เกษตรกรใหม่',
    phoneNumber: '081-000-0000',
    totalRai: parseFloat(plotData.totalRai) || 0,
    actualTons: parseFloat(plotData.actualTons) || 0,
    targetYieldPerRai: parseFloat(plotData.targetYieldPerRai) || 13.00,
    caneVariety: 'ขอนแก่น 3',
    ndviScore: 0.800,
    coordinates: plotData.coordinates || [[14.6465, 103.4215], [14.6515, 103.4215], [14.6515, 103.4275], [14.6465, 103.4275]]
  };
  clientMockStore.unshift(newPlot);
  return { message: 'Registered in mock mode', plot: newPlot };
}

/**
 * Update plot details and GIS coordinates (with offline fallback)
 */
export async function updatePlotInDatabase(plotId, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/plots/${plotId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        totalRai: data.totalRai,
        actualTons: data.actualTons,
        targetYieldPerRai: data.targetYieldPerRai,
        coordinates: data.coordinates,
      }),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('⚠️ API unreachable, updating client mock store');
  }

  clientMockStore = clientMockStore.map(p => p.plotId === plotId ? { ...p, ...data } : p);
  return { message: 'Updated in mock mode', plotId };
}
