import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cane_ki_database',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to Database (cane_ki_database) Successfully!');

    // 1. Table: farmers
    await connection.query(`
      CREATE TABLE IF NOT EXISTS farmers (
        farmer_id VARCHAR(20) NOT NULL PRIMARY KEY,
        id_card VARCHAR(13) NOT NULL UNIQUE,
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(15) NULL DEFAULT NULL,
        address TEXT NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    // 2. Table: cane_plots
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cane_plots (
        plot_id VARCHAR(20) NOT NULL PRIMARY KEY,
        farmer_id VARCHAR(20) NOT NULL,
        plot_name VARCHAR(100) NOT NULL,
        sub_district VARCHAR(50) NULL DEFAULT NULL,
        district VARCHAR(50) NULL DEFAULT NULL,
        province VARCHAR(50) NULL DEFAULT 'สุรินทร์',
        total_rai DECIMAL(8,2) NOT NULL,
        cane_variety VARCHAR(50) NULL DEFAULT NULL,
        planting_date DATE NULL DEFAULT NULL,
        boundary_geojson JSON NULL DEFAULT NULL,
        target_yield_per_rai DECIMAL(6,2) NULL DEFAULT 13.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    // 3. Table: cane_deliveries
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cane_deliveries (
        delivery_id VARCHAR(20) NOT NULL PRIMARY KEY,
        plot_id VARCHAR(20) NOT NULL,
        delivery_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        license_plate VARCHAR(20) NULL DEFAULT NULL,
        gross_weight_kg DECIMAL(10,2) NOT NULL,
        tare_weight_kg DECIMAL(10,2) NOT NULL,
        net_weight_ton DECIMAL(10,2) GENERATED ALWAYS AS (((gross_weight_kg - tare_weight_kg) / 1000.0)) STORED,
        ccs DECIMAL(4,2) NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plot_id) REFERENCES cane_plots(plot_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    // 4. Table: satellite_analysis
    await connection.query(`
      CREATE TABLE IF NOT EXISTS satellite_analysis (
        analysis_id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        plot_id VARCHAR(20) NOT NULL,
        satellite_source VARCHAR(50) NULL DEFAULT 'Sentinel-2',
        capture_date DATE NOT NULL,
        mean_ndvi DECIMAL(4,3) NOT NULL,
        estimated_yield_per_rai DECIMAL(6,2) NULL DEFAULT NULL,
        estimated_total_tons DECIMAL(10,2) NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plot_id) REFERENCES cane_plots(plot_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    // Seed Multi-farmer data matching mockDatabase
    const farmersSeed = [
      ['FM-67001', '1329900123456', 'นายสมพงษ์ สุรินทร์มั่นคง', '081-234-5678', 'อ.ปราสาท จ.สุรินทร์'],
      ['FM-67002', '1329900987654', 'นางมณี สุรินทร์พิทักษ์', '089-876-5432', 'อ.ปราสาท จ.สุรินทร์'],
      ['FM-67003', '1329900456789', 'นายวิชัย เจริญทรัพย์', '086-555-4321', 'อ.ปราสาท จ.สุรินทร์']
    ];

    for (const farmer of farmersSeed) {
      const [existing] = await connection.query('SELECT farmer_id FROM farmers WHERE farmer_id = ?', [farmer[0]]);
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO farmers (farmer_id, id_card, full_name, phone_number, address) VALUES (?, ?, ?, ?, ?)',
          farmer
        );
      }
    }

    const plotsSeed = [
      ['PL-67001-A', 'FM-67001', 'แปลงอ้อยเนินสมบูรณ์ 1', 120.00, 'ขอนแก่น 3', 13.00, JSON.stringify([[14.6465, 103.4215], [14.6515, 103.4215], [14.6515, 103.4275], [14.6465, 103.4275]])],
      ['PL-67002-B', 'FM-67002', 'แปลงอ้อยโคกสมบูรณ์ 2', 50.00, 'อู่ทอง 12', 14.00, JSON.stringify([[14.6580, 103.4350], [14.6620, 103.4350], [14.6620, 103.4400], [14.6580, 103.4400]])],
      ['PL-67003-C', 'FM-67003', 'แปลงอ้อยศิลาทิพย์ 3', 80.00, 'ขอนแก่น 3', 13.50, JSON.stringify([[14.6390, 103.4100], [14.6430, 103.4100], [14.6430, 103.4150], [14.6390, 103.4150]])]
    ];

    for (const plot of plotsSeed) {
      const [existing] = await connection.query('SELECT plot_id FROM cane_plots WHERE plot_id = ?', [plot[0]]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO cane_plots (plot_id, farmer_id, plot_name, sub_district, district, province, total_rai, cane_variety, target_yield_per_rai, boundary_geojson)
           VALUES (?, ?, ?, 'กังแอน', 'ปราสาท', 'สุรินทร์', ?, ?, ?, ?)`,
          [plot[0], plot[1], plot[2], plot[3], plot[4], plot[5], plot[6]]
        );
      }
    }

    const deliveriesSeed = [
      ['DL-67001-01', 'PL-67001-A', 1700000.00, 20000.00], // 1680 tons
      ['DL-67002-01', 'PL-67002-B', 720000.00, 20000.00],  // 700 tons
      ['DL-67003-01', 'PL-67003-C', 980000.00, 20000.00]   // 960 tons
    ];

    for (const delivery of deliveriesSeed) {
      const [existing] = await connection.query('SELECT delivery_id FROM cane_deliveries WHERE delivery_id = ?', [delivery[0]]);
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO cane_deliveries (delivery_id, plot_id, gross_weight_kg, tare_weight_kg) VALUES (?, ?, ?, ?)',
          delivery
        );
      }
    }

    // 5. Table: users
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
    `);

    // Seed users (ensure judge/123456 and admin/admin123 always exist)
    const usersSeed = [
      ['judge', '123456', 'กรรมการประเมินระบบ', 'judge'],
      ['admin', 'admin123', 'ผู้ดูแลระบบ', 'admin']
    ];

    for (const user of usersSeed) {
      const [existing] = await connection.query('SELECT user_id FROM users WHERE username = ?', [user[0]]);
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
          user
        );
      } else {
        await connection.query(
          'UPDATE users SET password_hash = ?, full_name = ?, role = ? WHERE username = ?',
          [user[1], user[2], user[3], user[0]]
        );
      }
    }

    connection.release();
  } catch (error) {
    console.error('⚠️ Database Connection Warning:', error.message);
  }
}

export default pool;
