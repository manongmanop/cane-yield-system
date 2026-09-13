import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { initDatabase } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Fallback In-Memory Mock Data Store (used when MySQL is offline)
let inMemoryPlots = [
  {
    plotId: 'PL-67001-A',
    plotName: 'แปลงอ้อยเนินสมบูรณ์ 1',
    farmerId: 'FM-67001',
    farmerName: 'นายสมพงษ์ สุรินทร์มั่นคง',
    phoneNumber: '081-234-5678',
    totalRai: 120.00,
    actualTons: 1680.00,
    targetYieldPerRai: 13.00,
    caneVariety: 'ขอนแก่น 3',
    ndviScore: 0.800,
    centerLat: 14.6490,
    centerLng: 103.4245,
    coordinates: [
      [14.6465, 103.4215],
      [14.6515, 103.4215],
      [14.6515, 103.4275],
      [14.6465, 103.4275]
    ]
  },
  {
    plotId: 'PL-67002-B',
    plotName: 'แปลงอ้อยโคกสมบูรณ์ 2',
    farmerId: 'FM-67002',
    farmerName: 'นางมณี สุรินทร์พิทักษ์',
    phoneNumber: '089-876-5432',
    totalRai: 50.00,
    actualTons: 700.00,
    targetYieldPerRai: 14.00,
    caneVariety: 'อู่ทอง 12',
    ndviScore: 0.850,
    centerLat: 14.6600,
    centerLng: 103.4375,
    coordinates: [
      [14.6580, 103.4350],
      [14.6620, 103.4350],
      [14.6620, 103.4400],
      [14.6580, 103.4400]
    ]
  },
  {
    plotId: 'PL-67003-C',
    plotName: 'แปลงอ้อยศิลาทิพย์ 3',
    farmerId: 'FM-67003',
    farmerName: 'นายวิชัย เจริญทรัพย์',
    phoneNumber: '086-555-4321',
    totalRai: 80.00,
    actualTons: 960.00,
    targetYieldPerRai: 13.50,
    caneVariety: 'ขอนแก่น 3',
    ndviScore: 0.720,
    centerLat: 14.6410,
    centerLng: 103.4125,
    coordinates: [
      [14.6390, 103.4100],
      [14.6430, 103.4100],
      [14.6430, 103.4150],
      [14.6390, 103.4150]
    ]
  }
];

// Initialize database tables matching cane_ki.sql on startup
initDatabase();

// GET /api/plots - List all plots directly from cane_ki_database (with fallback)
app.get('/api/plots', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.plot_id AS plotId,
        p.plot_name AS plotName,
        f.farmer_id AS farmerId,
        f.full_name AS farmerName,
        f.phone_number AS phoneNumber,
        p.total_rai AS totalRai,
        COALESCE(SUM(d.net_weight_ton), 0) AS actualTons,
        COALESCE(p.target_yield_per_rai, 13.00) AS targetYieldPerRai,
        p.cane_variety AS caneVariety,
        p.boundary_geojson AS coordinates,
        p.center_lat AS centerLat,
        p.center_lng AS centerLng,
        COALESCE(sa.mean_ndvi, 0.800) AS ndviScore
      FROM cane_plots p
      JOIN farmers f ON p.farmer_id = f.farmer_id
      LEFT JOIN cane_deliveries d ON p.plot_id = d.plot_id
      LEFT JOIN (
        SELECT plot_id, mean_ndvi 
        FROM satellite_analysis 
        ORDER BY capture_date DESC 
        LIMIT 1
      ) sa ON p.plot_id = sa.plot_id
      GROUP BY p.plot_id, f.farmer_id, f.full_name, f.phone_number, p.plot_name, p.total_rai, p.target_yield_per_rai, p.cane_variety, p.boundary_geojson, p.center_lat, p.center_lng, sa.mean_ndvi
      ORDER BY p.created_at DESC
    `;
    const [rows] = await pool.query(query);

    const formattedPlots = rows.map(plot => ({
      ...plot,
      totalRai: parseFloat(plot.totalRai),
      actualTons: parseFloat(plot.actualTons),
      targetYieldPerRai: parseFloat(plot.targetYieldPerRai),
      centerLat: plot.centerLat ? parseFloat(plot.centerLat) : null,
      centerLng: plot.centerLng ? parseFloat(plot.centerLng) : null,
      ndviScore: parseFloat(plot.ndviScore),
      coordinates: typeof plot.coordinates === 'string' ? JSON.parse(plot.coordinates) : plot.coordinates
    }));

    res.json(formattedPlots);
  } catch (error) {
    console.warn('⚠️ Database query warning, serving in-memory mock data:', error.message);
    res.json(inMemoryPlots);
  }
});

// GET /api/plots/:id - Get specific plot from database
app.get('/api/plots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        p.plot_id AS plotId,
        p.plot_name AS plotName,
        f.farmer_id AS farmerId,
        f.full_name AS farmerName,
        f.phone_number AS phoneNumber,
        p.total_rai AS totalRai,
        COALESCE(SUM(d.net_weight_ton), 0) AS actualTons,
        COALESCE(p.target_yield_per_rai, 13.00) AS targetYieldPerRai,
        p.cane_variety AS caneVariety,
        p.boundary_geojson AS coordinates,
        p.center_lat AS centerLat,
        p.center_lng AS centerLng,
        COALESCE(sa.mean_ndvi, 0.800) AS ndviScore
      FROM cane_plots p
      JOIN farmers f ON p.farmer_id = f.farmer_id
      LEFT JOIN cane_deliveries d ON p.plot_id = d.plot_id
      LEFT JOIN (
        SELECT plot_id, mean_ndvi 
        FROM satellite_analysis 
        ORDER BY capture_date DESC 
        LIMIT 1
      ) sa ON p.plot_id = sa.plot_id
      WHERE p.plot_id = ?
      GROUP BY p.plot_id, f.farmer_id, f.full_name, f.phone_number, p.plot_name, p.total_rai, p.target_yield_per_rai, p.cane_variety, p.boundary_geojson, p.center_lat, p.center_lng, sa.mean_ndvi
    `;
    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Plot not found in database' });
    }

    const plot = rows[0];
    res.json({
      ...plot,
      totalRai: parseFloat(plot.totalRai),
      actualTons: parseFloat(plot.actualTons),
      targetYieldPerRai: parseFloat(plot.targetYieldPerRai),
      centerLat: plot.centerLat ? parseFloat(plot.centerLat) : null,
      centerLng: plot.centerLng ? parseFloat(plot.centerLng) : null,
      ndviScore: parseFloat(plot.ndviScore),
      coordinates: typeof plot.coordinates === 'string' ? JSON.parse(plot.coordinates) : plot.coordinates
    });
  } catch (error) {
    console.error('Error fetching plot details from cane_ki_database:', error);
    res.status(500).json({ error: 'Failed to fetch plot details' });
  }
});

// POST /api/plots - Register new farmer & plot in cane_ki_database
app.post('/api/plots', async (req, res) => {
  try {
    const { fullName, plotName, totalRai, actualTons, targetYieldPerRai, caneVariety, coordinates } = req.body;
    
    // Generate unique IDs
    const timestamp = Date.now().toString().slice(-4);
    const farmerId = `FM-67${timestamp}`;
    const plotId = `PL-67${timestamp}-N`;
    const idCard = `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

    // 1. Insert into farmers
    await pool.query(
      `INSERT INTO farmers (farmer_id, id_card, full_name, phone_number) 
       VALUES (?, ?, ?, '081-000-0000')`,
      [farmerId, idCard, fullName || 'เกษตรกรใหม่']
    );

    let centerLat = null;
    let centerLng = null;
    if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
      const lats = coordinates.map(pt => parseFloat(pt[0])).filter(v => !isNaN(v));
      const lngs = coordinates.map(pt => parseFloat(pt[1])).filter(v => !isNaN(v));
      if (lats.length > 0) centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      if (lngs.length > 0) centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    }

    // 2. Insert into cane_plots
    await pool.query(
      `INSERT INTO cane_plots (plot_id, farmer_id, plot_name, total_rai, cane_variety, target_yield_per_rai, boundary_geojson, center_lat, center_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plotId, 
        farmerId, 
        plotName || 'แปลงอ้อยใหม่', 
        parseFloat(totalRai) || 0, 
        caneVariety || 'ขอนแก่น 3', 
        parseFloat(targetYieldPerRai) || 13.00,
        JSON.stringify(coordinates || [[14.6465, 103.4215], [14.6515, 103.4215], [14.6515, 103.4275], [14.6465, 103.4275]]),
        centerLat,
        centerLng
      ]
    );

    // 3. Insert into cane_deliveries
    const grossKg = (parseFloat(actualTons) || 0) * 1000 + 20000;
    await pool.query(
      `INSERT INTO cane_deliveries (delivery_id, plot_id, gross_weight_kg, tare_weight_kg)
       VALUES (?, ?, ?, 20000.00)`,
      [`DL-${plotId}`, plotId, grossKg]
    );

    // 4. Insert into satellite_analysis
    await pool.query(
      `INSERT INTO satellite_analysis (plot_id, satellite_source, capture_date, mean_ndvi)
       VALUES (?, 'Sentinel-2', CURDATE(), 0.800)`,
      [plotId]
    );

    const newPlotData = {
      plotId,
      plotName: plotName || 'แปลงอ้อยใหม่',
      farmerName: fullName || 'เกษตรกรใหม่',
      totalRai: parseFloat(totalRai) || 0,
      actualTons: parseFloat(actualTons) || 0,
      targetYieldPerRai: parseFloat(targetYieldPerRai) || 13.00,
      caneVariety: caneVariety || 'ขอนแก่น 3',
      ndviScore: 0.800,
      centerLat,
      centerLng,
      coordinates: coordinates || [[14.6465, 103.4215], [14.6515, 103.4215], [14.6515, 103.4275], [14.6465, 103.4275]]
    };

    res.json({
      message: 'New farmer and plot registered successfully in database',
      plot: newPlotData
    });
  } catch (error) {
    console.warn('⚠️ MySQL unavailable for POST, falling back to in-memory store:', error.message);
    const timestamp = Date.now().toString().slice(-4);
    const fallbackPlot = {
      plotId: `PL-67${timestamp}-N`,
      plotName: req.body.plotName || 'แปลงอ้อยใหม่',
      farmerName: req.body.fullName || 'เกษตรกรใหม่',
      phoneNumber: '081-000-0000',
      totalRai: parseFloat(req.body.totalRai) || 0,
      actualTons: parseFloat(req.body.actualTons) || 0,
      targetYieldPerRai: parseFloat(req.body.targetYieldPerRai) || 13.00,
      caneVariety: 'ขอนแก่น 3',
      ndviScore: 0.800,
      coordinates: req.body.coordinates || [[14.6465, 103.4215], [14.6515, 103.4215], [14.6515, 103.4275], [14.6465, 103.4275]]
    };
    inMemoryPlots.unshift(fallbackPlot);
    res.json({ message: 'New farmer registered in-memory', plot: fallbackPlot });
  }
});

// PUT /api/plots/:id - Update plot data & GIS coordinates in cane_plots and cane_deliveries
app.put('/api/plots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { totalRai, actualTons, targetYieldPerRai, coordinates } = req.body;

    const totalRaiVal = parseFloat(totalRai) || 0;
    const actualTonsVal = parseFloat(actualTons) || 0;
    const targetYieldVal = parseFloat(targetYieldPerRai) || 13.00;

    let centerLat = null;
    let centerLng = null;

    // คำนวณจุดศูนย์กลาง center_lat, center_lng หากมีการส่งพิกัดวาดใหม่มา
    if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
      const lats = coordinates.map(pt => parseFloat(pt[0])).filter(v => !isNaN(v));
      const lngs = coordinates.map(pt => parseFloat(pt[1])).filter(v => !isNaN(v));
      if (lats.length > 0) centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      if (lngs.length > 0) centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    }

    if (coordinates && coordinates.length >= 3) {
      // 1. อัปเดตพิกัดรูปแปลง boundary_geojson, center_lat, center_lng, total_rai, target_yield_per_rai ใน cane_plots
      await pool.query(
        `UPDATE cane_plots 
         SET total_rai = ?, target_yield_per_rai = ?, boundary_geojson = ?, center_lat = ?, center_lng = ?
         WHERE plot_id = ?`,
        [totalRaiVal, targetYieldVal, JSON.stringify(coordinates), centerLat, centerLng, id]
      );
    } else {
      await pool.query(
        `UPDATE cane_plots 
         SET total_rai = ?, target_yield_per_rai = ?
         WHERE plot_id = ?`,
        [totalRaiVal, targetYieldVal, id]
      );
    }

    // 2. Update actual delivered weight in cane_deliveries
    const [existingDelivery] = await pool.query('SELECT delivery_id FROM cane_deliveries WHERE plot_id = ? LIMIT 1', [id]);
    if (existingDelivery.length > 0) {
      const grossKg = actualTonsVal * 1000 + 20000; // gross = net + 20t tare
      await pool.query(
        `UPDATE cane_deliveries 
         SET gross_weight_kg = ?, tare_weight_kg = 20000.00 
         WHERE delivery_id = ?`,
        [grossKg, existingDelivery[0].delivery_id]
      );
    } else {
      const grossKg = actualTonsVal * 1000 + 20000;
      await pool.query(
        `INSERT INTO cane_deliveries (delivery_id, plot_id, gross_weight_kg, tare_weight_kg)
         VALUES (?, ?, ?, 20000.00)`,
        [`DL-${id}-01`, id, grossKg]
      );
    }

    res.json({ message: 'Updated plot, coordinates, and delivery weight in cane_ki_database successfully', plotId: id });
  } catch (error) {
    console.warn('⚠️ MySQL unavailable for PUT, updating in-memory store:', error.message);
    const { id } = req.params;
    inMemoryPlots = inMemoryPlots.map(p => p.plotId === id ? { ...p, ...req.body } : p);
    res.json({ message: 'Updated plot in-memory', plotId: id });
  }
});

// POST /api/auth/login - Authenticate user credentials
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const u = (username || '').toString().trim();
    const p = (password || '').toString().trim();

    if (!u || !p) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
    }

    // 1. Fallback check for demo accounts (guarantees judge/123456 and admin/admin123 always work)
    if (u === 'judge' && p === '123456') {
      return res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        user: { userId: 1, username: 'judge', fullName: 'กรรมการประเมินระบบ', role: 'judge' }
      });
    }

    if (u === 'admin' && p === 'admin123') {
      return res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        user: { userId: 2, username: 'admin', fullName: 'ผู้ดูแลระบบ', role: 'admin' }
      });
    }

    // 2. Database query check
    const [rows] = await pool.query(
      'SELECT user_id, username, password_hash, full_name, role FROM users WHERE username = ?',
      [u]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];

    // Check password
    if (user.password_hash.toString().trim() !== p) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Express API Server for cane_ki_database running on http://localhost:${PORT}`);
});
