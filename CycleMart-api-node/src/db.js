import mysql from 'mysql2/promise';

const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	port: Number(process.env.DB_PORT || 3306),
	user: process.env.DB_USER || 'cyclemart',
	password: process.env.DB_PASSWORD || 'cyclemart123',
	database: process.env.DB_NAME || 'cyclemart',
	connectionLimit: 10,
	waitForConnections: true,
	queueLimit: 0,
	charset: 'utf8mb4'
});

export async function query(sql, params = []) {
	const [rows] = await pool.execute(sql, params);
	return rows;
}

export async function withTransaction(run) {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const result = await run(connection);
		await connection.commit();
		return result;
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export default pool;
