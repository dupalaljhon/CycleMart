import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import compatRoutes from './routes/compat.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendUrl = process.env.FRONTEND_URL || '*';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Primary uploads directory (Node.js backend)
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

// Legacy uploads directory (PHP backend) - for backward compatibility
const legacyUploadsDir = path.resolve(__dirname, '..', '..', 'CycleMart-api', 'api', 'uploads');

app.use(
	cors({
		origin: frontendUrl === '*' ? true : frontendUrl,
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
	})
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploads from Node.js backend (primary)
app.use('/uploads', express.static(uploadsDir));

// Serve legacy uploads from PHP backend (fallback for existing images)
// This allows existing images to continue working during migration
app.use('/uploads', express.static(legacyUploadsDir));

app.get('/', (_req, res) => {
	res.json({
		name: 'CycleMart Node API',
		version: '1.0.0',
		status: 'active',
		timestamp: new Date().toISOString()
	});
});

app.use('/api', compatRoutes);
app.use('/', compatRoutes);

app.use((err, _req, res, _next) => {
	console.error(err);
	res.status(500).json({
		status: 'error',
		code: 500,
		message: err.message || 'Internal server error',
		data: null
	});
});

app.listen(port, () => {
	console.log(`CycleMart Node API running on port ${port}`);
});
