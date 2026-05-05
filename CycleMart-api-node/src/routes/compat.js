import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { query, withTransaction } from '../db.js';
import { sendPayload, respond } from '../utils/payload.js';
import { extractBearerToken, verifyToken } from '../utils/auth.js';
import { buildVerificationEmail, sendEmail } from '../utils/email.js';

const router = express.Router();

function getJwtSecret() {
	return process.env.JWT_SECRET || 'your_secret_key';
}

function getPublicBaseUrl() {
	return process.env.PUBLIC_BASE_URL || 'http://localhost:3001';
}

function getFrontendUrl() {
	return process.env.FRONTEND_URL || 'http://localhost:4200';
}

const barangays = [
	'Asinan',
	'Banicain',
	'Barretto',
	'East Bajac-Bajac',
	'Gordon Heights',
	'Kalaklan',
	'Mabayuan',
	'New Cabalan',
	'Old Cabalan',
	'Pag-asa',
	'Santa Rita',
	'West Bajac-Bajac',
	'East Tapinac',
	'West Tapinac',
	'New Kalalake',
	'Kababae',
	'Ilalim'
];

const publicPostEndpoints = new Set(['register', 'login', 'verify-email', 'resend-verification']);
const staffOnlyEndpoints = new Set([
	'approve-product',
	'reject-product',
	'listing-auto-approval-config',
	'markNotificationAsRead',
	'mark-user-violation',
	'update-report-status',
	'update-user-report-status',
	'archiveProduct'
]);

const userOwnedFields = {
	upload: 'user_id',
	editprofile: 'user_id',
	addProduct: 'uploader_id',
	updateProduct: 'uploader_id',
	deleteProduct: 'uploader_id',
	updateSaleStatus: 'uploader_id',
	submitForApproval: 'uploader_id',
	'submit-user-report': 'reporter_id',
	'submit-report': 'reporter_id',
	'send-message': 'sender_id',
	markAllUserNotificationsAsRead: 'user_id',
	'reserve-product': 'seller_id',
	'cancel-reservation': 'user_id',
	'reservation-history': 'user_id',
	'submit-rating': 'rated_by'
};

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

async function ensureDir(dirPath) {
	await fs.mkdir(dirPath, { recursive: true });
}

function nowIso() {
	return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function createSystemConversationMessage({ conversationId = null, productId = null, sellerId = null, buyerId = null, senderId = null, messageText = '', connection = null }) {
	let rows = [];
	const executor = connection ? (sql, params = []) => txQuery(connection, sql, params) : (sql, params = []) => query(sql, params);
	const effectiveSenderId = Number(senderId || sellerId || buyerId || 0);

	if (conversationId) {
		rows = await executor('SELECT conversation_id FROM conversations WHERE conversation_id = ? LIMIT 1', [conversationId]);
	} else if (productId && sellerId) {
		if (buyerId) {
			rows = await executor(
				`SELECT conversation_id FROM conversations
				 WHERE product_id = ? AND seller_id = ? AND buyer_id = ?
				 ORDER BY created_at DESC LIMIT 1`,
				[productId, sellerId, buyerId]
			);
		} else {
			rows = await executor(
				`SELECT conversation_id FROM conversations
				 WHERE product_id = ? AND seller_id = ?
				 ORDER BY created_at DESC LIMIT 1`,
				[productId, sellerId]
			);
		}
	}

	const conversation = rows[0];
	if (!conversation || !messageText || !effectiveSenderId) {
		return null;
	}

	let insertResult;
	if (connection) {
		[insertResult] = await connection.execute(
			`INSERT INTO messages (conversation_id, sender_id, message_text, created_at)
			 VALUES (?, ?, ?, NOW())`,
			[conversation.conversation_id, effectiveSenderId, messageText]
		);
	} else {
		insertResult = await query(
			`INSERT INTO messages (conversation_id, sender_id, message_text, created_at)
			 VALUES (?, ?, ?, NOW())`,
			[conversation.conversation_id, effectiveSenderId, messageText]
		);
	}

	return {
		conversation_id: Number(conversation.conversation_id),
		message_id: Number(insertResult?.insertId || 0),
		message_text: messageText
	};
}

function notImplemented(res, endpoint) {
	return respond(res, sendPayload(null, 'error', `Endpoint not implemented in Node yet: ${endpoint}`, 501));
}

function normalizeRoleName(role) {
	return String(role || '').toLowerCase().replace(/_/g, ' ').trim();
}

function parseJson(value, fallback) {
	try {
		if (typeof value === 'string') return JSON.parse(value);
		if (Array.isArray(value)) return value;
		return fallback;
	} catch {
		return fallback;
	}
}

async function saveBase64File(base64, folder, prefix) {
	const match = base64.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) return null;
	const mime = match[1];
	const data = match[2];

	const extensionMap = {
		'image/jpeg': 'jpg',
		'image/png': 'png',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'video/mp4': 'mp4',
		'video/webm': 'webm',
		'video/ogg': 'ogg',
		'video/quicktime': 'mov',
		'video/x-matroska': 'mkv',
		'video/matroska': 'mkv'
	};

	const ext = extensionMap[mime] || mime.split('/')[1] || 'bin';
	const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
	const targetDir = path.join(uploadsRoot, folder);
	await ensureDir(targetDir);
	const filePath = path.join(targetDir, fileName);
	const fileBuffer = Buffer.from(data, 'base64');
	await fs.writeFile(filePath, fileBuffer);
	const cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
	return cleanFolder ? `uploads/${cleanFolder}/${fileName}` : `uploads/${fileName}`;
}

function applyAuthGuards(req, res, endpoint, action) {
	const isAdminLogin = endpoint === 'admin' && action === 'login';
	const isPublic = publicPostEndpoints.has(endpoint) || isAdminLogin;
	if (isPublic) return true;

	const token = extractBearerToken(req);
	if (!token) {
		respond(res, sendPayload(null, 'error', 'Missing JWT token', 401));
		return false;
	}

	try {
		const claims = verifyToken(token);
		req.jwt = claims;
	} catch (error) {
			// Log verification error for debugging (do not leak token in production)
			try {
				console.error('JWT verification failed:', { message: error && error.message, tokenPreview: token ? `${String(token).slice(0, 20)}...` : null });
			} catch (e) {
				console.error('JWT verification failed (unable to log token preview)');
			}
			respond(res, sendPayload(null, 'error', 'Invalid or expired JWT token', 401));
		return false;
	}

	const ownedField = userOwnedFields[endpoint];
	if (ownedField && req.body && req.body[ownedField] && req.jwt?.uid) {
		if (Number(req.body[ownedField]) !== Number(req.jwt.uid)) {
			respond(res, sendPayload(null, 'error', 'Token user does not match request owner', 403));
			return false;
		}
	}

	const role = String(req.jwt?.role || '').toLowerCase();
	const normalizedRole = role.replace(/_/g, ' ').trim();
	const isStaffToken = Boolean(req.jwt?.admin_id) || ['admin', 'moderator', 'super admin'].includes(normalizedRole);
	const isAdminEndpoint = endpoint === 'admin' && ['create', 'update', 'delete'].includes(action || '');
	const isModeratorReview = endpoint === 'moderator-application' && action === 'review';

	if (endpoint === 'moderator-application' && action === 'submit' && req.body?.user_id && req.jwt?.uid) {
		if (Number(req.body.user_id) !== Number(req.jwt.uid)) {
			respond(res, sendPayload(null, 'error', 'Token user does not match request owner', 403));
			return false;
		}
	}

	if (isAdminEndpoint || isModeratorReview || staffOnlyEndpoints.has(endpoint)) {
		if (!isStaffToken) {
			respond(res, sendPayload(null, 'error', 'Insufficient permissions for this endpoint', 403));
			return false;
		}
	}

	return true;
}

async function getUserById(id) {
	const sql = `SELECT id, full_name, email, phone, street, barangay, city, profile_image, terms_accepted,
		is_verified, account_status, violation_count, verification_token, token_expires_at, created_at, updated_at
		FROM users WHERE id = ?`;
	const rows = await query(sql, [id]);
	return rows;
}

async function getAllUsers() {
	const sql = `SELECT id, full_name, email, phone, street, barangay, city, profile_image, terms_accepted,
		is_verified, account_status, violation_count, verification_token, token_expires_at, created_at, updated_at
		FROM users ORDER BY created_at DESC`;
	return query(sql);
}

async function getProductsByUser(uploaderId) {
	const sql = `SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image,
		bb.brand_name as bicycle_brand_name, bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name, bp.category as bicycle_part_category, bp.description as bicycle_part_description
		FROM products p
		JOIN users u ON p.uploader_id = u.id
		LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
		LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
		WHERE p.uploader_id = ? AND (p.is_archived IS NULL OR p.is_archived = 0)
		ORDER BY p.created_at DESC`;
	return query(sql, [uploaderId]);
}

async function getProductById(productId) {
	const sql = `SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image,
		bb.brand_name as bicycle_brand_name, bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name, bp.category as bicycle_part_category, bp.description as bicycle_part_description
		FROM products p
		JOIN users u ON p.uploader_id = u.id
		LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
		LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
		WHERE p.product_id = ?`;
	return query(sql, [productId]);
}

async function getAllActiveProducts() {
	const sql = `SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image,
		bb.brand_name as bicycle_brand_name, bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name, bp.category as bicycle_part_category, bp.description as bicycle_part_description
		FROM products p
		JOIN users u ON p.uploader_id = u.id
		LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
		LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
		WHERE p.status = 'active' AND p.sale_status = 'available' AND p.approval_status = 'approved'
			AND (p.is_archived IS NULL OR p.is_archived = 0)
		ORDER BY p.created_at DESC`;
	return query(sql);
}

async function getAllProductsForAdmin() {
	const sql = `SELECT p.*, u.full_name as seller_name, u.email as seller_email, u.profile_image as seller_profile_image,
		bb.brand_name as bicycle_brand_name, bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name, bp.category as bicycle_part_category, bp.description as bicycle_part_description
		FROM products p
		JOIN users u ON p.uploader_id = u.id
		LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
		LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
		ORDER BY p.created_at DESC`;
	return query(sql);
}

function normalizeSpecifications(specificationsJson) {
	const specs = parseJson(specificationsJson, []);
	if (!Array.isArray(specs)) return [];
	return specs
		.filter((spec) => spec && spec.name && spec.value)
		.map((spec) => ({ spec_name: spec.name, spec_value: spec.value }));
}

async function getProductsBoughtByUser(buyerId) {
	const sql = `SELECT p.*, seller.full_name as seller_name, seller.email as seller_email,
		seller.phone as seller_phone, seller.profile_image as seller_profile_image, seller.street as seller_street,
		seller.barangay as seller_barangay, seller.city as seller_city,
		buyer.full_name as buyer_name, buyer.email as buyer_email, buyer.phone as buyer_phone,
		buyer.profile_image as buyer_profile_image, buyer.street as buyer_street, buyer.barangay as buyer_barangay,
		buyer.city as buyer_city,
		bb.brand_name as bicycle_brand_name, bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name, bp.category as bicycle_part_category, bp.description as bicycle_part_description
		FROM products p
		JOIN users seller ON p.uploader_id = seller.id
		LEFT JOIN users buyer ON buyer.id = p.buyer_id
		LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
		LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
		WHERE p.sale_status IN ('sold', 'traded') AND p.buyer_id = ?
		ORDER BY COALESCE(p.transaction_date, p.created_at) DESC`;
	return query(sql, [buyerId]);
}

async function checkUserRestriction(userId) {
	const expireSql = `UPDATE user_restrictions
		SET is_active = FALSE
		WHERE user_id = ? AND is_active = TRUE AND expires_at IS NOT NULL AND expires_at <= NOW()`;
	await query(expireSql, [userId]);

	const restrictionSql = `SELECT ur.restriction_type, ur.reason, ur.starts_at, ur.expires_at, uv.violation_code, uv.violation_count
		FROM user_restrictions ur
		JOIN user_violations uv ON ur.violation_id = uv.violation_id
		WHERE ur.user_id = ? AND ur.is_active = TRUE
			AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
		ORDER BY ur.created_at DESC LIMIT 1`;
	const rows = await query(restrictionSql, [userId]);
	if (rows.length > 0) {
		return {
			is_restricted: true,
			restriction_type: rows[0].restriction_type,
			reason: rows[0].reason,
			starts_at: rows[0].starts_at,
			expires_at: rows[0].expires_at,
			violation_code: rows[0].violation_code,
			violation_count: rows[0].violation_count
		};
	}

	const userRows = await query('SELECT account_status, violation_count FROM users WHERE id = ? LIMIT 1', [userId]);
	if (userRows[0]?.account_status === 'restricted') {
		return {
			is_restricted: true,
			restriction_type: 'temporary_restriction',
			reason: 'Your account is currently restricted from creating new listings.',
			violation_code: 'other',
			violation_count: userRows[0].violation_count || 0
		};
	}

	return { is_restricted: false };
}

function rowsPayload(rows, emptyMessage = 'No records found') {
	const list = Array.isArray(rows) ? rows : [];
	return sendPayload(list, list.length ? 'success' : 'error', list.length ? '' : emptyMessage, list.length ? 200 : 404);
}

async function tableExists(tableName) {
	const rows = await query(
		'\
		SELECT 1\n\t\tFROM information_schema.tables\n\t\tWHERE table_schema = DATABASE() AND table_name = ?\n\t\tLIMIT 1',
		[tableName]
	);
	return Array.isArray(rows) && rows.length > 0;
}

async function ensureLandingVisitCounterTable() {
	await query(`CREATE TABLE IF NOT EXISTS landing_page_visits (
		id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
		visit_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
		last_visited_at TIMESTAMP NULL DEFAULT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

	await query(`INSERT INTO landing_page_visits (id, visit_count, last_visited_at)
		VALUES (1, 0, NULL)
		ON DUPLICATE KEY UPDATE id = id`);
}

async function getLandingVisitCounter(action = 'get') {
	await ensureLandingVisitCounterTable();

	if (action === 'increment') {
		await query(`UPDATE landing_page_visits
			SET visit_count = visit_count + 1,
				last_visited_at = CURRENT_TIMESTAMP
			WHERE id = 1`);
	}

	const rows = await query('SELECT visit_count, last_visited_at FROM landing_page_visits WHERE id = 1 LIMIT 1');
	const row = rows[0] || { visit_count: 0, last_visited_at: null };

	return sendPayload({
		visit_count: Number(row.visit_count || 0),
		last_visited_at: row.last_visited_at || null
	}, 'success', 'Landing page visit counter retrieved', 200);
}

async function ensureListingAutoApprovalConfigTable() {
	await query(`CREATE TABLE IF NOT EXISTS listing_auto_approval_config (
		config_id INT PRIMARY KEY DEFAULT 1,
		is_enabled TINYINT(1) NOT NULL DEFAULT 0,
		updated_by INT NULL,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT chk_single_config CHECK (config_id = 1)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

	await query('INSERT IGNORE INTO listing_auto_approval_config (config_id, is_enabled) VALUES (1, 0)');
}

async function getListingAutoApprovalConfig() {
	await ensureListingAutoApprovalConfigTable();
	const rows = await query('SELECT is_enabled, updated_by, updated_at FROM listing_auto_approval_config WHERE config_id = 1 LIMIT 1');
	const config = rows[0] || {};

	return sendPayload({
		enabled: Number(config.is_enabled || 0) === 1,
		updated_by: config.updated_by ? Number(config.updated_by) : null,
		updated_at: config.updated_at || null
	}, 'success', 'Listing auto-approval config fetched', 200);
}

async function isListingAutoApprovalEnabled() {
	await ensureListingAutoApprovalConfigTable();
	const rows = await query('SELECT is_enabled FROM listing_auto_approval_config WHERE config_id = 1 LIMIT 1');
	const cfg = rows[0] || {};
	return Number(cfg.is_enabled || 0) === 1;
}

async function ensureAutoApprovalAuditTable() {
	await query(`CREATE TABLE IF NOT EXISTS listing_auto_approval_audit (
		audit_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
		product_id BIGINT UNSIGNED NOT NULL,
		summary VARCHAR(255) NOT NULL,
		details JSON NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function insertAutoApprovalAudit(productId, summary, details = null) {
	await ensureAutoApprovalAuditTable();
	const detailsJson = details ? JSON.stringify(details) : null;
	await query(`INSERT INTO listing_auto_approval_audit (product_id, summary, details)
		VALUES (?, ?, ?)`, [productId, String(summary || ''), detailsJson]);
}

function serverEvaluatePendingReasons(listing) {
	// Listing is a plain object with fields similar to frontend PendingListing
	const failures = [];
	const name = String(listing.product_name || '').trim();
	const description = String(listing.description || '').trim();
	const location = String(listing.location || '').trim();
	const combinedText = (name + ' ' + description).toLowerCase();
	const images = Array.isArray(listing.product_images) ? listing.product_images : [];
	const specs = Array.isArray(listing.specifications) ? listing.specifications : [];

	const descriptionWordCount = (description.match(/[a-z0-9]+/gi) || []).length;
	// Require at least one bike-related keyword specifically in the description for auto-approval
	const bikeKeywordRegex = /\b(?:bike|bicycle|cycle|cycles|bikes|mtb|mountain\s?bike|mountainbike|mountain|road\b|roadbike|gravel|hybrid|bmx|wheel|wheelset|rim|tyre|tire|tube|tubes|tubeless|frame|frameset|groupset|drivetrain|derailleur|cassette|chainring|chain|crank|brake|brakes|fork|suspension|handlebar|stem|saddle|seatpost|pedal|pedals|shifter|gear|shimano|sram|campagnolo|trek|giant|specialized|cannondale)\b/i;
	const technicalDetailRegex = /\b(?:\d{1,4}\s?(?:mm|cm|in|inch|"|')|\d+\s?(?:speed|spd|s)\b|\d+x\d+|\b(?:11|12|10|9|8)(?:-|\s)?speed\b|xx1|x01|deore|slx|xt|xtr|tiagra|105|ultegra|dura-ace|nx|gx|axs|cassette|chainring|chainset|clinch|tubeless|tubular|clincher)\b/i;

	const autoRejectPatterns = [
		{ regex: /\b(?:fake|counterfeit|replica|class a|clone)\b/i, reason: 'counterfeit or replica terms detected' },
		{ regex: /\b(?:stolen|smuggled|illegal|prohibited|drugs?|weapon|gun)\b/i, reason: 'illegal or prohibited terms detected' },
		{ regex: /(?:https?:\/\/|www\.|t\.me\/|telegram|whatsapp|viber|@gmail\.com|@yahoo\.com|09\d{9})/i, reason: 'off-platform contact details detected' },
		{ regex: /\b(?:nude|porn|sex|adult)\b/i, reason: 'inappropriate terms detected' }
	];

	for (const pattern of autoRejectPatterns) {
		if (pattern.regex.test(combinedText)) failures.push(pattern.reason);
	}

	if (name === '' || name.length < 4) failures.push('Product name is too short');
	if (name.length > 120) failures.push('Product name exceeds 120 characters');
	if (!/[a-z]/i.test(name)) failures.push('Product name must contain readable letters');
	if (description === '' || description.length < 20) failures.push('Description must be at least 20 characters');
	if (description.length > 2000) failures.push('Description must be 2000 characters or less');
	if (descriptionWordCount < 3) failures.push('Description must include at least 3 words');
	if (/\b([a-z]{2,})\b(?:\s+\1){1,}/i.test(description)) failures.push('Description appears repetitive or spam-like');

	const bikeCategories = ['whole bike','frame','wheelset','groupset','drivetrain','brakes'];
	const isCategoryBike = bikeCategories.includes(((listing.category || '') + '').toLowerCase());
	const hasBikeTaxonomy = Boolean(listing.bicycle_brand_id || listing.bicycle_part_id);
	// Enforce bike keyword in DESCRIPTION (not just name) when category/taxonomy don't indicate a bike
	if (!isCategoryBike && !hasBikeTaxonomy && !bikeKeywordRegex.test(description)) {
		failures.push('Description should include at least one bike-related keyword');
	}

	if (location === '') failures.push('Location is required');
	if ((listing.price || 0) <= 0) failures.push('Price must be greater than 0');
	if ((listing.price || 0) > 10000000) failures.push('Price exceeds allowed limit');
	if ((listing.quantity || 0) < 1) failures.push('Quantity must be at least 1');
	if ((listing.quantity || 0) > 999) failures.push('Quantity must be 999 or less');
	if (images.length < 1) failures.push('At least one product image is required');
	if (images.length > 10) failures.push('Maximum 10 product images allowed');
	if (!['sale', 'trade', 'both'].includes(((listing.for_type || '') + '').toLowerCase())) failures.push('Listing type must be sale, trade, or both');
	if (!['brand new', 'second hand'].includes(((listing.condition || '') + '').toLowerCase())) failures.push('Condition must be brand new or second hand');
	if (((listing.category || '') + '').trim() === '') failures.push('Category is required');

	const brandName = ((listing.brand_name || '') + '').trim().toLowerCase();
	const customBrand = ((listing.custom_brand || '') + '').trim();
	if (brandName === 'others' && customBrand === '') failures.push('Custom brand detail is required for Others');
	if (listing.bicycle_brand_id === null || listing.bicycle_brand_id === undefined || listing.bicycle_part_id === null || listing.bicycle_part_id === undefined) failures.push('Bicycle brand and part must be selected');

	const hasNumericIndicator = /\d/.test(description);
	if ((specs.length || 0) < 1 && !technicalDetailRegex.test(description) && !hasNumericIndicator) {
		failures.push('Provide at least one specification or technical detail');
	}

	return failures;
}

async function updateListingAutoApprovalConfig(data) {
	const enabled = Number(Boolean(data?.enabled));
	const adminId = Number(data?.admin_id || 0);
	const adminRole = normalizeRoleName(data?.admin_role);

	if (!adminId || !adminRole) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (!['super admin', 'moderator', 'admin'].includes(adminRole)) {
		return sendPayload(null, 'error', 'Unauthorized access', 403);
	}

	await ensureListingAutoApprovalConfigTable();
	await query(`UPDATE listing_auto_approval_config
		SET is_enabled = ?,
			updated_by = ?,
			updated_at = NOW()
		WHERE config_id = 1`, [enabled, adminId]);

	return sendPayload({
		enabled: enabled === 1,
		updated_by: adminId
	}, 'success', 'Listing auto-approval configuration updated', 200);
}

async function getUserViolationDetails(userId) {
	const userRows = await query(
		`SELECT id, full_name, email, account_status, violation_count
		FROM users WHERE id = ? LIMIT 1`,
		[userId]
	);
	const user = userRows[0];

	if (!user) {
		return sendPayload(null, 'error', 'User not found', 404);
	}

	const reports = await query(
		`SELECT r.report_id, r.status, r.created_at, r.reason_details,
			COALESCE(r.user_reason_type, r.product_reason_type, 'others') AS reason_type,
			reporter.full_name AS reporter_name
		FROM reports r
		LEFT JOIN users reporter ON r.reporter_id = reporter.id
		WHERE r.reported_user_id = ?
		ORDER BY r.created_at DESC`,
		[userId]
	);

	const formattedReports = reports.map((report) => {
		const reasonType = report.reason_type || 'others';
		return {
			source: 'report',
			id: Number(report.report_id),
			title: 'User Report Submitted',
			reason: report.reason_details || String(reasonType).replace(/_/g, ' '),
			reason_type: reasonType,
			status: report.status || 'pending',
			reporter_name: report.reporter_name || 'Unknown reporter',
			created_at: report.created_at
		};
	});

	const notifications = await query(
		`SELECT notification_id, title, message, created_at
		FROM user_notifications
		WHERE user_id = ? AND type = 'violation'
		ORDER BY created_at DESC`,
		[userId]
	);

	const formattedViolations = notifications.map((notification) => {
		let reason = 'No specific reason provided';
		const message = String(notification.message || '');
		const match = message.match(/Reason:\s*(.+?)(?:\n|$)/i);
		if (match?.[1]) reason = match[1].trim();

		return {
			source: 'admin_violation',
			id: Number(notification.notification_id),
			title: notification.title || 'Account Violation Notice',
			reason,
			status: user.account_status || 'active',
			created_at: notification.created_at
		};
	});

	const timeline = [...formattedReports, ...formattedViolations].sort((a, b) => {
		return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
	});

	return sendPayload({
		user: {
			id: Number(user.id),
			full_name: user.full_name,
			email: user.email,
			account_status: user.account_status || 'active',
			violation_count: Number(user.violation_count || 0)
		},
		timeline,
		reports: formattedReports,
		violations: formattedViolations
	}, 'success', 'User violation details retrieved successfully', 200);
}

async function getAdminNotifications(adminId, limit = 50) {
	return query(
		`SELECT n.notification_id,
			n.type,
			n.title,
			n.message,
			n.reference_id,
			n.created_at,
			n.created_by,
			u.full_name as created_by_name,
			an.is_read,
			an.read_at
		FROM notifications n
		INNER JOIN admin_notifications an ON n.notification_id = an.notification_id
		LEFT JOIN users u ON n.created_by = u.id
		WHERE an.admin_id = ?
		ORDER BY n.created_at DESC
		LIMIT ?`,
		[adminId, Number(limit)]
	);
}

async function getNotificationCountsForAdmin(adminId) {
	const rows = await query(
		`SELECT COUNT(*) as total_notifications,
			SUM(CASE WHEN an.is_read = 0 THEN 1 ELSE 0 END) as unread_notifications
		FROM notifications n
		INNER JOIN admin_notifications an ON n.notification_id = an.notification_id
		WHERE an.admin_id = ?`,
		[adminId]
	);

	const row = rows[0] || {};
	return {
		total_notifications: Number(row.total_notifications || 0),
		unread_notifications: Number(row.unread_notifications || 0)
	};
}

async function getDashboardStats() {
	const [userCountRows, productCountRows, reportCountRows] = await Promise.all([
		query('SELECT COUNT(*) as count FROM users'),
		query('SELECT COUNT(*) as count FROM products'),
		query('SELECT COUNT(*) as count FROM reports')
	]);

	let userReportCount = 0;
	if (await tableExists('user_reports')) {
		const userReportRows = await query('SELECT COUNT(*) as count FROM user_reports');
		userReportCount = Number(userReportRows[0]?.count || 0);
	}

	const [newUsersWeekRows, newUsersDayRows, activeListingsRows, newListingsWeekRows, newListingsDayRows, pendingProductsRows, pendingReportsRows] = await Promise.all([
		query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
		query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
		query("SELECT COUNT(*) as count FROM products WHERE status = 'active'"),
		query('SELECT COUNT(*) as count FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'),
		query('SELECT COUNT(*) as count FROM products WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'),
		query("SELECT COUNT(*) as count FROM products WHERE status = 'pending'"),
		query("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'")
	]);

	let pendingUserReports = 0;
	if (await tableExists('user_reports')) {
		const pendingUserReportsRows = await query("SELECT COUNT(*) as count FROM user_reports WHERE status = 'pending'");
		pendingUserReports = Number(pendingUserReportsRows[0]?.count || 0);
	}

	const productReports = Number(reportCountRows[0]?.count || 0);
	const totalReportsAll = productReports + userReportCount;

	return {
		total_users: Number(userCountRows[0]?.count || 0),
		new_users_week: Number(newUsersWeekRows[0]?.count || 0),
		new_users_day: Number(newUsersDayRows[0]?.count || 0),
		total_products: Number(productCountRows[0]?.count || 0),
		active_listings: Number(activeListingsRows[0]?.count || 0),
		new_listings_week: Number(newListingsWeekRows[0]?.count || 0),
		new_listings_day: Number(newListingsDayRows[0]?.count || 0),
		pending_products: Number(pendingProductsRows[0]?.count || 0),
		total_reports: totalReportsAll,
		product_reports: productReports,
		user_reports: userReportCount,
		pending_reports: Number(pendingReportsRows[0]?.count || 0) + pendingUserReports
	};
}

async function getChartData() {
	const monthlyGrowth = await query(`SELECT DATE_FORMAT(month_series.month, '%Y-%m') as month,
		COALESCE(users.count, 0) as users,
		COALESCE(products.count, 0) as products
	FROM (
		SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL seq MONTH), '%Y-%m-01') as month
		FROM (
			SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION
			SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION
			SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
		) as months
		WHERE DATE_SUB(CURDATE(), INTERVAL seq MONTH) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
	) as month_series
	LEFT JOIN (
		SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
		FROM users
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
		GROUP BY DATE_FORMAT(created_at, '%Y-%m')
	) as users ON DATE_FORMAT(month_series.month, '%Y-%m') = users.month
	LEFT JOIN (
		SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
		FROM products
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
		GROUP BY DATE_FORMAT(created_at, '%Y-%m')
	) as products ON DATE_FORMAT(month_series.month, '%Y-%m') = products.month
	ORDER BY month_series.month`);

	const [categories, reports, sellers, reportedAccounts] = await Promise.all([
		query(`SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count
			FROM products GROUP BY category ORDER BY count DESC`),
		query(`SELECT COALESCE(product_reason_type, user_reason_type, 'other') as reason_type, COUNT(*) as count
			FROM reports GROUP BY COALESCE(product_reason_type, user_reason_type, 'other') ORDER BY count DESC`),
		query(`SELECT u.full_name as seller_name,
			u.id as seller_id,
			ROUND(AVG((r.communication_rating + r.product_rating + r.app_help_rating) / 3), 1) as average_rating,
			COUNT(r.rating_id) as total_ratings
		FROM users u
		INNER JOIN ratings r ON u.id = r.rated_user_id
		GROUP BY u.id, u.full_name
		HAVING COUNT(r.rating_id) >= 1
		ORDER BY average_rating DESC, total_ratings DESC
		LIMIT 5`),
		query(`SELECT u.id as user_id,
			u.full_name,
			u.email,
			u.account_status,
			COUNT(r.report_id) as report_count,
			u.violation_count
		FROM users u
		INNER JOIN reports r ON u.id = r.reported_user_id
		WHERE r.reported_user_id IS NOT NULL
		GROUP BY u.id, u.full_name, u.email, u.account_status, u.violation_count
		ORDER BY report_count DESC, u.violation_count DESC
		LIMIT 10`)
	]);

	return {
		monthly_growth: monthlyGrowth,
		product_categories: categories,
		reports_by_reason: reports,
		top_sellers: sellers,
		most_reported_accounts: reportedAccounts
	};
}

async function getAllAdmins() {
	return query(`SELECT admin_id, username, email, full_name, role, status, created_at, updated_at
		FROM admins
		ORDER BY created_at DESC`);
}

async function getAdminById(adminId) {
	return query(`SELECT admin_id, username, email, full_name, role, status, created_at, updated_at
		FROM admins
		WHERE admin_id = ?`, [adminId]);
}

async function getAllModeratorApplications(status = null) {
	let sql = `SELECT ma.application_id,
		ma.user_id,
		ma.full_name,
		ma.reason,
		ma.experience,
		ma.status,
		ma.created_at,
		ma.updated_at,
		ma.reviewed_at,
		ma.reviewed_by,
		ma.admin_account_id,
		u.email,
		u.profile_image,
		a.username as reviewer_username
	FROM moderator_applications ma
	LEFT JOIN users u ON ma.user_id = u.id
	LEFT JOIN admins a ON ma.reviewed_by = a.admin_id`;

	const params = [];
	if (status) {
		sql += ' WHERE ma.status = ?';
		params.push(status);
	}

	sql += ` ORDER BY
		CASE ma.status
			WHEN 'pending' THEN 1
			WHEN 'approved' THEN 2
			WHEN 'rejected' THEN 3
			ELSE 4
		END,
		ma.created_at DESC`;

	return query(sql, params);
}

async function getUserModeratorApplication(userId) {
	return query(`SELECT ma.application_id,
		ma.user_id,
		ma.full_name,
		ma.reason,
		ma.experience,
		ma.status,
		ma.created_at,
		ma.updated_at,
		ma.reviewed_at,
		ma.reviewed_by,
		ma.admin_account_id,
		a.username as reviewer_username
	FROM moderator_applications ma
	LEFT JOIN admins a ON ma.reviewed_by = a.admin_id
	WHERE ma.user_id = ?
	ORDER BY ma.created_at DESC
	LIMIT 1`, [userId]);
}

async function getModeratorApplicationById(applicationId) {
	return query(`SELECT ma.application_id,
		ma.user_id,
		ma.full_name,
		ma.reason,
		ma.experience,
		ma.status,
		ma.created_at,
		ma.updated_at,
		ma.reviewed_at,
		ma.reviewed_by,
		ma.admin_account_id,
		u.email,
		u.profile_image,
		u.role as current_role,
		a.username as reviewer_username
	FROM moderator_applications ma
	LEFT JOIN users u ON ma.user_id = u.id
	LEFT JOIN admins a ON ma.reviewed_by = a.admin_id
	WHERE ma.application_id = ?`, [applicationId]);
}

async function getPendingModeratorApplicationsCount() {
	const rows = await query(`SELECT COUNT(*) as count
		FROM moderator_applications
		WHERE status = 'pending'`);
	return Number(rows[0]?.count || 0);
}

async function getUserConversations(userId) {
	return query(`SELECT c.conversation_id, c.product_id, c.buyer_id, c.seller_id, c.created_at,
		p.product_name, p.product_images, p.price,
		CASE WHEN c.buyer_id = ? THEN seller.full_name ELSE buyer.full_name END as other_user_name,
		CASE WHEN c.buyer_id = ? THEN seller.profile_image ELSE buyer.profile_image END as other_user_avatar,
		CASE WHEN c.buyer_id = ? THEN c.seller_id ELSE c.buyer_id END as other_user_id,
		(SELECT message_text FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
		(SELECT created_at FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
		(SELECT COUNT(*) FROM messages WHERE conversation_id = c.conversation_id AND sender_id != ? AND is_read = 0) as unread_count
	FROM conversations c
	LEFT JOIN products p ON c.product_id = p.product_id
	LEFT JOIN users buyer ON c.buyer_id = buyer.id
	LEFT JOIN users seller ON c.seller_id = seller.id
	WHERE (c.buyer_id = ? OR c.seller_id = ?)
		AND ((c.buyer_id = ? AND c.buyer_archived = 0 AND c.buyer_deleted = 0)
			OR (c.seller_id = ? AND c.seller_archived = 0 AND c.seller_deleted = 0))
	ORDER BY last_message_time DESC`, [userId, userId, userId, userId, userId, userId, userId, userId]);
}

async function getUserArchivedConversations(userId) {
	return query(`SELECT c.conversation_id, c.product_id, c.buyer_id, c.seller_id, c.created_at,
		p.product_name, p.product_images, p.price,
		CASE WHEN c.buyer_id = ? THEN seller.full_name ELSE buyer.full_name END as other_user_name,
		CASE WHEN c.buyer_id = ? THEN seller.profile_image ELSE buyer.profile_image END as other_user_avatar,
		CASE WHEN c.buyer_id = ? THEN c.seller_id ELSE c.buyer_id END as other_user_id,
		(SELECT message_text FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
		(SELECT created_at FROM messages WHERE conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message_time,
		(SELECT COUNT(*) FROM messages WHERE conversation_id = c.conversation_id AND sender_id != ? AND is_read = 0) as unread_count
	FROM conversations c
	LEFT JOIN products p ON c.product_id = p.product_id
	LEFT JOIN users buyer ON c.buyer_id = buyer.id
	LEFT JOIN users seller ON c.seller_id = seller.id
	WHERE (c.buyer_id = ? OR c.seller_id = ?)
		AND ((c.buyer_id = ? AND c.buyer_archived = 1 AND c.buyer_deleted = 0)
			OR (c.seller_id = ? AND c.seller_archived = 1 AND c.seller_deleted = 0))
	ORDER BY last_message_time DESC`, [userId, userId, userId, userId, userId, userId, userId, userId]);
}

async function getConversationMessages(conversationId) {
	const rows = await query(`SELECT m.message_id, m.conversation_id, m.sender_id, m.message_text, m.attachments, m.is_read, m.created_at,
		CASE WHEN m.sender_id = 0 THEN 'System' ELSE u.full_name END as sender_name,
		CASE WHEN m.sender_id = 0 THEN '' ELSE u.profile_image END as sender_avatar
	FROM messages m
	LEFT JOIN users u ON m.sender_id = u.id AND m.sender_id != 0
	WHERE m.conversation_id = ?
	ORDER BY m.created_at ASC`, [conversationId]);

	return rows.map((message) => {
		let attachments = [];
		if (message.attachments) {
			const parsed = parseJson(message.attachments, []);
			attachments = Array.isArray(parsed) ? parsed.map((attachment) => {
				if (attachment?.path) {
					return {
						...attachment,
						url: `${getPublicBaseUrl()}/${String(attachment.path).replace(/^\/+/, '')}`
					};
				}
				return attachment;
			}) : [];
		}

		const isSystemMessage = Number(message.sender_id) === 0;
		let systemType = null;
		if (isSystemMessage) {
			const text = String(message.message_text || '').toLowerCase();
			systemType = text.includes('traded') ? 'traded' : 'sold';
		}

		return {
			...message,
			attachments,
			is_system_message: isSystemMessage,
			system_message_type: systemType
		};
	});
}

async function getUserReportsByReporter(userId) {
	return query(`SELECT r.*,
		reporter.full_name as reporter_name,
		reporter.email as reporter_email,
		reporter.profile_image as reporter_profile_image,
		COALESCE(reported_user.full_name, product_owner.full_name) as reported_user_name,
		COALESCE(reported_user.email, product_owner.email) as reported_user_email,
		COALESCE(reported_user.profile_image, product_owner.profile_image) as reported_user_profile_image,
		p.product_name,
		p.price as product_price,
		p.product_images,
		p.description as product_description,
		reviewer.username as reviewed_by_name
	FROM reports r
	LEFT JOIN users reporter ON r.reporter_id = reporter.id
	LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
	LEFT JOIN products p ON r.product_id = p.product_id
	LEFT JOIN users product_owner ON p.uploader_id = product_owner.id
	LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
	WHERE r.reporter_id = ?
	ORDER BY r.created_at DESC`, [userId]);
}

async function getAllReports() {
	const rows = await query(`SELECT r.report_id,
		r.reporter_id,
		r.reported_user_id,
		r.product_id,
		r.conversation_id,
		r.report_type,
		r.product_reason_type,
		r.user_reason_type,
		r.reason_details,
		r.explanation,
		r.message_reference,
		r.proof,
		r.status,
		r.created_at,
		r.reviewed_by,
		r.reviewed_at,
		reporter.full_name as reporter_name,
		reporter.email as reporter_email,
		reporter.profile_image as reporter_profile_image,
		reported_user.full_name as reported_user_name,
		reported_user.email as reported_user_email,
		p.product_name,
		p.price as product_price,
		p.product_images,
		p.description as product_description,
		reviewer.username as reviewed_by_name
	FROM reports r
	LEFT JOIN users reporter ON r.reporter_id = reporter.id
	LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
	LEFT JOIN products p ON r.product_id = p.product_id
	LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
	ORDER BY r.created_at DESC`);

	return rows.map((report) => {
		if (report.product_images && typeof report.product_images === 'string') {
			report.product_images = parseJson(report.product_images, report.product_images);
		}
		return report;
	});
}

async function getAllUserReports() {
	return query(`SELECT r.*,
		reporter.full_name as reporter_name,
		reporter.email as reporter_email,
		reporter.profile_image as reporter_profile_image,
		COALESCE(reported_user.full_name, product_owner.full_name) as reported_user_name,
		COALESCE(reported_user.email, product_owner.email) as reported_user_email,
		COALESCE(reported_user.profile_image, product_owner.profile_image) as reported_user_profile_image,
		p.product_name,
		p.price as product_price,
		p.product_images,
		p.description as product_description,
		reviewer.username as reviewed_by_name
	FROM reports r
	LEFT JOIN users reporter ON r.reporter_id = reporter.id
	LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
	LEFT JOIN products p ON r.product_id = p.product_id
	LEFT JOIN users product_owner ON p.uploader_id = product_owner.id
	LEFT JOIN admins reviewer ON r.reviewed_by = reviewer.admin_id
	ORDER BY r.created_at DESC`);
}

async function getUserRatings(userId) {
	return query(`SELECT r.*,
		rater.full_name as buyer_name,
		rater.profile_image as buyer_profile_image,
		p.product_name,
		p.product_images,
		p.price as product_price,
		p.description as product_description,
		c.conversation_id
	FROM ratings r
	LEFT JOIN users rater ON r.rated_by = rater.id
	LEFT JOIN products p ON r.product_id = p.product_id
	LEFT JOIN conversations c ON r.conversation_id = c.conversation_id
	WHERE r.rated_user_id = ?
	ORDER BY r.created_at DESC`, [userId]);
}

async function getConversationRating(conversationId, ratedBy) {
	return query(`SELECT r.*,
		rated_user.full_name as rated_user_name,
		rater.full_name as rater_name
	FROM ratings r
	LEFT JOIN users rated_user ON r.rated_user_id = rated_user.id
	LEFT JOIN users rater ON r.rated_by = rater.id
	WHERE r.conversation_id = ? AND r.rated_by = ?`, [conversationId, ratedBy]);
}

async function getUserAverageRatings(userId) {
	return query(`SELECT AVG(communication_rating) as avg_communication,
		AVG(product_rating) as avg_product,
		AVG(app_help_rating) as avg_app_help,
		ROUND((AVG(communication_rating) + AVG(product_rating) + AVG(app_help_rating)) / 3, 1) as average_stars,
		COUNT(*) as total_ratings
	FROM ratings
	WHERE rated_user_id = ?`, [userId]);
}

async function getAllSellersWithRatings() {
	return query(`SELECT u.id as seller_id,
		u.full_name as seller_name,
		u.profile_image,
		ROUND((AVG(r.communication_rating) + AVG(r.product_rating) + AVG(r.app_help_rating)) / 3, 1) as average_stars,
		COUNT(r.rating_id) as total_ratings,
		AVG(r.communication_rating) as avg_communication,
		AVG(r.product_rating) as avg_product,
		AVG(r.app_help_rating) as avg_app_help
	FROM users u
	LEFT JOIN ratings r ON u.id = r.rated_user_id
	GROUP BY u.id, u.full_name, u.profile_image
	HAVING COUNT(r.rating_id) > 0
	ORDER BY average_stars DESC`);
}

async function getProductSpecificationsByProductId(productId) {
	const rows = await query('SELECT specifications FROM products WHERE product_id = ? LIMIT 1', [productId]);
	if (!rows.length) return [];
	return normalizeSpecifications(rows[0].specifications);
}

async function getProductBuyer(productId) {
	const productRows = await query(
		`SELECT product_id, sale_status, uploader_id, buyer_id, sale_conversation_id, transaction_date
		FROM products
		WHERE product_id = ? AND sale_status IN ('sold', 'traded')
		LIMIT 1`,
		[productId]
	);
	const product = productRows[0];
	if (!product) return null;

	if (product.buyer_id) {
		const directRows = await query(
			`SELECT u.id as buyer_user_id,
				u.full_name as buyer_name,
				u.email as buyer_email,
				u.phone as buyer_phone,
				u.profile_image as buyer_profile_image,
				u.street as buyer_street,
				u.barangay as buyer_barangay,
				u.city as buyer_city,
				p.product_id,
				p.product_name,
				p.price,
				p.sale_status,
				p.transaction_date
			FROM users u
			CROSS JOIN products p
			WHERE u.id = ? AND p.product_id = ?
			LIMIT 1`,
			[product.buyer_id, productId]
		);
		return directRows[0] || null;
	}

	const fallbackRows = await query(
		`SELECT c.conversation_id,
			c.buyer_id,
			c.seller_id,
			u.id as buyer_user_id,
			u.full_name as buyer_name,
			u.email as buyer_email,
			u.phone as buyer_phone,
			u.profile_image as buyer_profile_image,
			u.street as buyer_street,
			u.barangay as buyer_barangay,
			u.city as buyer_city,
			p.product_id,
			p.product_name,
			p.price,
			p.sale_status,
			p.transaction_date
		FROM conversations c
		INNER JOIN users u ON c.buyer_id = u.id
		INNER JOIN products p ON c.product_id = p.product_id
		WHERE c.product_id = ? AND c.seller_id = ?
		ORDER BY c.created_at DESC
		LIMIT 1`,
		[productId, product.uploader_id]
	);

	return fallbackRows[0] || null;
}

async function getUserNotifications(userId) {
	return query(`SELECT un.*, p.product_name, p.archive_reason
		FROM user_notifications un
		LEFT JOIN products p ON un.reference_id = p.product_id AND un.type = 'product_archived'
		WHERE un.user_id = ?
		ORDER BY un.created_at DESC`, [userId]);
}

async function getUnreadCounts(userId) {
	const [messageRows, notificationRows] = await Promise.all([
		query(`SELECT COUNT(*) as count
			FROM messages m
			INNER JOIN conversations c ON m.conversation_id = c.conversation_id
			WHERE (c.buyer_id = ? OR c.seller_id = ?)
				AND m.sender_id != ?
				AND m.is_read = 0`, [userId, userId, userId]),
		query('SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ? AND is_read = 0', [userId])
	]);

	return {
		unread_messages: Number(messageRows[0]?.count || 0),
		unread_notifications: Number(notificationRows[0]?.count || 0)
	};
}

async function getRecentActivities(limit = 50, startDate = null, endDate = null) {
	let safeLimit = Number(limit || 50);
	if (!Number.isFinite(safeLimit) || safeLimit < 1) safeLimit = 50;

	const defaultEnd = new Date();
	const defaultStart = new Date();
	defaultStart.setDate(defaultStart.getDate() - 29);

	const rangeStart = startDate || defaultStart.toISOString().slice(0, 10);
	const rangeEnd = endDate || defaultEnd.toISOString().slice(0, 10);

	const datePattern = /^\d{4}-\d{2}-\d{2}$/;
	if (!datePattern.test(rangeStart) || !datePattern.test(rangeEnd)) {
		return { error: sendPayload([], 'error', 'Invalid date format. Use YYYY-MM-DD for start_date and end_date.', 400) };
	}

	if (rangeStart > rangeEnd) {
		return { error: sendPayload([], 'error', 'start_date must be before or equal to end_date.', 400) };
	}

	const hasUserReports = await tableExists('user_reports');

	let sql;
	let params;

	if (hasUserReports) {
		sql = `(
			SELECT 'new_user' as activity_type,
				u.id as reference_id,
				u.full_name as user_name,
				NULL as product_name,
				NULL as report_type,
				u.created_at as activity_time,
				CONCAT('New user registered: ', u.full_name) as activity_message
			FROM users u
			WHERE u.created_at >= ? AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		UNION ALL
		(
			SELECT 'new_listing' as activity_type,
				p.product_id as reference_id,
				u.full_name as user_name,
				p.product_name as product_name,
				NULL as report_type,
				p.created_at as activity_time,
				CONCAT('New listing posted: ', p.product_name) as activity_message
			FROM products p
			INNER JOIN users u ON p.uploader_id = u.id
			WHERE p.created_at >= ? AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		UNION ALL
		(
			SELECT 'new_report' as activity_type,
				r.report_id as reference_id,
				u.full_name as user_name,
				p.product_name as product_name,
				COALESCE(r.product_reason_type, r.user_reason_type, 'other') as report_type,
				r.created_at as activity_time,
				CONCAT(r.report_type, ' report submitted') as activity_message
			FROM reports r
			INNER JOIN users u ON r.reporter_id = u.id
			LEFT JOIN products p ON r.product_id = p.product_id
			WHERE r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		UNION ALL
		(
			SELECT 'new_user_report' as activity_type,
				ur.report_id as reference_id,
				u.full_name as user_name,
				NULL as product_name,
				ur.reason_type as report_type,
				ur.created_at as activity_time,
				CONCAT('User report submitted: ', ur.reason_type) as activity_message
			FROM user_reports ur
			INNER JOIN users u ON ur.reported_by = u.id
			WHERE ur.created_at >= ? AND ur.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		ORDER BY activity_time DESC
		LIMIT ${safeLimit}`;

		params = [rangeStart, rangeEnd, rangeStart, rangeEnd, rangeStart, rangeEnd, rangeStart, rangeEnd];
	} else {
		sql = `(
			SELECT 'new_user' as activity_type,
				u.id as reference_id,
				u.full_name as user_name,
				NULL as product_name,
				NULL as report_type,
				u.created_at as activity_time,
				CONCAT('New user registered: ', u.full_name) as activity_message
			FROM users u
			WHERE u.created_at >= ? AND u.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		UNION ALL
		(
			SELECT 'new_listing' as activity_type,
				p.product_id as reference_id,
				u.full_name as user_name,
				p.product_name as product_name,
				NULL as report_type,
				p.created_at as activity_time,
				CONCAT('New listing posted: ', p.product_name) as activity_message
			FROM products p
			INNER JOIN users u ON p.uploader_id = u.id
			WHERE p.created_at >= ? AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		UNION ALL
		(
			SELECT 'new_report' as activity_type,
				r.report_id as reference_id,
				u.full_name as user_name,
				p.product_name as product_name,
				COALESCE(r.product_reason_type, r.user_reason_type, 'other') as report_type,
				r.created_at as activity_time,
				CONCAT(r.report_type, ' report submitted') as activity_message
			FROM reports r
			INNER JOIN users u ON r.reporter_id = u.id
			LEFT JOIN products p ON r.product_id = p.product_id
			WHERE r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)
		)
		ORDER BY activity_time DESC
		LIMIT ${safeLimit}`;

		params = [rangeStart, rangeEnd, rangeStart, rangeEnd, rangeStart, rangeEnd];
	}

	const activities = await query(sql, params);
	return {
		data: activities,
		meta: {
			start_date: rangeStart,
			end_date: rangeEnd,
			limit: safeLimit
		}
	};
}

async function getPendingProducts() {
	const rows = await query(`SELECT p.product_id, p.product_name, p.brand_name, p.custom_brand,
		p.product_images, p.product_videos,
		p.price, p.description, p.location, p.for_type, p.condition,
		p.category, p.quantity, p.specifications, p.created_at, p.approval_status,
		p.bicycle_brand_id, p.bicycle_part_id,
		bb.brand_name as bicycle_brand_name,
		bb.description as bicycle_brand_description,
		bp.part_name as bicycle_part_name,
		bp.category as bicycle_part_category,
		bp.description as bicycle_part_description,
		u.full_name as seller_name,
		u.email as seller_email,
		u.profile_image as seller_profile_image
	FROM products p
	JOIN users u ON p.uploader_id = u.id
	LEFT JOIN bicycle_brands bb ON p.bicycle_brand_id = bb.brand_id
	LEFT JOIN bicycle_parts bp ON p.bicycle_part_id = bp.part_id
	WHERE p.approval_status = 'pending'
	ORDER BY p.created_at ASC`);

	return rows.map((product) => ({
		...product,
		specifications: normalizeSpecifications(product.specifications),
		product_videos: product.product_videos ?? '[]'
	}));
}

async function getBicycleBrands() {
	return query(`SELECT brand_id, brand_name, description, logo_url
		FROM bicycle_brands
		WHERE is_active = TRUE
		ORDER BY brand_name`);
}

async function getBicyclePartsByBrand(brandId = null) {
	if (!brandId) {
		return query(`SELECT part_id, part_name, category, description
			FROM bicycle_parts
			WHERE brand_id IS NULL AND is_active = TRUE
			ORDER BY category, part_name`);
	}

	const isSpecialBrand = Number(brandId) === 16 || Number(brandId) === 24 ? 1 : 0;

	return query(`SELECT part_id, part_name, category, description
		FROM bicycle_parts
		WHERE is_active = TRUE
			AND (
				brand_id = ?
				OR (brand_id IS NULL AND LOWER(category) <> 'cockpit')
				OR (
					brand_id IS NULL
					AND LOWER(category) = 'cockpit'
					AND (
						? = 1
						OR EXISTS (
							SELECT 1
							FROM bicycle_parts bp2
							WHERE bp2.brand_id = ?
								AND bp2.is_active = TRUE
								AND LOWER(bp2.category) = 'cockpit'
						)
					)
				)
			)
		ORDER BY category, part_name`, [brandId, isSpecialBrand, brandId]);
}

async function getPartSpecifications(partId) {
	const rows = await query(`SELECT spec_id, spec_name, spec_label, spec_type, spec_options,
		is_required, placeholder, display_order
	FROM part_specifications
	WHERE part_id = ? AND is_active = TRUE
	ORDER BY display_order, spec_id`, [partId]);

	if (!rows.length) return [];

	const map = new Map();
	for (const row of rows) {
		const key = String(row.spec_name || '').trim().toLowerCase();
		if (!key || map.has(key)) continue;
		map.set(key, row);
	}

	return [...map.values()].slice(0, 5);
}

async function txQuery(connection, sql, params = []) {
	const [rows] = await connection.execute(sql, params);
	return rows;
}

async function createUserNotification(userId, type, title, message, referenceId = null, connection = null) {
	const sql = `INSERT INTO user_notifications (user_id, type, title, message, reference_id, created_at)
		VALUES (?, ?, ?, ?, ?, NOW())`;

	if (connection) {
		return txQuery(connection, sql, [userId, type, title, message, referenceId]);
	}

	return query(sql, [userId, type, title, message, referenceId]);
}

async function checkExpiredReservations(connection = null) {
	const run = async (conn) => {
		const expiredProducts = await txQuery(
			conn,
			`SELECT p.product_id, p.product_name, p.uploader_id, p.reserved_by, p.reserved_until
			FROM products p
			WHERE p.sale_status = 'reserved'
				AND p.reserved_until IS NOT NULL
				AND p.reserved_until < NOW()`
		);

		const expiredCount = expiredProducts.length;
		if (!expiredCount) {
			return {
				expired_count: 0,
				message: 'No expired reservations found'
			};
		}

		for (const product of expiredProducts) {
			await txQuery(
				conn,
				`UPDATE products
				SET sale_status = 'available',
					reserved_by = NULL,
					reserved_until = NULL,
					reserved_at = NULL,
					reservation_duration_hours = NULL
				WHERE product_id = ?`,
				[product.product_id]
			);

			await txQuery(
				conn,
				`UPDATE reservation_history
				SET status = 'expired',
					expired_at = NOW()
				WHERE product_id = ?
					AND status = 'active'`,
				[product.product_id]
			);

			if (product.uploader_id) {
				await createUserNotification(
					product.uploader_id,
					'Reservation Expired',
					'Reservation Expired',
					`The reservation for '${product.product_name}' has expired. The item is now available again.`,
					product.product_id,
					conn
				);
			}

			if (product.reserved_by) {
				await createUserNotification(
					product.reserved_by,
					'Reservation Expired',
					'Reservation Expired',
					`The reservation period for '${product.product_name}' has expired and the item is now available.`,
					product.product_id,
					conn
				);
			}
		}

		return {
			expired_count: expiredCount,
			products: expiredProducts
		};
	};

	if (connection) {
		return run(connection);
	}

	return withTransaction(run);
}

async function reserveProduct(data) {
	const productId = Number(data?.product_id || 0);
	const buyerId = Number(data?.buyer_id || 0);
	const sellerId = Number(data?.seller_id || 0);
	const durationHours = Number(data?.duration_hours || 24);

	if (!productId || !buyerId || !sellerId) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (durationHours > 72) {
		return sendPayload(null, 'error', 'Maximum reservation duration is 72 hours', 400);
	}

	if (![24, 48, 72].includes(durationHours)) {
		return sendPayload(null, 'error', 'Invalid reservation duration. Allowed: 24, 48, or 72 hours', 400);
	}

	return withTransaction(async (connection) => {
		const productRows = await txQuery(
			connection,
			`SELECT product_id, product_name, uploader_id, sale_status
			FROM products
			WHERE product_id = ?
			LIMIT 1`,
			[productId]
		);
		const product = productRows[0];

		if (!product) {
			return sendPayload(null, 'error', 'Product not found', 404);
		}

		if (String(product.sale_status) !== 'available') {
			return sendPayload(null, 'error', 'Product is not available for reservation', 400);
		}

		if (Number(product.uploader_id) !== sellerId) {
			return sendPayload(null, 'error', 'Only the seller can reserve this product', 403);
		}

		const reservedAt = nowIso();
		const reservedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

		await txQuery(
			connection,
			`UPDATE products
			SET sale_status = 'reserved',
				reserved_by = ?,
				reserved_until = ?,
				reserved_at = ?,
				reservation_duration_hours = ?
			WHERE product_id = ?`,
			[buyerId, reservedUntil, reservedAt, durationHours, productId]
		);

		await txQuery(
			connection,
			`INSERT INTO reservation_history
			(product_id, reserved_by, seller_id, reserved_at, reserved_until, duration_hours, status)
			VALUES (?, ?, ?, ?, ?, ?, 'active')`,
			[productId, buyerId, sellerId, reservedAt, reservedUntil, durationHours]
		);

		await createUserNotification(
			buyerId,
			'Product Reserved',
			'Reservation Confirmed',
			`Your reservation for '${product.product_name}' has been confirmed for ${durationHours} hours.`,
			productId,
			connection
		);

		await createUserNotification(
			sellerId,
			'Product Reserved',
			'Product Reserved',
			`'${product.product_name}' has been reserved for ${durationHours} hours.`,
			productId,
			connection
		);

		await createSystemConversationMessage({
			productId,
			sellerId,
			buyerId,
			senderId: sellerId,
			messageText: `'${product.product_name}' has been reserved for ${durationHours} hours.`,
			connection
		});

		return sendPayload({
			product_id: productId,
			reserved_by: buyerId,
			reserved_until: reservedUntil,
			duration_hours: durationHours
		}, 'success', 'Product reserved successfully', 200);
	});
}

async function cancelReservation(data) {
	const productId = Number(data?.product_id || 0);
	const userId = Number(data?.user_id || 0);
	const cancellationReason = String(data?.reason || 'User cancelled');

	if (!productId || !userId) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	return withTransaction(async (connection) => {
		const productRows = await txQuery(
			connection,
			`SELECT product_id, product_name, uploader_id, sale_status, reserved_by
			FROM products
			WHERE product_id = ?
			LIMIT 1`,
			[productId]
		);
		const product = productRows[0];

		if (!product) {
			return sendPayload(null, 'error', 'Product not found', 404);
		}

		if (String(product.sale_status) !== 'reserved') {
			return sendPayload(null, 'error', 'Product is not reserved', 400);
		}

		if (Number(product.uploader_id) !== userId && Number(product.reserved_by) !== userId) {
			return sendPayload(null, 'error', "You don't have permission to cancel this reservation", 403);
		}

		await txQuery(
			connection,
			`UPDATE products
			SET sale_status = 'available',
				reserved_by = NULL,
				reserved_until = NULL,
				reserved_at = NULL,
				reservation_duration_hours = NULL
			WHERE product_id = ?`,
			[productId]
		);

		await txQuery(
			connection,
			`UPDATE reservation_history
			SET status = 'cancelled',
				cancelled_at = NOW(),
				cancellation_reason = ?
			WHERE product_id = ? AND status = 'active'`,
			[cancellationReason, productId]
		);

		const sellerId = Number(product.uploader_id || 0);
		const buyerId = Number(product.reserved_by || 0);

		if (buyerId) {
			await createUserNotification(
				buyerId,
				'Reservation Cancelled',
				'Reservation Cancelled',
				`The reservation for '${product.product_name}' has been cancelled.`,
				productId,
				connection
			);
		}

		if (sellerId && sellerId !== userId) {
			await createUserNotification(
				sellerId,
				'Reservation Cancelled',
				'Reservation Cancelled',
				`The reservation for '${product.product_name}' has been cancelled.`,
				productId,
				connection
			);
		}

		return sendPayload({
			product_id: productId,
			status: 'available'
		}, 'success', 'Reservation cancelled successfully', 200);
	});
}

async function getReservationDetails(data) {
	const productId = Number(data?.product_id || 0);
	if (!productId) {
		return sendPayload(null, 'error', 'Product ID required', 400);
	}

	const rows = await query(
		`SELECT p.product_id, p.product_name, p.sale_status,
			p.reserved_by, p.reserved_until, p.reserved_at,
			p.reservation_duration_hours,
			u.full_name as buyer_name, u.email as buyer_email,
			s.full_name as seller_name, s.email as seller_email
		FROM products p
		LEFT JOIN users u ON p.reserved_by = u.id
		LEFT JOIN users s ON p.uploader_id = s.id
		WHERE p.product_id = ?
		LIMIT 1`,
		[productId]
	);

	const result = rows[0];
	if (!result) {
		return sendPayload(null, 'error', 'Product not found', 404);
	}

	if (String(result.sale_status) === 'reserved' && result.reserved_until) {
		const now = new Date();
		const until = new Date(result.reserved_until);
		if (now < until) {
			const ms = until.getTime() - now.getTime();
			const totalSeconds = Math.floor(ms / 1000);
			const hours = Math.floor(totalSeconds / 3600);
			const minutes = Math.floor((totalSeconds % 3600) / 60);
			const seconds = totalSeconds % 60;
			result.time_remaining = {
				hours,
				minutes,
				seconds,
				formatted: `${hours} hours ${minutes} minutes`
			};
			result.is_expired = false;
		} else {
			result.time_remaining = null;
			result.is_expired = true;
		}
	}

	return sendPayload(result, 'success', 'Reservation details retrieved', 200);
}

async function getReservationHistory(data) {
	const productId = Number(data?.product_id || 0);
	const userId = Number(data?.user_id || 0);

	if (!productId && !userId) {
		return sendPayload(null, 'error', 'Product ID or User ID required', 400);
	}

	let sql = `SELECT rh.*,
		p.product_name,
		u.full_name as buyer_name,
		s.full_name as seller_name
	FROM reservation_history rh
	JOIN products p ON rh.product_id = p.product_id
	JOIN users u ON rh.reserved_by = u.id
	JOIN users s ON rh.seller_id = s.id
	WHERE 1=1`;
	const params = [];

	if (productId) {
		sql += ' AND rh.product_id = ?';
		params.push(productId);
	}

	if (userId) {
		sql += ' AND (rh.reserved_by = ? OR rh.seller_id = ?)';
		params.push(userId, userId);
	}

	sql += ' ORDER BY rh.created_at DESC';
	const rows = await query(sql, params);
	return sendPayload(rows, 'success', 'Reservation history retrieved', 200);
}

async function markNotificationAsRead(data) {
	const notificationId = Number(data?.notification_id || 0);
	const adminId = Number(data?.admin_id || 0);

	if (!notificationId || !adminId) {
		return sendPayload(null, 'error', 'notification_id and admin_id are required', 400);
	}

	await query(
		`UPDATE admin_notifications
		SET is_read = 1,
			read_at = CURRENT_TIMESTAMP
		WHERE notification_id = ?
			AND admin_id = ?`,
		[notificationId, adminId]
	);

	return sendPayload({ notification_id: notificationId }, 'success', 'Notification marked as read', 200);
}

async function markUserNotificationAsRead(data) {
	const notificationId = Number(data?.notification_id || 0);
	if (!notificationId) {
		return sendPayload(null, 'error', 'Notification ID is required', 400);
	}

	await query(
		`UPDATE user_notifications
		SET is_read = 1,
			read_at = NOW()
		WHERE notification_id = ?`,
		[notificationId]
	);

	return sendPayload({ notification_id: notificationId }, 'success', 'Notification marked as read', 200);
}

async function markAllUserNotificationsAsRead(data) {
	const userId = Number(data?.user_id || 0);
	if (!userId) {
		return sendPayload(null, 'error', 'User ID is required', 400);
	}

	const result = await query(
		`UPDATE user_notifications
		SET is_read = 1,
			read_at = NOW()
		WHERE user_id = ? AND is_read = 0`,
		[userId]
	);

	return sendPayload({ user_id: userId, count: Number(result.affectedRows || 0) }, 'success', 'All notifications marked as read', 200);
}

async function deleteUserNotification(data) {
	const notificationId = Number(data?.notification_id || 0);
	if (!notificationId) {
		return sendPayload(null, 'error', 'Notification ID is required', 400);
	}

	await query('DELETE FROM user_notifications WHERE notification_id = ?', [notificationId]);
	return sendPayload({ notification_id: notificationId }, 'success', 'Notification deleted successfully', 200);
}

async function archiveProduct(data) {
	const productId = Number(data?.product_id || 0);
	const archivedBy = Number(data?.admin_id || 0);
	const role = String(data?.role || data?.admin_role || 'moderator');
	const reason = data?.reason ? String(data.reason) : null;
	const action = String(data?.action || 'archived');

	if (!productId || !archivedBy) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (action === 'archived' && !reason) {
		return sendPayload(null, 'error', 'Archive reason is required', 400);
	}

	const newStatus = action === 'archived' ? 'archived' : 'active';
	const isArchived = action === 'archived' ? 1 : 0;
	const hasArchiveHistory = await tableExists('archive_history');

	return withTransaction(async (connection) => {
		const productRows = await txQuery(
			connection,
			`SELECT p.product_name, p.uploader_id, u.full_name as uploader_name
			FROM products p
			JOIN users u ON p.uploader_id = u.id
			WHERE p.product_id = ?
			LIMIT 1`,
			[productId]
		);
		const product = productRows[0];
		if (!product) {
			return sendPayload(null, 'error', 'Product not found', 404);
		}

		if (action === 'archived') {
			await txQuery(
				connection,
				`UPDATE products
				SET status = ?,
					is_archived = ?,
					archive_reason = ?,
					archived_at = CURRENT_TIMESTAMP,
					archived_by = ?
				WHERE product_id = ?`,
				[newStatus, isArchived, reason, archivedBy, productId]
			);
		} else {
			await txQuery(
				connection,
				`UPDATE products
				SET status = ?,
					is_archived = ?,
					archive_reason = NULL,
					archived_at = NULL,
					archived_by = NULL
				WHERE product_id = ?`,
				[newStatus, isArchived, productId]
			);
		}

		if (hasArchiveHistory) {
			await txQuery(
				connection,
				`INSERT INTO archive_history (product_id, archived_by, role, reason, action)
				VALUES (?, ?, ?, ?, ?)`,
				[productId, archivedBy, role, reason, action]
			);
		}

		const notificationTitle = action === 'archived' ? 'Product Archived' : 'Product Restored';
		const notificationType = action === 'archived' ? 'Product Archived' : 'Product Restored';
		const notificationMessage = action === 'archived'
			? `Your product '${product.product_name}' has been archived. Reason: ${reason}`
			: `Great news! Your product '${product.product_name}' has been restored and is now active again.`;

		await createUserNotification(
			product.uploader_id,
			notificationType,
			notificationTitle,
			notificationMessage,
			productId,
			connection
		);

		return sendPayload({
			product_id: productId,
			status: newStatus,
			action,
			is_archived: isArchived
		}, 'success', `Product ${action} successfully`, 200);
	});
}

function validatePasswordStrength(password) {
	if (!password || password.length < 8) return false;
	if (!/[A-Z]/.test(password)) return false;
	if (!/[a-z]/.test(password)) return false;
	if (!/[0-9]/.test(password)) return false;
	if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) return false;
	return true;
}

async function createAdmin(data) {
	const username = String(data?.username || '').trim();
	const email = String(data?.email || '').trim();
	const password = String(data?.password || '');
	const fullName = String(data?.full_name || '').trim();
	const role = String(data?.role || 'moderator').trim();
	const normalizedRole = String(role || '').toLowerCase().replace(/_/g, ' ').trim();
	const createdByRole = String(data?.created_by_role || '').toLowerCase().replace(/_/g, ' ').trim();

	if (!username || !email || !password || !fullName) {
		return sendPayload(null, 'error', 'All fields are required', 400);
	}

	if (!['super admin', 'moderator'].includes(createdByRole)) {
		return sendPayload(null, 'error', 'Insufficient permissions to create admin', 403);
	}

	if (createdByRole === 'moderator' && ['super admin', 'moderator'].includes(normalizedRole)) {
		return sendPayload(null, 'error', 'Moderators can only create support staff', 403);
	}

	if (!['super admin', 'moderator', 'support'].includes(normalizedRole)) {
		return sendPayload(null, 'error', 'Invalid role specified', 400);
	}

	if (!validatePasswordStrength(password)) {
		return sendPayload(null, 'error', 'Password must include uppercase, lowercase, number, special character, and be at least 8 characters.', 400);
	}

	// If username already exists, attempt to auto-generate a unique username
	let usernameCandidate = username;
	const usernameExists = async (u) => {
		const rows = await query('SELECT admin_id FROM admins WHERE username = ? LIMIT 1', [u]);
		return rows.length > 0;
	};

	if (await usernameExists(usernameCandidate)) {
		// Try up to 6 variants with numeric suffixes
		let found = false;
		for (let i = 1; i <= 6; i++) {
			const attempt = `${username}${i}`;
			if (!(await usernameExists(attempt))) {
				usernameCandidate = attempt;
				found = true;
				break;
			}
		}

		if (!found) {
			// Fallback to random suffix
			for (let i = 0; i < 6; i++) {
				const rnd = Math.floor(100 + Math.random() * 900);
				const attempt = `${username}${rnd}`;
				if (!(await usernameExists(attempt))) {
					usernameCandidate = attempt;
					found = true;
					break;
				}
			}
		}

		if (!found) {
			return sendPayload(null, 'error', 'Username already exists', 409);
		}
	}

	const emailRows = await query('SELECT admin_id FROM admins WHERE email = ? LIMIT 1', [email]);
	if (emailRows.length) {
		return sendPayload(null, 'error', 'Email already exists', 409);
	}

	const hashedPassword = await bcrypt.hash(password, 10);
	const result = await query(
		`INSERT INTO admins (username, email, password, full_name, role, status)
		VALUES (?, ?, ?, ?, ?, 'active')`,
		[usernameCandidate, email, hashedPassword, fullName, role]
	);

	return sendPayload({
		admin_id: Number(result.insertId || 0),
		username: usernameCandidate,
		email,
		full_name: fullName,
		role,
		status: 'active'
	}, 'success', 'Admin created successfully', 201);
}

async function updateAdmin(data) {
	const adminId = Number(data?.admin_id || 0);
	const username = String(data?.username || '').trim();
	const email = String(data?.email || '').trim();
	const fullName = String(data?.full_name || '').trim();
	const role = String(data?.role || '').trim();
	const status = data?.status ?? null;
	const updatedByRole = String(data?.updated_by_role || '').toLowerCase();
	const updatedById = Number(data?.updated_by_id || 0);

	if (!adminId || !username || !email || !fullName || !role) {
		return sendPayload(null, 'error', 'All fields are required', 400);
	}

	if (!['super admin', 'moderator'].includes(updatedByRole)) {
		return sendPayload(null, 'error', 'Insufficient permissions', 403);
	}

	if (adminId === updatedById) {
		return sendPayload(null, 'error', 'Cannot modify your own role or status', 403);
	}

	if (updatedByRole === 'moderator') {
		const targetRows = await query('SELECT role FROM admins WHERE admin_id = ? LIMIT 1', [adminId]);
		const target = targetRows[0];
		if (target && ['super admin', 'moderator'].includes(String(target.role || '').toLowerCase())) {
			return sendPayload(null, 'error', 'Moderators cannot modify super admins or other moderators', 403);
		}
	}

	let sql = 'UPDATE admins SET username = ?, email = ?, full_name = ?, role = ?';
	const params = [username, email, fullName, role];

	if (status !== null) {
		sql += ', status = ?';
		params.push(String(status));
	}

	sql += ' WHERE admin_id = ?';
	params.push(adminId);

	await query(sql, params);

	return sendPayload({ admin_id: adminId, message: 'Admin updated successfully' }, 'success', 'Admin updated successfully', 200);
}

async function deleteAdmin(data) {
	const adminId = Number(data?.admin_id || 0);
	const deletedByRole = String(data?.deleted_by_role || '').toLowerCase();
	const deletedById = Number(data?.deleted_by_id || 0);

	if (!adminId) {
		return sendPayload(null, 'error', 'Admin ID is required', 400);
	}

	if (deletedByRole !== 'super admin') {
		return sendPayload(null, 'error', 'Only super admins can delete admin accounts', 403);
	}

	if (adminId === deletedById) {
		return sendPayload(null, 'error', 'Cannot delete your own account', 403);
	}

	const adminRows = await query('SELECT admin_id FROM admins WHERE admin_id = ? LIMIT 1', [adminId]);
	if (!adminRows.length) {
		return sendPayload(null, 'error', 'Admin not found', 404);
	}

	await query('DELETE FROM admins WHERE admin_id = ?', [adminId]);

	return sendPayload({ admin_id: adminId, message: 'Admin deleted successfully' }, 'success', 'Admin deleted successfully', 200);
}

async function submitModeratorApplication(data) {
	const userId = Number(data?.user_id || 0);
	const fullName = String(data?.full_name || '').trim();
	const reason = String(data?.reason || '').trim();
	const experience = data?.experience ?? null;

	if (!userId || !fullName || !reason) {
		return sendPayload(null, 'error', 'User ID, full name, and reason are required', 400);
	}

	const existingRows = await query(
		`SELECT application_id, status
		FROM moderator_applications
		WHERE user_id = ? AND status IN ('pending', 'approved')
		LIMIT 1`,
		[userId]
	);

	if (existingRows.length) {
		if (String(existingRows[0].status) === 'approved') {
			return sendPayload(null, 'error', 'You are already a moderator', 409);
		}
		return sendPayload(null, 'error', 'You already have a pending application', 409);
	}

	const userRows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
	if (userRows[0] && String(userRows[0].role || '').toLowerCase() === 'moderator') {
		return sendPayload(null, 'error', 'You are already a moderator', 409);
	}

	const result = await query(
		`INSERT INTO moderator_applications (user_id, full_name, reason, experience, status)
		VALUES (?, ?, ?, ?, 'pending')`,
		[userId, fullName, reason, experience]
	);

	return sendPayload({
		application_id: Number(result.insertId || 0),
		status: 'pending',
		message: 'Your moderator application has been submitted successfully'
	}, 'success', 'Application submitted successfully', 201);
}

async function reviewModeratorApplication(data) {
	const applicationId = Number(data?.application_id || 0);
	const action = String(data?.action || '').toLowerCase();
	const reviewedBy = Number(data?.reviewed_by || 0);

	if (!applicationId || !action || !reviewedBy) {
		return sendPayload(null, 'error', 'Application ID, action, and reviewer ID are required', 400);
	}

	if (!['approve', 'reject'].includes(action)) {
		return sendPayload(null, 'error', "Invalid action. Must be 'approve' or 'reject'", 400);
	}

	return withTransaction(async (connection) => {
		const appRows = await txQuery(
			connection,
			`SELECT user_id, full_name, status
			FROM moderator_applications
			WHERE application_id = ?
			LIMIT 1`,
			[applicationId]
		);
		const application = appRows[0];

		if (!application) {
			return sendPayload(null, 'error', 'Application not found', 404);
		}

		if (String(application.status) !== 'pending') {
			return sendPayload(null, 'error', 'This application has already been reviewed', 409);
		}

		const status = action === 'approve' ? 'approved' : 'rejected';

		await txQuery(
			connection,
			`UPDATE moderator_applications
			SET status = ?, reviewed_by = ?, reviewed_at = NOW()
			WHERE application_id = ?`,
			[status, reviewedBy, applicationId]
		);

		const responseData = {
			application_id: applicationId,
			status,
			user_id: Number(application.user_id),
			full_name: application.full_name
		};

		if (action === 'approve') {
			const userRows = await txQuery(
				connection,
				`SELECT id, full_name, email, profile_image
				FROM users
				WHERE id = ?
				LIMIT 1`,
				[application.user_id]
			);
			const userData = userRows[0];

			if (!userData) {
				return sendPayload(null, 'error', 'User not found', 404);
			}

			await txQuery(connection, "UPDATE users SET role = 'moderator' WHERE id = ?", [userData.id]);

			let username = `${String(userData.email || 'user').split('@')[0]}_mod_${userData.id}`;
			const newPassword = crypto.randomBytes(6).toString('hex');
			const hashedPassword = await bcrypt.hash(newPassword, 10);

			const usernameRows = await txQuery(connection, 'SELECT admin_id FROM admins WHERE username = ? LIMIT 1', [username]);
			if (usernameRows.length) {
				username = `${username}_${Date.now()}`;
			}

			const emailRows = await txQuery(connection, 'SELECT admin_id FROM admins WHERE email = ? LIMIT 1', [userData.email]);
			if (emailRows.length) {
				return sendPayload(null, 'error', 'This email is already registered as an admin', 409);
			}

			let insertResult;
			try {
				insertResult = await txQuery(
					connection,
					`INSERT INTO admins (user_id, username, email, password, full_name, role, status)
					VALUES (?, ?, ?, ?, ?, 'moderator', 'active')`,
					[userData.id, username, userData.email, hashedPassword, userData.full_name]
				);
			} catch {
				insertResult = await txQuery(
					connection,
					`INSERT INTO admins (username, email, password, full_name, role, status)
					VALUES (?, ?, ?, ?, 'moderator', 'active')`,
					[username, userData.email, hashedPassword, userData.full_name]
				);
			}

			const newAdminId = Number(insertResult.insertId || 0);

			try {
				await txQuery(
					connection,
					'UPDATE moderator_applications SET admin_account_id = ? WHERE application_id = ?',
					[newAdminId, applicationId]
				);
			} catch {
				// Ignore missing admin_account_id column.
			}

			responseData.new_admin_account = {
				admin_id: newAdminId,
				username,
				email: userData.email,
				password: newPassword,
				full_name: userData.full_name,
				role: 'moderator'
			};
		}

		const message = action === 'approve'
			? `Application approved. ${application.full_name} is now a moderator with admin account created.`
			: 'Application rejected.';

		return sendPayload(responseData, 'success', message, 200);
	});
}

async function markUserViolation(data) {
	const userId = Number(data?.user_id || 0);
	const action = String(data?.action || 'mark').trim().toLowerCase();
	const level = Number(data?.level || 0);
	const reason = String(data?.reason || '').trim();

	if (!userId) {
		return sendPayload(null, 'error', 'User ID is required', 400);
	}

	if (action === 'unrestrict') {
		if (reason.length < 5) {
			return sendPayload(null, 'error', 'A reason (at least 5 characters) is required to unrestrict a user', 400);
		}

		return withTransaction(async (connection) => {
			const rows = await txQuery(
				connection,
				`SELECT id, full_name, email, violation_count, account_status
				FROM users
				WHERE id = ?
				LIMIT 1`,
				[userId]
			);
			const user = rows[0];

			if (!user) {
				return sendPayload(null, 'error', 'User not found', 404);
			}

			const normalizedStatus = String(user.account_status || '').trim().toLowerCase();
			if (!['restricted', 'suspended'].includes(normalizedStatus)) {
				return sendPayload(null, 'error', 'Only restricted or suspended users can be unrestricted using this action', 400);
			}

			await txQuery(
				connection,
				"UPDATE users SET account_status = 'active', updated_at = NOW() WHERE id = ?",
				[userId]
			);

			try {
				await txQuery(
					connection,
					`UPDATE user_restrictions
					SET is_active = FALSE
					WHERE user_id = ? AND is_active = TRUE`,
					[userId]
				);
			} catch {
				// Ignore missing restriction tables in older schemas.
			}

			const insertResult = await txQuery(
				connection,
				`INSERT INTO user_notifications (user_id, type, title, message, reference_id, is_read, created_at)
				VALUES (?, 'Violation', ?, ?, NULL, 0, NOW())`,
				[
					userId,
					'Account Access Restored',
					`Your account restriction/suspension has been lifted by CycleMart admin.\n\nReason: ${reason}\n\nYour account access is now restored. Please continue following community guidelines.`
				]
			);

			return sendPayload({
				user_id: userId,
				violation_count: Number(user.violation_count || 0),
				account_status: 'active',
				notification_id: Number(insertResult.insertId || 0),
				user_name: user.full_name,
				user_email: user.email
			}, 'success', 'User has been unrestricted successfully.', 200);
		});
	}

	if (!level || !reason) {
		return sendPayload(null, 'error', 'User ID, violation level, and reason are required', 400);
	}

	if (![1, 2, 3, 4].includes(level)) {
		return sendPayload(null, 'error', 'Invalid violation level. Must be 1, 2, 3, or 4', 400);
	}

	if (reason.length < 10) {
		return sendPayload(null, 'error', 'Reason must be at least 10 characters long', 400);
	}

	return withTransaction(async (connection) => {
		const rows = await txQuery(
			connection,
			`SELECT id, full_name, email, violation_count, account_status
			FROM users
			WHERE id = ?
			LIMIT 1`,
			[userId]
		);
		const user = rows[0];

		if (!user) {
			return sendPayload(null, 'error', 'User not found', 404);
		}

		const statusByLevel = {
			1: 'active',
			2: 'restricted',
			3: 'suspended',
			4: 'banned'
		};
		const accountStatus = statusByLevel[level] || 'active';
		const newViolationCount = Number(user.violation_count || 0) + 1;

		await txQuery(
			connection,
			`UPDATE users
			SET violation_count = ?,
				account_status = ?,
				updated_at = NOW()
			WHERE id = ?`,
			[newViolationCount, accountStatus, userId]
		);

		const notificationByLevel = {
			1: {
				title: 'Account Warning',
				message: `You have received a warning for violating CycleMart's community guidelines.\n\nReason: ${reason}\n\nThis is your first violation. Please review our terms of service to avoid further penalties.`
			},
			2: {
				title: 'Account Restricted',
				message: `Your account has been restricted due to a second violation of CycleMart's community guidelines.\n\nReason: ${reason}\n\nYour account now has limited access. Continued violations may result in suspension.`
			},
			3: {
				title: 'Account Suspended',
				message: `Your account has been suspended due to multiple violations of CycleMart's community guidelines.\n\nReason: ${reason}\n\nYour account access is temporarily suspended. This is your final warning before permanent ban.`
			},
			4: {
				title: 'Account Permanently Banned',
				message: `Your account has been permanently banned due to repeated violations of CycleMart's community guidelines.\n\nReason: ${reason}\n\nYou will no longer have access to CycleMart. This decision is final.`
			}
		};

		const notification = notificationByLevel[level] || {
			title: 'Account Violation',
			message: `Your account has received a violation notice.\n\nReason: ${reason}`
		};

		const insertResult = await txQuery(
			connection,
			`INSERT INTO user_notifications (user_id, type, title, message, reference_id, is_read, created_at)
			VALUES (?, 'Violation', ?, ?, NULL, 0, NOW())`,
			[userId, notification.title, notification.message]
		);

		return sendPayload({
			user_id: userId,
			violation_level: level,
			violation_count: newViolationCount,
			account_status: accountStatus,
			notification_id: Number(insertResult.insertId || 0),
			user_name: user.full_name,
			user_email: user.email
		}, 'success', 'Violation marked successfully. User has been notified.', 200);
	});
}

async function uploadProfile(data) {
	const fullName = String(data?.full_name || '').trim();
	const phone = String(data?.phone || '').trim();
	const street = String(data?.street || '').trim();
	const barangay = String(data?.barangay || '').trim();
	const userId = Number(data?.user_id || 0);
	const city = 'Olongapo City';

	if (!fullName || !userId) {
		return sendPayload(null, 'error', 'Full name and user ID are required', 400);
	}

	if (barangay && !barangays.includes(barangay)) {
		return sendPayload(null, 'error', 'Invalid barangay. Please select a valid barangay from Olongapo City.', 400);
	}

	let imagePath = null;
	if (data?.image) {
		imagePath = await saveBase64File(String(data.image), '', 'profile');
	}

	let sql = `UPDATE users
		SET full_name = ?,
			phone = ?,
			street = ?,
			barangay = ?,
			city = ?`;
	const params = [fullName, phone, street, barangay, city];

	if (imagePath) {
		sql += ', profile_image = ?';
		params.push(imagePath);
	}

	sql += ' WHERE id = ?';
	params.push(userId);

	await query(sql, params);

	return sendPayload({
		full_name: fullName,
		phone,
		street,
		barangay,
		city,
		profile_image: imagePath
	}, 'success', 'Profile updated successfully', 200);
}

async function editProfile(data) {
	const fullName = String(data?.full_name || '').trim();
	const email = String(data?.email || '').trim();
	const phone = String(data?.phone || '').trim();
	const street = String(data?.street || '').trim();
	const barangay = String(data?.barangay || '').trim();
	const userId = Number(data?.user_id || 0);
	const emailChanged = Boolean(data?.email_changed);
	const city = 'Olongapo City';

	if (!fullName || !email || !userId) {
		return sendPayload(null, 'error', 'Full name, email and user ID are required', 400);
	}

	if (barangay && !barangays.includes(barangay)) {
		return sendPayload(null, 'error', 'Invalid barangay. Please select a valid barangay from Olongapo City.', 400);
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return sendPayload(null, 'error', 'Invalid email format', 400);
	}

	if (emailChanged) {
		const existingRows = await query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, userId]);
		if (existingRows.length) {
			return sendPayload(null, 'error', 'Email already registered by another user', 409);
		}
	}

	let imagePath = null;
	if (data?.image && /^data:image\/.+;base64,/i.test(String(data.image))) {
		imagePath = await saveBase64File(String(data.image), '', 'profile_image');
	}

	let sql = `UPDATE users
		SET full_name = ?,
			email = ?,
			phone = ?,
			street = ?,
			barangay = ?,
			city = ?`;
	const params = [fullName, email, phone, street, barangay, city];

	let verificationToken = null;
	if (emailChanged) {
		verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
		const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
		sql += ', is_verified = 0, verification_token = ?, token_expires_at = ?';
		params.push(verificationToken, tokenExpiresAt);
	}

	if (imagePath) {
		sql += ', profile_image = ?';
		params.push(imagePath);
	}

	sql += ' WHERE id = ?';
	params.push(userId);

	await query(sql, params);

	if (emailChanged && verificationToken) {
		const verificationUrl = `${getFrontendUrl()}/email-verification?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
		const emailBody = buildVerificationEmail({ recipientName: fullName, verificationUrl });
		await sendEmail({
			to: email,
			name: fullName,
			subject: 'Verify Your Updated Email Address',
			html: emailBody.html,
			text: emailBody.text
		});
	}

	const currentRows = await query('SELECT profile_image FROM users WHERE id = ? LIMIT 1', [userId]);
	const currentProfileImage = currentRows[0]?.profile_image || imagePath || null;

	return sendPayload({
		full_name: fullName,
		email,
		phone,
		street,
		barangay,
		city,
		profile_image: currentProfileImage,
		email_changed: emailChanged,
		verification_sent: emailChanged
	}, 'success', emailChanged
		? 'Profile updated successfully. Verification email sent to new email address.'
		: 'Profile updated successfully', 200);
}

async function submitForApproval(data) {
	const productId = Number(data?.product_id || 0);
	const uploaderId = Number(data?.uploader_id || 0);

	if (!productId || !uploaderId) {
		return sendPayload(null, 'error', 'Missing product ID or uploader ID', 400);
	}

	const result = await query(
		`UPDATE products
		SET approval_submitted_at = NOW()
		WHERE product_id = ?
			AND uploader_id = ?`,
		[productId, uploaderId]
	);

	if (Number(result.affectedRows || 0) > 0) {
		// If auto-approval is enabled, evaluate server-side rules and possibly approve
		try {
			const autoEnabled = await isListingAutoApprovalEnabled();
			if (autoEnabled) {
				// fetch product details for evaluation
				const prodRows = await query('SELECT product_id, product_name, brand_name, custom_brand, bicycle_brand_id, bicycle_part_id, product_images, price, description, location, for_type, `condition`, category, quantity, specifications FROM products WHERE product_id = ? LIMIT 1', [productId]);
				const prod = prodRows[0] || null;
				let serverFailures = [];
				if (prod) {
					try {
						prod.product_images = prod.product_images ? JSON.parse(prod.product_images || '[]') : [];
						prod.specifications = prod.specifications ? (Array.isArray(prod.specifications) ? prod.specifications : JSON.parse(prod.specifications || '[]')) : [];
						serverFailures = serverEvaluatePendingReasons(prod);
					} catch (e) {
						console.error('Error parsing product for server evaluation', e && e.message);
					}
				}
				if (serverFailures.length === 0) {
					await query(`UPDATE products
						SET approval_status = 'approved', approved_by = 0, approval_date = NOW(), status = 'active'
						WHERE product_id = ?`, [productId]);
					try {
						await insertAutoApprovalAudit(productId, 'auto-approved by config', { method: 'submitForApproval', reasons: [] });
					} catch (e) {
						console.error('Failed to insert auto-approval audit', e && e.message);
					}
					try {
						if (prod) {
							await createUserNotification(
								prod.uploader_id,
								'listing approved',
								'Listing Approved',
								`Your listing '${prod.product_name}' was automatically approved and is now live.`,
								productId
							);
						}
					} catch (e) {
						console.error('Auto-approval notification failed', e && e.message);
					}
					return sendPayload({ product_id: productId, message: 'Product auto-approved' }, 'success', 'Product auto-approved and is now live', 200);
					} else {
						try {
							await insertAutoApprovalAudit(productId, 'auto-approval-skip', { method: 'submitForApproval', reasons: serverFailures });
						} catch (e) {
							console.error('Failed to insert auto-approval audit (skip)', e && e.message);
						}
						// notify uploader with reasons the listing remains pending
						try {
							const prodRows2 = await query('SELECT product_name, uploader_id FROM products WHERE product_id = ? LIMIT 1', [productId]);
							const prod2 = prodRows2[0] || null;
							if (prod2) {
								const reasonText = Array.isArray(serverFailures) ? serverFailures.join('; ') : String(serverFailures || '');
								await createUserNotification(
									prod2.uploader_id,
									'Listing Pending Review',
									'Your listing is still pending review',
									`Your listing '${prod2.product_name}' is still pending admin review because: ${reasonText}. Please update your listing to address these issues.`,
									productId
								);
							}
						} catch (e) {
							console.error('Auto-approval skip notification failed', e && e.message);
						}
					}
			}
		} catch (e) {
			console.error('Error checking auto-approval config:', e && e.message);
		}

		return sendPayload({
			product_id: productId,
			message: 'Product submitted for approval'
		}, 'success', 'Product submitted for approval', 200);
	}

	return sendPayload(null, 'error', 'Product not found or unauthorized', 404);
}

function isValidJsonString(value) {
	if (typeof value !== 'string') return false;
	try {
		JSON.parse(value);
		return true;
	} catch {
		return false;
	}
}

function validateListingText(value, label, min, max, pattern) {
	const text = String(value || '').trim();
	if (!text) return { ok: false, error: `${label} is required` };
	if (min && text.length < min) return { ok: false, error: `${label} must be at least ${min} characters` };
	if (max && text.length > max) return { ok: false, error: `${label} must be ${max} characters or less` };
	if (pattern && !pattern.test(text)) return { ok: false, error: `${label} contains invalid characters` };
	return { ok: true, value: text };
}

async function updateProduct(data) {
	const productId = Number(data?.product_id || 0);
	const uploaderId = Number(data?.uploader_id || 0);
	const productName = String(data?.product_name || '').trim();
	const brandName = String(data?.brand_name || 'no brand').trim().toLowerCase();
	let customBrand = data?.custom_brand ?? null;
	const price = Number(data?.price || 0);
	const description = String(data?.description || '').trim();
	const location = String(data?.location || '').trim();
	const forType = String(data?.for_type || 'sale').trim().toLowerCase();
	const condition = String(data?.condition || 'second hand').trim().toLowerCase();
	const category = String(data?.category || 'others').trim();
	const quantity = Number(data?.quantity || 1);
	let bicycleBrandId = data?.bicycle_brand_id ?? null;
	let bicyclePartId = data?.bicycle_part_id ?? null;

	if (!productId || !uploaderId || !productName || !price || !description || !location) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	const nameCheck = validateListingText(productName, 'Product name', 4, 120, /^[A-Za-z0-9\s.,'"()&\-\/#:+]+$/);
	if (!nameCheck.ok || !/[a-z]/i.test(productName)) {
		return sendPayload(null, 'error', !nameCheck.ok ? nameCheck.error : 'Product name must contain readable letters', 400);
	}

	if (description.length < 20 || description.length > 2000) {
		return sendPayload(null, 'error', 'Description must be between 20 and 2000 characters', 400);
	}

	const locationCheck = validateListingText(location, 'Location', 0, 120, /^[A-Za-z0-9\s.,'"()&\-\/#:+]+$/);
	if (!locationCheck.ok) {
		return sendPayload(null, 'error', locationCheck.error, 400);
	}

	if (price <= 0 || price > 10000000) {
		return sendPayload(null, 'error', 'Price must be greater than 0 and not exceed 10000000', 400);
	}

	if (!/^\d+(\.\d{1,2})?$/.test(String(data?.price ?? price))) {
		return sendPayload(null, 'error', 'Price can only have up to 2 decimal places', 400);
	}

	if (!Number.isFinite(quantity) || quantity < 1) {
		return sendPayload(null, 'error', 'Quantity must be at least 1', 400);
	}

	if (quantity > 999) {
		return sendPayload(null, 'error', 'Quantity must be 999 or less', 400);
	}

	if (!['sale', 'trade', 'both'].includes(forType)) {
		return sendPayload(null, 'error', 'Invalid listing type', 400);
	}

	if (!['brand new', 'second hand'].includes(condition)) {
		return sendPayload(null, 'error', 'Invalid condition', 400);
	}

	if (!category) {
		return sendPayload(null, 'error', 'Category is required', 400);
	}

	if (brandName === 'others') {
		customBrand = String(customBrand || '').trim();
		if (!customBrand) {
			return sendPayload(null, 'error', "Custom brand is required when 'others' is selected", 400);
		}
		if (customBrand.length > 100) {
			return sendPayload(null, 'error', 'Custom brand must be 100 characters or less', 400);
		}
	} else {
		customBrand = null;
	}

	const existingRows = await query(
		`SELECT bicycle_brand_id, bicycle_part_id, approval_status
		FROM products
		WHERE product_id = ? AND uploader_id = ?
		LIMIT 1`,
		[productId, uploaderId]
	);
	const existing = existingRows[0];
	if (!existing) {
		return sendPayload(null, 'error', 'Product not found or unauthorized', 404);
	}

	if (bicycleBrandId === null) bicycleBrandId = existing.bicycle_brand_id ?? null;
	if (bicyclePartId === null) bicyclePartId = existing.bicycle_part_id ?? null;

	const productImages = parseJson(data?.product_images, []);
	const savedImages = [];
	if (Array.isArray(productImages)) {
		if (productImages.length > 10) {
			return sendPayload(null, 'error', 'Maximum 10 images allowed', 400);
		}
		for (const image of productImages) {
			if (typeof image === 'string' && image.startsWith('data:image/')) {
				const saved = await saveBase64File(image, '', 'prod');
				if (saved) savedImages.push(saved);
			} else if (image) {
				savedImages.push(image);
			}
		}
	}

	const productVideos = parseJson(data?.product_videos, []);
	const savedVideos = [];
	if (Array.isArray(productVideos)) {
		for (const video of productVideos) {
			if (typeof video === 'string' && video.startsWith('data:video/')) {
				const base64Content = video.split(',')[1] || '';
				const sizeBytes = Buffer.from(base64Content, 'base64').length;
				if (sizeBytes > 50 * 1024 * 1024) continue;
				const saved = await saveBase64File(video, 'videos', 'video');
				if (saved) savedVideos.push(saved);
			} else if (video) {
				savedVideos.push(video);
			}
		}
	}

	const specs = Array.isArray(data?.specifications) ? data.specifications : [];
	const processedSpecs = specs.map((spec) => {
		const name = String(spec?.spec_name || spec?.name || '').trim();
		const value = String(spec?.spec_value || spec?.value || '').trim();
		return name && value ? { name, value } : null;
	}).filter(Boolean);

	const jsonSpecifications = processedSpecs.length ? JSON.stringify(processedSpecs) : null;

	const updateResult = await query(
		`UPDATE products SET
			product_name = ?,
			brand_name = ?,
			custom_brand = ?,
			bicycle_brand_id = ?,
			bicycle_part_id = ?,
			product_images = ?,
			product_videos = ?,
			price = ?,
			description = ?,
			location = ?,
			for_type = ?,
			\`condition\` = ?,
			category = ?,
			quantity = ?,
			specifications = ?
		WHERE product_id = ? AND uploader_id = ?`,
		[
			productName,
			brandName,
			customBrand,
			bicycleBrandId,
			bicyclePartId,
			JSON.stringify(savedImages),
			JSON.stringify(savedVideos),
			price,
			description,
			location,
			forType,
			condition,
			category,
			quantity,
			jsonSpecifications,
			productId,
			uploaderId
		]
	);

	if (Number(updateResult.affectedRows || 0) === 0) {
		return sendPayload(null, 'error', 'Product not found or unauthorized', 404);
	}

	return sendPayload({
		product_id: productId,
		message: 'Product updated successfully',
		approval_status: existing.approval_status || 'pending'
	}, 'success', 'Product updated successfully', 200);
}

async function deleteProductByOwner(data) {
	const productId = Number(data?.product_id || 0);
	const uploaderId = Number(data?.uploader_id || 0);

	if (!productId || !uploaderId) {
		return sendPayload(null, 'error', 'Missing product ID or uploader ID', 400);
	}

	const result = await query('DELETE FROM products WHERE product_id = ? AND uploader_id = ?', [productId, uploaderId]);
	if (Number(result.affectedRows || 0) > 0) {
		return sendPayload(null, 'success', 'Product deleted successfully', 200);
	}

	return sendPayload(null, 'error', 'Product not found or unauthorized', 404);
}

async function updateSaleStatus(data) {
	const productId = Number(data?.product_id || 0);
	const uploaderId = Number(data?.uploader_id || 0);
	const saleStatus = String(data?.sale_status || '').trim().toLowerCase();
	const forType = data?.for_type ?? null;
	let conversationId = data?.conversation_id ? Number(data.conversation_id) : null;
	let buyerId = data?.buyer_id ? Number(data.buyer_id) : null;

	if (!productId || !uploaderId || !saleStatus) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (!['available', 'sold', 'reserved', 'traded'].includes(saleStatus)) {
		return sendPayload(null, 'error', 'Invalid sale status', 400);
	}

	const currentRows = await query('SELECT sale_status, product_name FROM products WHERE product_id = ? LIMIT 1', [productId]);
	const currentProduct = currentRows[0];
	if (!currentProduct) {
		return sendPayload(null, 'error', 'Product not found', 404);
	}

	if ((saleStatus === 'sold' || saleStatus === 'traded') && !buyerId && conversationId) {
		const resolved = await query(
			`SELECT buyer_id FROM conversations WHERE conversation_id = ? AND product_id = ? AND seller_id = ? LIMIT 1`,
			[conversationId, productId, uploaderId]
		);
		if (resolved[0]?.buyer_id) buyerId = Number(resolved[0].buyer_id);
	}

	if ((saleStatus === 'sold' || saleStatus === 'traded') && !buyerId && !conversationId) {
		const inferred = await query(
			`SELECT conversation_id, buyer_id
			FROM conversations
			WHERE product_id = ? AND seller_id = ? AND buyer_id IS NOT NULL
			ORDER BY COALESCE(updated_at, created_at) DESC, conversation_id DESC
			LIMIT 1`,
			[productId, uploaderId]
		);
		if (inferred[0]?.buyer_id) {
			buyerId = Number(inferred[0].buyer_id);
			conversationId = Number(inferred[0].conversation_id);
		}
	}

	let sql = 'UPDATE products SET sale_status = ?';
	const params = [saleStatus];
	if ((saleStatus === 'sold' || saleStatus === 'traded') && buyerId) {
		sql += ', buyer_id = ?, transaction_date = NOW()';
		params.push(buyerId);
		if (conversationId) {
			sql += ', sale_conversation_id = ?';
			params.push(conversationId);
		}
	}
	params.push(productId, uploaderId);
	await query(`${sql} WHERE product_id = ? AND uploader_id = ?`, params);

	if (saleStatus === 'sold' || saleStatus === 'traded') {
		const convoRows = await query(
			`SELECT c.conversation_id, c.buyer_id, c.seller_id, u.full_name as buyer_name,
				p.product_name, p.price, p.category, p.brand_name, p.custom_brand, p.\`condition\`, p.for_type
			FROM conversations c
			JOIN users u ON c.buyer_id = u.id
			JOIN products p ON c.product_id = p.product_id
			WHERE c.product_id = ? AND c.seller_id = ?
			ORDER BY c.created_at DESC LIMIT 1`,
			[productId, uploaderId]
		);
		const convo = convoRows[0];
		if (convo) {
			const brandInfo = convo.brand_name && convo.brand_name !== 'no brand'
				? (convo.brand_name === 'others' && convo.custom_brand ? `Brand: ${convo.custom_brand}` : `Brand: ${convo.brand_name}`)
				: null;
			const details = [
				`Price: ${Number(convo.price || 0).toFixed(2)}`,
				convo.category ? `Category: ${convo.category}` : null,
				brandInfo,
				convo.condition ? `Condition: ${String(convo.condition).charAt(0).toUpperCase()}${String(convo.condition).slice(1)}` : null,
				convo.for_type ? `Type: ${String(convo.for_type).charAt(0).toUpperCase()}${String(convo.for_type).slice(1)}` : null
			].filter(Boolean).join(', ');

			const statusText = saleStatus === 'sold' ? 'sold' : 'traded';
			const systemMessage = `The ${convo.product_name} was already ${statusText} to you.\n\nProduct Details:\n• ${details}\n\nYou may fill up the rating form to complete your transaction.`;

			await query(
				`INSERT INTO messages (conversation_id, sender_id, message_text, created_at)
				VALUES (?, ?, ?, NOW())`,
				[convo.conversation_id, uploaderId, systemMessage]
			);
		}
	}

	if (saleStatus === 'reserved') {
			await createSystemConversationMessage({
				conversationId,
				productId,
				sellerId: uploaderId,
				buyerId,
				senderId: uploaderId,
				messageText: `The ${currentProduct.product_name} has been reserved.`
			});
	}

	const productRows = await query('SELECT * FROM products WHERE product_id = ? LIMIT 1', [productId]);
	return sendPayload({
		product_id: productId,
		sale_status: saleStatus,
		for_type: forType,
		previous_status: currentProduct.sale_status,
		updated_at: nowIso(),
		product: productRows[0] || null
	}, 'success', 'Sale status updated successfully', 200);
}

async function submitReport(data) {
	const reporterId = Number(data?.reporter_id || 0);
	let reportedUserId = data?.reported_user_id ? Number(data.reported_user_id) : null;
	const productId = data?.product_id ? Number(data.product_id) : null;
	const conversationId = data?.conversation_id ? Number(data.conversation_id) : null;
	const reportType = data?.report_type ? String(data.report_type) : null;
	const productReasonType = data?.product_reason_type ? String(data.product_reason_type) : null;
	const userReasonType = data?.user_reason_type ? String(data.user_reason_type) : null;
	const reasonDetails = data?.reason_details ?? null;
	const status = data?.status ? String(data.status) : 'pending';
	let proofPayload = data?.proof ?? null;

	if (!reporterId) return sendPayload(null, 'error', 'Reporter ID is required', 400);
	if (!reportType) return sendPayload(null, 'error', 'Report type is required', 400);

	const validReportTypes = ['product', 'user_behavior', 'post_purchase_concern'];
	if (!validReportTypes.includes(reportType)) {
		return sendPayload(null, 'error', 'Invalid report type', 400);
	}

	if (reportType === 'product') {
		const validProductReasons = ['scam', 'fake product', 'spam', 'inappropriate content', 'misleading information', 'stolen item', 'others'];
		if (!productReasonType) return sendPayload(null, 'error', 'Product reason type is required for product reports', 400);
		if (!validProductReasons.includes(productReasonType)) return sendPayload(null, 'error', 'Invalid product reason type', 400);
	} else {
		const validUserReasons = ['rude behavior', 'harassment', 'threats', 'scamming attempt', 'not cooperative', 'refund issue', 'item not as described', 'damaged item', 'post purchase issue', 'others'];
		if (!userReasonType) return sendPayload(null, 'error', 'User reason type is required for user behavior reports', 400);
		if (!validUserReasons.includes(userReasonType)) return sendPayload(null, 'error', 'Invalid user reason type', 400);
	}

	if (!reportedUserId && !productId) {
		return sendPayload(null, 'error', 'Either reported_user_id or product_id must be provided', 400);
	}

	if (Array.isArray(proofPayload)) {
		const savedProofPaths = [];
		for (const file of proofPayload) {
			if (typeof file !== 'string' || !/^data:(image|video)\//.test(file)) {
				return sendPayload(null, 'error', 'Invalid proof file format', 400);
			}
			const base64Content = file.split(',')[1] || '';
			const sizeBytes = Buffer.from(base64Content, 'base64').length;
			if (sizeBytes > 10 * 1024 * 1024) {
				return sendPayload(null, 'error', 'Proof file too large. Maximum size is 10MB', 400);
			}
			const saved = await saveBase64File(file, 'proof', 'proof');
			if (saved) savedProofPaths.push(saved);
		}
		proofPayload = savedProofPaths.length ? JSON.stringify(savedProofPaths) : null;
	} else if (typeof proofPayload === 'string' && isValidJsonString(proofPayload)) {
		// keep as-is
	} else if (proofPayload) {
		proofPayload = null;
	}

	const reporterRows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [reporterId]);
	if (!reporterRows.length) return sendPayload(null, 'error', 'Reporter not found', 404);

	if (reportedUserId) {
		const reportedRows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [reportedUserId]);
		if (!reportedRows.length) return sendPayload(null, 'error', 'Reported user not found', 404);
	}

	if (productId) {
		const productRows = await query('SELECT product_id, uploader_id FROM products WHERE product_id = ? LIMIT 1', [productId]);
		const product = productRows[0];
		if (!product) return sendPayload(null, 'error', 'Product not found', 404);
		if (!reportedUserId && product.uploader_id) reportedUserId = Number(product.uploader_id);
	}

	const result = await query(
		`INSERT INTO reports (
			reporter_id,
			reported_user_id,
			product_id,
			conversation_id,
			report_type,
			product_reason_type,
			user_reason_type,
			reason_details,
			proof,
			status,
			created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		[
			reporterId,
			reportedUserId,
			productId,
			conversationId,
			reportType,
			productReasonType,
			userReasonType,
			reasonDetails,
			proofPayload,
			status
		]
	);

	return sendPayload({
		report_id: Number(result.insertId || 0),
		reporter_id: reporterId,
		reported_user_id: reportedUserId,
		product_id: productId,
		conversation_id: conversationId,
		report_type: reportType,
		product_reason_type: productReasonType,
		user_reason_type: userReasonType,
		status,
		message: 'Report submitted successfully'
	}, 'success', 'Report submitted successfully', 201);
}

async function submitUserReport(data) {
	const reporterId = Number(data?.reporter_id || 0);
	const reportedUserId = Number(data?.reported_user_id || 0);
	const conversationId = data?.conversation_id ? Number(data.conversation_id) : null;
	const productId = data?.product_id ? Number(data.product_id) : null;
	const reportType = data?.report_type ? String(data.report_type) : null;
	const reasonType = data?.reason_type ? String(data.reason_type) : null;
	const reasonDetails = data?.reason_details ?? null;
	const explanation = data?.explanation ?? null;
	const messageReference = Array.isArray(data?.message_reference) ? JSON.stringify(data.message_reference) : null;
	let proofFiles = data?.proof_files ?? null;

	if (!reporterId || !reportedUserId || !reportType || !reasonType) {
		return sendPayload(null, 'error', 'Reporter ID, reported user ID, report type, and reason type are required', 400);
	}

	const validReportTypes = ['user_behavior', 'post_purchase_concern'];
	if (!validReportTypes.includes(reportType)) {
		return sendPayload(null, 'error', 'Invalid report type', 400);
	}

	const validReasonTypes = {
		user_behavior: ['rude behavior', 'harassment', 'threats', 'scamming attempt', 'spam messages', 'others'],
		post_purchase_concern: ['refund issue', 'item not as described', 'damaged item', 'others']
	};

	if (!validReasonTypes[reportType].includes(reasonType)) {
		return sendPayload(null, 'error', 'Invalid reason type for the selected report type', 400);
	}

	if (reasonType === 'others' && !reasonDetails) {
		return sendPayload(null, 'error', "Reason details are required when reason type is 'others'", 400);
	}

	if (Array.isArray(proofFiles)) {
		const savedPaths = [];
		for (const file of proofFiles) {
			if (typeof file !== 'string' || !file) continue;
			const payload = file.startsWith('data:') ? file : `data:image/jpeg;base64,${file}`;
			const saved = await saveBase64File(payload, 'user_reports', 'user_report');
			if (saved) savedPaths.push(saved);
		}
		proofFiles = savedPaths.length ? JSON.stringify(savedPaths) : null;
	}

	const result = await query(
		`INSERT INTO user_reports (
			reporter_id,
			reported_user_id,
			conversation_id,
			product_id,
			report_type,
			reason_type,
			reason_details,
			explanation,
			message_reference,
			proof_files,
			status,
			created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
		[
			reporterId,
			reportedUserId,
			conversationId,
			productId,
			reportType,
			reasonType,
			reasonDetails,
			explanation,
			messageReference,
			proofFiles
		]
	);

	return sendPayload({
		user_report_id: Number(result.insertId || 0),
		reporter_id: reporterId,
		reported_user_id: reportedUserId,
		conversation_id: conversationId,
		product_id: productId,
		report_type: reportType,
		reason_type: reasonType,
		status: 'pending',
		message: 'User report submitted successfully'
	}, 'success', 'User report submitted successfully', 201);
}

async function updateUserReportStatus(data) {
	const reportId = Number(data?.user_report_id || 0);
	const status = data?.status ? String(data.status) : null;

	if (!reportId || !status) {
		return sendPayload(null, 'error', 'User report ID and status are required', 400);
	}

	const validStatuses = ['pending', 'reviewed', 'action_taken'];
	if (!validStatuses.includes(status)) {
		return sendPayload(null, 'error', 'Invalid status. Must be: pending, reviewed, or action_taken', 400);
	}

	const existing = await query('SELECT user_report_id FROM user_reports WHERE user_report_id = ? LIMIT 1', [reportId]);
	if (!existing.length) {
		return sendPayload(null, 'error', 'User report not found', 404);
	}

	const result = await query('UPDATE user_reports SET status = ? WHERE user_report_id = ?', [status, reportId]);
	if (Number(result.affectedRows || 0) > 0) {
		return sendPayload({
			user_report_id: reportId,
			status,
			updated_at: nowIso()
		}, 'success', 'User report status updated successfully', 200);
	}

	return sendPayload(null, 'error', 'No changes made', 400);
}

async function updateReportStatus(data) {
	const reportId = Number(data?.report_id || 0);
	const status = data?.status ? String(data.status) : null;

	if (!reportId || !status) {
		return sendPayload(null, 'error', 'Report ID and status are required', 400);
	}

	const validStatuses = ['pending', 'reviewed', 'action_taken'];
	if (!validStatuses.includes(status)) {
		return sendPayload(null, 'error', 'Invalid status. Must be: pending, reviewed, or action_taken', 400);
	}

	const existing = await query('SELECT report_id FROM reports WHERE report_id = ? LIMIT 1', [reportId]);
	if (!existing.length) {
		return sendPayload(null, 'error', 'Report not found', 404);
	}

	const result = await query('UPDATE reports SET status = ?, reviewed_at = NOW() WHERE report_id = ?', [status, reportId]);
	if (Number(result.affectedRows || 0) > 0) {
		return sendPayload({
			report_id: reportId,
			status,
			updated_at: nowIso()
		}, 'success', 'Report status updated successfully', 200);
	}

	return sendPayload(null, 'error', 'No changes made', 400);
}

async function createConversation(data) {
	const productId = Number(data?.product_id || 0);
	const buyerId = Number(data?.buyer_id || 0);
	const sellerId = Number(data?.seller_id || 0);
	const autoResponseMessage = 'Hello! Thank you for your interest in this item. We appreciate your inquiry. Kindly wait while the seller reviews your message and responds shortly. Thank you for your patience!';

	if (!productId || !buyerId || !sellerId) {
		return sendPayload(null, 'error', 'Missing required fields: product_id, buyer_id, seller_id', 400);
	}

	const existing = await query(
		`SELECT conversation_id FROM conversations WHERE product_id = ? AND buyer_id = ? AND seller_id = ?`,
		[productId, buyerId, sellerId]
	);
	if (existing.length) {
		const convoId = Number(existing[0].conversation_id);
		const messageCountRows = await query('SELECT COUNT(*) as message_count FROM messages WHERE conversation_id = ?', [convoId]);
		if (Number(messageCountRows[0]?.message_count || 0) === 0) {
			await seedConversationIntro(convoId, productId, buyerId, sellerId, autoResponseMessage);
		}
		return sendPayload({ conversation_id: convoId, message: 'Conversation already exists' }, 'success', 'Conversation found', 200);
	}

	const result = await query(
		`INSERT INTO conversations (product_id, buyer_id, seller_id) VALUES (?, ?, ?)`,
		[productId, buyerId, sellerId]
	);
	const conversationId = Number(result.insertId || 0);
	await seedConversationIntro(conversationId, productId, buyerId, sellerId, autoResponseMessage);

	return sendPayload({
		conversation_id: conversationId,
		product_id: productId,
		buyer_id: buyerId,
		seller_id: sellerId
	}, 'success', 'Conversation created successfully', 201);
}

async function seedConversationIntro(conversationId, productId, buyerId, sellerId, autoResponseMessage) {
	const productRows = await query(
		`SELECT product_name, price, description, location, category, brand_name, custom_brand, for_type, \`condition\`
		FROM products WHERE product_id = ?`,
		[productId]
	);
	const buyerRows = await query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [buyerId]);
	const product = productRows[0];
	const buyer = buyerRows[0];
	if (!product || !buyer) return;

	const brandInfo = product.brand_name && product.brand_name !== 'no brand'
		? (product.brand_name === 'others' && product.custom_brand ? `Brand: ${product.custom_brand}` : `Brand: ${product.brand_name}`)
		: '';

	const initialMessage = `Hi! I'm interested in your ${product.product_name}.\n\nProduct Details:\nPrice: ${Number(product.price || 0).toFixed(2)}\nLocation: ${product.location}\nCondition: ${String(product.condition || '').charAt(0).toUpperCase()}${String(product.condition || '').slice(1)}${brandInfo ? `\n${brandInfo}` : ''}\nType: ${String(product.for_type || '').charAt(0).toUpperCase()}${String(product.for_type || '').slice(1)}\n\n${buyer.full_name}`;

	await query(
		`INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)`,
		[conversationId, buyerId, initialMessage]
	);

	await query(
		`INSERT INTO messages (conversation_id, sender_id, message_text) VALUES (?, ?, ?)`,
		[conversationId, sellerId, autoResponseMessage]
	);
}

async function sendMessage(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const senderId = data?.sender_id !== undefined ? Number(data.sender_id) : null;
	const messageText = String(data?.message_text || '');
	const attachments = Array.isArray(data?.attachments) ? data.attachments : [];

	if (!conversationId || senderId === null) {
		return sendPayload(null, 'error', 'Missing required fields: conversation_id, sender_id', 400);
	}

	if (!messageText && attachments.length === 0) {
		return sendPayload(null, 'error', 'Either message text or attachments must be provided', 400);
	}

	let conversation;
	if (senderId === 0) {
		const rows = await query('SELECT * FROM conversations WHERE conversation_id = ? LIMIT 1', [conversationId]);
		conversation = rows[0];
		if (!conversation) return sendPayload(null, 'error', 'Invalid conversation', 403);
	} else {
		const rows = await query(
			`SELECT * FROM conversations WHERE conversation_id = ? AND (buyer_id = ? OR seller_id = ?)`,
			[conversationId, senderId, senderId]
		);
		conversation = rows[0];
		if (!conversation) return sendPayload(null, 'error', 'Invalid conversation or unauthorized sender', 403);
	}

	const savedAttachments = [];
	const allowedTypes = new Set([
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'video/mp4',
		'video/webm',
		'video/ogg',
		'video/quicktime'
	]);
	for (const attachment of attachments) {
		const fileData = attachment?.file;
		const fileName = attachment?.name || 'attachment';
		const fileType = attachment?.type || '';
		if (!fileData || !fileName || !fileType) continue;
		if (!allowedTypes.has(String(fileType))) {
			return sendPayload(null, 'error', `Unsupported file type: ${fileType}`, 400);
		}
		if (!/^data:/.test(String(fileData))) continue;
		const saved = await saveBase64File(String(fileData), 'attachments', 'msg');
		if (saved) {
			savedAttachments.push({
				type: String(fileType).startsWith('image/') ? 'image' : 'video',
				path: saved,
				name: fileName,
				size: Buffer.from(String(fileData).split(',')[1] || '', 'base64').length
			});
		}
	}

	const attachmentsJson = savedAttachments.length ? JSON.stringify(savedAttachments) : null;
	const result = await query(
		`INSERT INTO messages (conversation_id, sender_id, message_text, attachments) VALUES (?, ?, ?, ?)`,
		[conversationId, senderId, messageText, attachmentsJson]
	);
	const messageId = Number(result.insertId || 0);

	if (senderId !== 0 && Number(conversation.buyer_id) === senderId) {
		const autoResponseMessage = 'Hello! Thank you for your interest in this item. We appreciate your inquiry. Kindly wait while the seller reviews your message and responds shortly. Thank you for your patience!';
		const checkRows = await query(
			`SELECT COUNT(*) as auto_count FROM messages WHERE conversation_id = ? AND message_text = ?`,
			[conversationId, autoResponseMessage]
		);
		if (Number(checkRows[0]?.auto_count || 0) === 0) {
			await query(
				`INSERT INTO messages (conversation_id, sender_id, message_text, created_at) VALUES (?, ?, ?, NOW())`,
				[conversationId, conversation.seller_id, autoResponseMessage]
			);
		}
	}

	let senderName = 'System';
	let senderAvatar = '';
	if (senderId !== 0) {
		const senderRows = await query('SELECT full_name, profile_image FROM users WHERE id = ? LIMIT 1', [senderId]);
		senderName = senderRows[0]?.full_name || '';
		senderAvatar = senderRows[0]?.profile_image || '';
	}

	const attachmentsWithUrls = savedAttachments.map((attachment) => ({
		...attachment,
			url: `${getPublicBaseUrl()}/${String(attachment.path).replace(/^\/+/, '')}`
	}));

	const recipientId = senderId === 0
		? Number(conversation.buyer_id)
		: (Number(conversation.buyer_id) === senderId ? Number(conversation.seller_id) : Number(conversation.buyer_id));

	return sendPayload({
		message_id: messageId,
		conversation_id: conversationId,
		sender_id: senderId,
		sender_name: senderName,
		sender_avatar: senderAvatar,
		message_text: messageText,
		attachments: attachmentsWithUrls,
		created_at: nowIso(),
		is_read: 0,
		recipient_id: recipientId
	}, 'success', 'Message sent successfully', 201);
}

async function markMessagesAsRead(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const userId = Number(data?.user_id || 0);
	if (!conversationId || !userId) {
		return sendPayload(null, 'error', 'Missing required fields: conversation_id, user_id', 400);
	}

	const result = await query(
		`UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
		[conversationId, userId]
	);

	return sendPayload({
		conversation_id: conversationId,
		messages_marked_read: Number(result.affectedRows || 0)
	}, 'success', 'Messages marked as read', 200);
}

async function archiveConversation(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const userId = Number(data?.user_id || 0);
	if (!conversationId || !userId) {
		return sendPayload(null, 'error', 'Conversation ID and User ID are required', 400);
	}

	const rows = await query('SELECT buyer_id, seller_id FROM conversations WHERE conversation_id = ? LIMIT 1', [conversationId]);
	const convo = rows[0];
	if (!convo) return sendPayload(null, 'error', 'Conversation not found', 404);

	let fieldToUpdate = null;
	if (Number(convo.buyer_id) === userId) fieldToUpdate = 'buyer_archived';
	if (Number(convo.seller_id) === userId) fieldToUpdate = 'seller_archived';
	if (!fieldToUpdate) return sendPayload(null, 'error', 'User is not part of this conversation', 403);

	const result = await query(`UPDATE conversations SET ${fieldToUpdate} = 1 WHERE conversation_id = ?`, [conversationId]);
	if (Number(result.affectedRows || 0) > 0) {
		return sendPayload({ conversation_id: conversationId, archived: true }, 'success', 'Conversation archived successfully', 200);
	}
	return sendPayload(null, 'error', 'Failed to archive conversation', 500);
}

async function restoreConversation(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const userId = Number(data?.user_id || 0);
	if (!conversationId || !userId) {
		return sendPayload(null, 'error', 'Conversation ID and User ID are required', 400);
	}

	const rows = await query('SELECT buyer_id, seller_id FROM conversations WHERE conversation_id = ? LIMIT 1', [conversationId]);
	const convo = rows[0];
	if (!convo) return sendPayload(null, 'error', 'Conversation not found', 404);

	let fieldToUpdate = null;
	if (Number(convo.buyer_id) === userId) fieldToUpdate = 'buyer_archived';
	if (Number(convo.seller_id) === userId) fieldToUpdate = 'seller_archived';
	if (!fieldToUpdate) return sendPayload(null, 'error', 'User is not part of this conversation', 403);

	const result = await query(`UPDATE conversations SET ${fieldToUpdate} = 0 WHERE conversation_id = ?`, [conversationId]);
	if (Number(result.affectedRows || 0) > 0) {
		return sendPayload({ conversation_id: conversationId, restored: true }, 'success', 'Conversation restored successfully', 200);
	}
	return sendPayload(null, 'error', 'Failed to restore conversation', 500);
}

async function deleteConversation(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const userId = Number(data?.user_id || 0);
	if (!conversationId || !userId) {
		return sendPayload(null, 'error', 'Conversation ID and User ID are required', 400);
	}

	const rows = await query('SELECT buyer_id, seller_id, buyer_deleted, seller_deleted FROM conversations WHERE conversation_id = ? LIMIT 1', [conversationId]);
	const convo = rows[0];
	if (!convo) return sendPayload(null, 'error', 'Conversation not found', 404);

	let fieldToUpdate = null;
	let otherDeleted = 0;
	if (Number(convo.buyer_id) === userId) {
		fieldToUpdate = 'buyer_deleted';
		otherDeleted = Number(convo.seller_deleted || 0);
	} else if (Number(convo.seller_id) === userId) {
		fieldToUpdate = 'seller_deleted';
		otherDeleted = Number(convo.buyer_deleted || 0);
	} else {
		return sendPayload(null, 'error', 'User is not part of this conversation', 403);
	}

	const result = await query(`UPDATE conversations SET ${fieldToUpdate} = 1 WHERE conversation_id = ?`, [conversationId]);
	if (Number(result.affectedRows || 0) === 0) {
		return sendPayload(null, 'error', 'Failed to delete conversation', 500);
	}

	let permanentlyDeleted = false;
	if (otherDeleted === 1) {
		await query('DELETE FROM conversations WHERE conversation_id = ?', [conversationId]);
		await query('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
		permanentlyDeleted = true;
	}

	return sendPayload({
		conversation_id: conversationId,
		deleted: true,
		permanently_deleted: permanentlyDeleted
	}, 'success', permanentlyDeleted ? 'Conversation permanently deleted' : 'Conversation deleted successfully', 200);
}

async function submitRating(data) {
	const conversationId = Number(data?.conversation_id || 0);
	const ratedBy = Number(data?.rated_by || 0);
	const ratedUserId = Number(data?.rated_user_id || 0);
	const productId = data?.product_id ? Number(data.product_id) : null;
	const communicationRating = Number(data?.communication_rating || 0);
	const productRating = Number(data?.product_rating || 0);
	const appRating = Number(data?.app_help_rating || 0);
	const feedback = data?.feedback ? String(data.feedback).trim() : null;

	// Validate required fields
	if (!conversationId || !ratedBy || !ratedUserId || !communicationRating || !productRating || !appRating) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	// Validate rating values (1-5)
	if (communicationRating < 1 || communicationRating > 5 ||
	    productRating < 1 || productRating > 5 ||
	    appRating < 1 || appRating > 5) {
		return sendPayload(null, 'error', 'Rating values must be between 1 and 5', 400);
	}

	// Check if user has already rated this conversation
	const checkRows = await query(
		'SELECT rating_id FROM ratings WHERE conversation_id = ? AND rated_by = ? LIMIT 1',
		[conversationId, ratedBy]
	);
	if (checkRows.length > 0) {
		return sendPayload(null, 'error', 'You have already rated this conversation', 409);
	}

	// Verify conversation exists and user is a participant
	const convRows = await query(
		'SELECT buyer_id, seller_id FROM conversations WHERE conversation_id = ? LIMIT 1',
		[conversationId]
	);
	if (!convRows.length) {
		return sendPayload(null, 'error', 'Conversation not found', 404);
	}
	const conversation = convRows[0];
	const isBuyer = Number(conversation.buyer_id) === ratedBy;
	const isSeller = Number(conversation.seller_id) === ratedBy;
	if (!isBuyer && !isSeller) {
		return sendPayload(null, 'error', 'User is not part of this conversation', 403);
	}

	// Insert rating
	const result = await query(
		`INSERT INTO ratings (conversation_id, rated_by, rated_user_id, product_id,
		                       communication_rating, product_rating, app_help_rating, feedback, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		[conversationId, ratedBy, ratedUserId, productId, communicationRating, productRating, appRating, feedback]
	);

	const ratingId = Number(result.insertId || 0);
	return sendPayload({
		rating_id: ratingId,
		conversation_id: conversationId,
		rated_by: ratedBy,
		rated_user_id: ratedUserId
	}, 'success', 'Rating submitted successfully', 200);
}

async function approveProduct(data) {
	const productId = Number(data?.product_id || 0);
	let adminId = Number(data?.admin_id || 0);
	const adminRole = normalizeRoleName(data?.admin_role);
	const adminEmail = String(data?.admin_email || '').trim().toLowerCase();

	// If admin_id is missing but we have an admin email (moderator logged in via user JWT),
	// try to resolve the admin_id by email from the admins table.
	if (!adminId && adminEmail) {
		const rows = await query('SELECT admin_id FROM admins WHERE LOWER(email) = ? LIMIT 1', [adminEmail]);
		if (rows && rows[0] && rows[0].admin_id) {
			adminId = Number(rows[0].admin_id || 0);
		}
	}

 	if (!productId || !adminId || !adminRole) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (!['super admin', 'moderator', 'admin'].includes(adminRole)) {
		return sendPayload(null, 'error', 'Unauthorized access', 403);
	}

	const result = await query(
		`UPDATE products
		SET approval_status = 'approved', approved_by = ?, approval_date = NOW(), status = 'active'
		WHERE product_id = ?`,
		[adminId, productId]
	);

	if (Number(result.affectedRows || 0) === 0) {
		return sendPayload(null, 'error', 'Product not found', 404);
	}

	const productRows = await query('SELECT product_name, uploader_id FROM products WHERE product_id = ? LIMIT 1', [productId]);
	const adminRows = await query('SELECT full_name FROM admins WHERE admin_id = ? LIMIT 1', [adminId]);
	const product = productRows[0];
	const admin = adminRows[0];
	if (product) {
		await createUserNotification(
			product.uploader_id,
			'listing approved',
			'Listing Approved',
			`Your listing '${product.product_name}' has been approved by ${admin?.full_name || 'Admin'} and is now live!`,
			productId
		);
	}

	return sendPayload({ message: 'Product approved successfully' }, 'success', 'Product approved successfully', 200);
}

async function rejectProduct(data) {
	const productId = Number(data?.product_id || 0);
	let adminId = Number(data?.admin_id || 0);
	const adminRole = normalizeRoleName(data?.admin_role);
	const adminEmail = String(data?.admin_email || '').trim().toLowerCase();
	const rejectionReason = String(data?.rejection_reason || '').trim();

	// Attempt to resolve admin_id from admin_email when missing
	if (!adminId && adminEmail) {
		const rows = await query('SELECT admin_id FROM admins WHERE LOWER(email) = ? LIMIT 1', [adminEmail]);
		if (rows && rows[0] && rows[0].admin_id) {
			adminId = Number(rows[0].admin_id || 0);
		}
	}

	if (!productId || !adminId || !adminRole || !rejectionReason) {
		return sendPayload(null, 'error', 'Missing required fields', 400);
	}

	if (!['super admin', 'moderator', 'admin'].includes(adminRole)) {
		return sendPayload(null, 'error', 'Unauthorized access', 403);
	}

	return withTransaction(async (connection) => {
		const updateResult = await txQuery(
			connection,
			`UPDATE products
			SET approval_status = 'rejected', approved_by = ?, approval_date = NOW(), rejection_reason = ?, status = 'inactive'
			WHERE product_id = ?`,
			[adminId, rejectionReason, productId]
		);

		if (Number(updateResult.affectedRows || 0) === 0) {
			return sendPayload(null, 'error', 'Product not found', 404);
		}

		const productRows = await txQuery(connection, 'SELECT product_name, uploader_id FROM products WHERE product_id = ? LIMIT 1', [productId]);
		const adminRows = await txQuery(connection, 'SELECT full_name FROM admins WHERE admin_id = ? LIMIT 1', [adminId]);
		const product = productRows[0];
		const admin = adminRows[0];
		if (product) {
			await createUserNotification(
				product.uploader_id,
				'listing_rejected',
				'Listing Rejected',
				`Your listing '${product.product_name}' was rejected by ${admin?.full_name || 'Admin'}.\n\nReason: ${rejectionReason}`,
				productId,
				connection
			);
		}

		return sendPayload({ message: 'Product rejected successfully', violation_tracked: false }, 'success', 'Product rejected successfully', 200);
	});
}

router.get('/health', async (_req, res) => {
	respond(res, sendPayload({
		status: 'success',
		message: 'API is running',
		timestamp: nowIso(),
		database: 'connected'
	}, 'success', 'API is running', 200));
});

router.get('/:endpoint', async (req, res) => {
	const endpoint = req.params.endpoint;

	try {
		switch (endpoint) {
			case 'user': {
				const id = Number(req.query.id);
				if (!id) return respond(res, sendPayload([], 'error', 'Missing ID', 400));
				const rows = await getUserById(id);
				return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
			}
			case 'all-users': {
				const rows = await getAllUsers();
				return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
			}
			case 'products': {
				if (req.query.uploader_id) {
					const rows = await getProductsByUser(Number(req.query.uploader_id));
					rows.forEach((row) => {
						row.specifications = normalizeSpecifications(row.specifications);
					});
					return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
				}
				if (req.query.product_id) {
					const rows = await getProductById(Number(req.query.product_id));
					rows.forEach((row) => {
						row.specifications = normalizeSpecifications(row.specifications);
					});
					return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
				}
				return respond(res, sendPayload([], 'error', 'Missing uploader_id or product_id', 400));
			}
			case 'purchased-products': {
				const buyerId = Number(req.query.buyer_id);
				if (!buyerId) return respond(res, sendPayload([], 'error', 'Missing buyer_id', 400));
				const rows = await getProductsBoughtByUser(buyerId);
				rows.forEach((row) => {
					row.specifications = normalizeSpecifications(row.specifications);
				});
				return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
			}
			case 'all-products': {
				const rows = await getAllActiveProducts();
				rows.forEach((row) => {
					row.specifications = normalizeSpecifications(row.specifications);
				});
				return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
			}
			case 'admin-products': {
				const rows = await getAllProductsForAdmin();
				rows.forEach((row) => {
					row.specifications = normalizeSpecifications(row.specifications);
				});
				return respond(res, sendPayload(rows, rows.length ? 'success' : 'error', rows.length ? '' : 'No records found', rows.length ? 200 : 404));
			}
			case 'user-restriction': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const restriction = await checkUserRestriction(userId);
				return respond(res, sendPayload(restriction, 'success', 'Restriction status loaded', 200));
			}
			case 'user-violation-details': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload(null, 'error', 'Missing user_id', 400));
				const payload = await getUserViolationDetails(userId);
				return respond(res, payload);
			}
			case 'admin-notifications': {
				const adminId = Number(req.query.admin_id);
				const limit = Number(req.query.limit || 50);
				if (!adminId) return respond(res, sendPayload([], 'error', 'Missing admin_id', 400));
				const rows = await getAdminNotifications(adminId, limit);
				return respond(res, rowsPayload(rows));
			}
			case 'notification-counts': {
				const adminId = Number(req.query.admin_id);
				if (!adminId) return respond(res, sendPayload(null, 'error', 'Missing admin_id', 400));
				const data = await getNotificationCountsForAdmin(adminId);
				return respond(res, sendPayload(data, 'success', 'Notification counts loaded', 200));
			}
			case 'dashboard-stats': {
				const data = await getDashboardStats();
				return respond(res, sendPayload(data, 'success', 'Dashboard stats loaded', 200));
			}
			case 'chart-data': {
				const data = await getChartData();
				return respond(res, sendPayload(data, 'success', 'Chart data loaded', 200));
			}
			case 'all-admins': {
				const rows = await getAllAdmins();
				return respond(res, rowsPayload(rows));
			}
			case 'admin': {
				const adminId = Number(req.query.admin_id);
				if (!adminId) return respond(res, sendPayload([], 'error', 'Missing admin_id', 400));
				const rows = await getAdminById(adminId);
				return respond(res, rowsPayload(rows));
			}
			case 'moderator-applications': {
				const status = req.query.status ? String(req.query.status) : null;
				const rows = await getAllModeratorApplications(status);
				return respond(res, rowsPayload(rows));
			}
			case 'moderator-application': {
				if (req.query.application_id) {
					const rows = await getModeratorApplicationById(Number(req.query.application_id));
					return respond(res, rowsPayload(rows));
				}
				if (req.query.user_id) {
					const rows = await getUserModeratorApplication(Number(req.query.user_id));
					return respond(res, rowsPayload(rows));
				}
				return respond(res, sendPayload([], 'error', 'Missing application_id or user_id', 400));
			}
			case 'pending-moderator-applications-count': {
				const count = await getPendingModeratorApplicationsCount();
				return respond(res, sendPayload({ count }, 'success', 'Pending count loaded', 200));
			}
			case 'conversations': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserConversations(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'archived-conversations': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserArchivedConversations(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'messages': {
				const conversationId = Number(req.query.conversation_id);
				if (!conversationId) return respond(res, sendPayload([], 'error', 'Missing conversation_id', 400));
				const rows = await getConversationMessages(conversationId);
				return respond(res, rowsPayload(rows));
			}
			case 'user-reports': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserReportsByReporter(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'all-reports': {
				const rows = await getAllReports();
				return respond(res, rowsPayload(rows));
			}
			case 'all-user-reports': {
				const rows = await getAllUserReports();
				return respond(res, rowsPayload(rows));
			}
			case 'user-ratings': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserRatings(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'conversation-rating': {
				const conversationId = Number(req.query.conversation_id);
				const ratedBy = Number(req.query.rated_by);
				if (!conversationId || !ratedBy) return respond(res, sendPayload([], 'error', 'Missing conversation_id or rated_by', 400));
				const rows = await getConversationRating(conversationId, ratedBy);
				return respond(res, rowsPayload(rows));
			}
			case 'user-average-ratings': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserAverageRatings(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'sellers-with-ratings': {
				const rows = await getAllSellersWithRatings();
				return respond(res, rowsPayload(rows));
			}
			case 'product-specifications': {
				const productId = Number(req.query.product_id);
				if (!productId) return respond(res, sendPayload([], 'error', 'Missing product_id', 400));
				const rows = await getProductSpecificationsByProductId(productId);
				return respond(res, rowsPayload(rows));
			}
			case 'product-buyer': {
				const productId = Number(req.query.product_id);
				if (!productId) return respond(res, sendPayload(null, 'error', 'Missing product_id', 400));
				const buyer = await getProductBuyer(productId);
				if (!buyer) return respond(res, sendPayload(null, 'error', 'No buyer found for this product', 404));
				return respond(res, sendPayload(buyer, 'success', 'Buyer details retrieved', 200));
			}
			case 'user-notifications': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload([], 'error', 'Missing user_id', 400));
				const rows = await getUserNotifications(userId);
				return respond(res, rowsPayload(rows));
			}
			case 'unread-counts': {
				const userId = Number(req.query.user_id);
				if (!userId) return respond(res, sendPayload(null, 'error', 'Missing user_id', 400));
				const data = await getUnreadCounts(userId);
				return respond(res, sendPayload(data, 'success', 'Unread counts loaded', 200));
			}
			case 'recent-activities': {
				const limit = req.query.limit ? Number(req.query.limit) : 50;
				const startDate = req.query.start_date ? String(req.query.start_date) : null;
				const endDate = req.query.end_date ? String(req.query.end_date) : null;
				const result = await getRecentActivities(limit, startDate, endDate);
				if (result.error) return respond(res, result.error);
				return respond(res, sendPayload(result.data, 'success', 'Recent activities loaded', 200));
			}
			case 'pending-products': {
				const rows = await getPendingProducts();
				return respond(res, rowsPayload(rows));
			}
			case 'listing-auto-approval-config': {
				const payload = await getListingAutoApprovalConfig();
				return respond(res, payload);
			}
			case 'bicycle-brands': {
				const rows = await getBicycleBrands();
				return respond(res, rowsPayload(rows));
			}
			case 'bicycle-parts': {
				const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
				const rows = await getBicyclePartsByBrand(brandId);
				return respond(res, rowsPayload(rows));
			}
			case 'part-specifications': {
				const partId = Number(req.query.part_id);
				if (!partId) return respond(res, sendPayload([], 'error', 'Missing part_id', 400));
				const rows = await getPartSpecifications(partId);
				return respond(res, rowsPayload(rows));
			}
			case 'check-expired-reservations': {
				const data = await checkExpiredReservations();
				return respond(res, sendPayload(data, 'success', 'Reservation expiry check complete', 200));
			}
			case 'landing-visit-counter': {
				const action = String(req.query.action || 'get');
				const payload = await getLandingVisitCounter(action);
				return respond(res, payload);
			}
			default:
				return respond(res, sendPayload(null, 'error', 'Forbidden', 403));
		}
	} catch (error) {
		return respond(res, sendPayload(null, 'error', error.message || 'Server error', 500));
	}
});

router.post('/:endpoint/:action?', async (req, res) => {
	const endpoint = req.params.endpoint;
	const action = req.params.action;

	if (!applyAuthGuards(req, res, endpoint, action)) return;

	try {
		switch (endpoint) {
			case 'register': {
				const data = req.body || {};
				const fullName = data.full_name || '';
				const email = data.email || '';
				const password = data.password || '';
				const phone = data.phone || '';
				const street = data.street || '';
				const barangay = data.barangay || '';
				const termsAccepted = Number(data.terms_accepted || 0);

				if (!fullName || !email || !password || !phone || !street || !barangay) {
					return respond(res, sendPayload(null, 'error', 'All fields are required', 400));
				}
				if (!barangays.includes(barangay)) {
					return respond(res, sendPayload(null, 'error', 'Invalid barangay. Please select a valid barangay from Olongapo City.', 400));
				}
				if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
					return respond(res, sendPayload(null, 'error', 'Invalid email format', 400));
				}

				const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
				if (existing.length) {
					return respond(res, sendPayload(null, 'error', 'Email already registered', 409));
				}

				const hashedPassword = await bcrypt.hash(password, 10);
				const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
				const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

				const insertSql = `INSERT INTO users (full_name, email, password, phone, street, barangay, city, terms_accepted,
					verification_token, token_expires_at, is_verified)
					VALUES (?, ?, ?, ?, ?, ?, 'Olongapo City', ?, ?, ?, 0)`;
				const result = await query(insertSql, [
					fullName,
					email,
					hashedPassword,
					phone,
					street,
					barangay,
					termsAccepted,
					verificationToken,
					tokenExpiresAt
				]);

				const verificationUrl = `${getFrontendUrl()}/email-verification?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
				const emailBody = buildVerificationEmail({ recipientName: fullName, verificationUrl });
				const emailResult = await sendEmail({
					to: email,
					name: fullName,
					subject: 'Verify Your CycleMart Account',
					html: emailBody.html,
					text: emailBody.text
				});

				return respond(res, sendPayload({
					userID: result.insertId,
					email,
					full_name: fullName,
					city: 'Olongapo City',
					barangay,
					verification_email_sent: emailResult.status === 'success'
				}, emailResult.status === 'success' ? 'success' : 'warning',
				emailResult.status === 'success'
					? 'Registration successful! Please check your email to verify your account.'
					: 'Registration successful but verification email failed to send. Please contact support.',
				201));
			}
			case 'login': {
				const { email, password } = req.body || {};
				if (!email || !password) {
					return respond(res, sendPayload(null, 'error', 'Email and password required', 400));
				}

				const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
				const user = rows[0];
				if (!user || !(await bcrypt.compare(password, user.password))) {
					return respond(res, sendPayload(null, 'error', 'Invalid credentials', 401));
				}

				if (!user.is_verified) {
					return respond(res, sendPayload({ email: user.email, requires_verification: true }, 'error',
						'Please verify your email address before logging in.', 403));
				}

				if (user.account_status === 'banned') {
					return respond(res, sendPayload({
						banned: true,
						account_status: 'banned',
						violation_count: user.violation_count
					}, 'error', 'Your account has been permanently banned due to multiple violations. Please contact support.', 403));
				}

				const payload = {
					iss: 'http://example.org',
					aud: 'http://example.com',
					iat: Math.floor(Date.now() / 1000),
					exp: Math.floor(Date.now() / 1000) + 3600,
					uid: user.id,
					role: user.role || 'user',
					email: user.email
				};

				const token = jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' });

				return respond(res, sendPayload({
					token,
					userID: user.id,
					email: user.email,
					role: user.role || 'user',
					full_name: user.full_name,
					phone: user.phone,
					street: user.street,
					barangay: user.barangay,
					city: user.city,
					profile_image: user.profile_image,
					is_verified: user.is_verified,
					account_status: user.account_status,
					violation_count: user.violation_count
				}, 'success', 'Login successful', 200));
			}
			case 'verify-email': {
				const { token } = req.body || {};
				if (!token) return respond(res, sendPayload(null, 'error', 'Verification token is required', 400));

				const rows = await query('SELECT id, email, full_name, is_verified, token_expires_at FROM users WHERE verification_token = ?', [token]);
				const user = rows[0];
				if (!user) return respond(res, sendPayload(null, 'error', 'Invalid verification token', 400));

				if (user.is_verified) {
					return respond(res, sendPayload({
						userID: user.id,
						email: user.email,
						full_name: user.full_name,
						verified: true
					}, 'success', 'Your account is already verified! You can login to your account.', 200));
				}

				if (user.token_expires_at && new Date(user.token_expires_at) < new Date()) {
					return respond(res, sendPayload(null, 'error', 'Verification token has expired', 400));
				}

				await query('UPDATE users SET is_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = ?', [user.id]);
				return respond(res, sendPayload({
					userID: user.id,
					email: user.email,
					full_name: user.full_name,
					verified: true
				}, 'success', 'Email verified successfully! You can now login to your account.', 200));
			}
			case 'resend-verification': {
				const { email } = req.body || {};
				if (!email) return respond(res, sendPayload(null, 'error', 'Email is required', 400));
				if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
					return respond(res, sendPayload(null, 'error', 'Invalid email format', 400));
				}

				const rows = await query('SELECT id, full_name, is_verified FROM users WHERE email = ?', [email]);
				const user = rows[0];
				if (!user) return respond(res, sendPayload(null, 'error', 'User not found', 404));
				if (user.is_verified) {
					return respond(res, sendPayload({ email, full_name: user.full_name, verified: true }, 'success', 'Your account is already verified! You can login to your account.', 200));
				}

				const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
				const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
				await query('UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?', [verificationToken, tokenExpiresAt, user.id]);

				const verificationUrl = `${getFrontendUrl()}/email-verification?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;
				const emailBody = buildVerificationEmail({ recipientName: user.full_name, verificationUrl });
				const emailResult = await sendEmail({
					to: email,
					name: user.full_name,
					subject: 'Verify Your CycleMart Account',
					html: emailBody.html,
					text: emailBody.text
				});

				if (emailResult.status === 'success') {
					return respond(res, sendPayload({ email, message: 'Verification email sent' }, 'success', 'Verification email sent successfully! Please check your inbox.', 200));
				}

				return respond(res, sendPayload(null, 'error', 'Failed to send verification email', 500));
			}
			case 'admin': {
				if (action === 'login') {
					const { username, password } = req.body || {};
					if (!username || !password) {
						return respond(res, sendPayload(null, 'error', 'Username and password required', 400));
					}
					const rows = await query('SELECT * FROM admins WHERE username = ?', [username]);
					const admin = rows[0];
					if (!admin || !(await bcrypt.compare(password, admin.password))) {
						return respond(res, sendPayload(null, 'error', 'Invalid admin credentials', 401));
					}
					const payload = {
						iss: 'http://example.org',
						aud: 'http://example.com',
						iat: Math.floor(Date.now() / 1000),
						exp: Math.floor(Date.now() / 1000) + 3600,
						admin_id: admin.admin_id,
						role: admin.role || 'admin',
						username: admin.username
					};
					const token = jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256' });
					return respond(res, sendPayload({
						token,
						user: {
							id: admin.admin_id,
							username: admin.username,
							email: admin.email || '',
							role: admin.role || 'admin',
							full_name: admin.full_name || '',
							status: admin.status || undefined,
							created_at: admin.created_at || undefined
						}
					}, 'success', 'Admin login successful', 200));
				}

				if (action === 'create') {
					const payload = await createAdmin({
						...(req.body || {}),
						created_by_role: req.jwt?.role || req.body?.created_by_role
					});
					return respond(res, payload);
				}

				if (action === 'update') {
					const payload = await updateAdmin({
						...(req.body || {}),
						updated_by_role: req.jwt?.role || req.body?.updated_by_role,
						updated_by_id: req.jwt?.admin_id || req.jwt?.uid || req.body?.updated_by_id
					});
					return respond(res, payload);
				}

				if (action === 'delete') {
					const payload = await deleteAdmin({
						...(req.body || {}),
						deleted_by_role: req.jwt?.role || req.body?.deleted_by_role,
						deleted_by_id: req.jwt?.admin_id || req.jwt?.uid || req.body?.deleted_by_id
					});
					return respond(res, payload);
				}

				return notImplemented(res, `admin/${action || ''}`);
			}
			case 'addProduct': {
				const data = req.body || {};
				const productName = data.product_name || '';
				const price = Number(data.price || 0);
				const description = data.description || '';
				const location = data.location || '';
				const forType = data.for_type || 'sale';
				const condition = data.condition || 'second hand';
				const category = data.category || 'others';
				const quantity = Number(data.quantity || 1);
				const uploaderId = Number(data.uploader_id || 0);
				const brandName = data.brand_name || 'no brand';
				const customBrand = brandName === 'others' ? data.custom_brand || null : null;
				const bicycleBrandId = data.bicycle_brand_id ?? null;
				const bicyclePartId = data.bicycle_part_id ?? null;

				if (!productName || !price || !description || !location || !uploaderId) {
					return respond(res, sendPayload(null, 'error', 'Missing required fields', 400));
				}

				const restrictionCheck = await checkUserRestriction(uploaderId);
				if (restrictionCheck.is_restricted) {
					const reason = restrictionCheck.reason || 'Account restricted.';
					return respond(res, sendPayload(null, 'error', `You are currently restricted from creating new listings. Reason: ${reason}`, 403));
				}

				const productImages = parseJson(data.product_images, []);
				const productVideos = parseJson(data.product_videos, []);
				const savedImages = [];
				for (const image of productImages) {
					const saved = await saveBase64File(image, '', 'prod');
					if (saved) savedImages.push(saved);
				}

				const savedVideos = [];
				for (const video of productVideos) {
					const saved = await saveBase64File(video, 'videos', 'video');
					if (saved) savedVideos.push(saved);
				}

				const specs = Array.isArray(data.specifications) ? data.specifications : [];
				const processedSpecs = specs
					.map((spec) => ({
						name: spec.spec_name || spec.name || '',
						value: spec.spec_value || spec.value || ''
					}))
					.filter((spec) => spec.name && spec.value);

				const sql = `INSERT INTO products (product_name, brand_name, custom_brand, bicycle_brand_id, bicycle_part_id,
					product_images, product_videos, price, description, location, for_type, \`condition\`, category, quantity,
					status, sale_status, approval_status, uploader_id, specifications)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive', 'available', 'pending', ?, ?)`;

				const result = await query(sql, [
					productName,
					brandName,
					customBrand,
					bicycleBrandId,
					bicyclePartId,
					JSON.stringify(savedImages),
					JSON.stringify(savedVideos),
					price,
					description,
					location,
					forType,
					condition,
					category,
					quantity,
					uploaderId,
					JSON.stringify(processedSpecs)
				]);

				// If listing auto-approval is enabled, immediately approve the newly created product
				try {
					const autoEnabled = await isListingAutoApprovalEnabled();
					if (autoEnabled && result?.insertId) {
						// Fetch inserted product for server-side review
						const prodRowsBefore = await query('SELECT product_id, product_name, brand_name, custom_brand, bicycle_brand_id, bicycle_part_id, product_images, price, description, location, for_type, `condition`, category, quantity, specifications FROM products WHERE product_id = ? LIMIT 1', [result.insertId]);
						const prodBefore = prodRowsBefore[0] || null;
						let serverFailures = [];
						if (prodBefore) {
							try {
								prodBefore.product_images = prodBefore.product_images ? JSON.parse(prodBefore.product_images || '[]') : [];
								prodBefore.specifications = prodBefore.specifications ? (Array.isArray(prodBefore.specifications) ? prodBefore.specifications : JSON.parse(prodBefore.specifications || '[]')) : [];
								serverFailures = serverEvaluatePendingReasons(prodBefore);
							} catch (e) {
								console.error('Error parsing product for server evaluation', e && e.message);
							}
						}
						if (serverFailures.length === 0) {
							await query(`UPDATE products
								SET approval_status = 'approved', approved_by = 0, approval_date = NOW(), status = 'active'
								WHERE product_id = ?`, [result.insertId]);
							// insert audit row
							try {
								await insertAutoApprovalAudit(result.insertId, 'auto-approved by config', { method: 'addProduct', reasons: [] });
							} catch (e) {
								console.error('Failed to insert auto-approval audit', e && e.message);
							}
							// notify uploader
							try {
								const prodRows = await query('SELECT product_name, uploader_id FROM products WHERE product_id = ? LIMIT 1', [result.insertId]);
								const prod = prodRows[0];
								if (prod) {
									await createUserNotification(
										prod.uploader_id,
										'listing approved',
										'Listing Approved',
										`Your listing '${prod.product_name}' was automatically approved and is now live.`,
										result.insertId
									);
								}
							} catch (e) {
								console.error('Auto-approval notification failed', e && e.message);
							}
						} else {
							// record audit that auto-approval was skipped due to server evaluation
							try {
								await insertAutoApprovalAudit(result.insertId, 'auto-approval-skip', { method: 'addProduct', reasons: serverFailures });
							} catch (e) {
								console.error('Failed to insert auto-approval audit (skip)', e && e.message);
							}
							// notify uploader with reasons why the listing remains pending
							try {
								const prodRows2 = await query('SELECT product_name, uploader_id FROM products WHERE product_id = ? LIMIT 1', [result.insertId]);
								const prod2 = prodRows2[0];
								if (prod2) {
									const reasonText = Array.isArray(serverFailures) ? serverFailures.join('; ') : String(serverFailures || '');
									await createUserNotification(
										prod2.uploader_id,
										'Listing Pending Review',
										'Your listing is still pending review',
										`Your listing '${prod2.product_name}' is still pending admin review because: ${reasonText}. Please update your listing to address these issues.`,
										result.insertId
									);
								}
							} catch (e) {
								console.error('Auto-approval skip notification failed', e && e.message);
							}
						}
					}
				} catch (e) {
					console.error('Error checking auto-approval config:', e && e.message);
				}

				return respond(res, sendPayload({
					product_id: result.insertId,
					product_name: productName,
					price,
					description,
					location,
					for_type: forType,
					condition,
					category,
					images: savedImages,
					videos: savedVideos,
					approval_status: 'pending'
				}, 'success', 'Product submitted successfully! Your listing is pending admin approval.', 201));
			}
			case 'upload': {
				const payload = await uploadProfile(req.body || {});
				return respond(res, payload);
			}
			case 'editprofile': {
				const payload = await editProfile(req.body || {});
				return respond(res, payload);
			}
			case 'submitForApproval': {
				const payload = await submitForApproval(req.body || {});
				return respond(res, payload);
			}
			case 'listing-auto-approval-config': {
				const payload = await updateListingAutoApprovalConfig({
					...(req.body || {}),
					admin_id: req.jwt?.admin_id || req.body?.admin_id,
					admin_role: req.jwt?.role || req.body?.admin_role
				});
				return respond(res, payload);
			}
			case 'markNotificationAsRead': {
				const payload = await markNotificationAsRead({
					...(req.body || {}),
					admin_id: req.jwt?.admin_id || req.body?.admin_id
				});
				return respond(res, payload);
			}
			case 'moderator-application': {
				if (action === 'submit') {
					const payload = await submitModeratorApplication(req.body || {});
					return respond(res, payload);
				}
				if (action === 'review') {
					const payload = await reviewModeratorApplication({
						...(req.body || {}),
						reviewed_by: req.jwt?.admin_id || req.body?.reviewed_by
					});
					return respond(res, payload);
				}
				return respond(res, sendPayload(null, 'error', 'Invalid moderator-application action', 400));
			}
			case 'markUserNotificationAsRead': {
				const payload = await markUserNotificationAsRead(req.body || {});
				return respond(res, payload);
			}
			case 'markAllUserNotificationsAsRead': {
				const payload = await markAllUserNotificationsAsRead(req.body || {});
				return respond(res, payload);
			}
			case 'deleteUserNotification': {
				const payload = await deleteUserNotification(req.body || {});
				return respond(res, payload);
			}
			case 'mark-user-violation': {
				const payload = await markUserViolation(req.body || {});
				return respond(res, payload);
			}
			case 'archiveProduct': {
				const payload = await archiveProduct({
					...(req.body || {}),
					admin_id: req.jwt?.admin_id || req.body?.admin_id,
					admin_role: req.jwt?.role || req.body?.admin_role
				});
				return respond(res, payload);
			}
			case 'reserve-product': {
				const payload = await reserveProduct(req.body || {});
				return respond(res, payload);
			}
			case 'cancel-reservation': {
				const payload = await cancelReservation(req.body || {});
				return respond(res, payload);
			}
			case 'check-expired-reservations': {
				const result = await checkExpiredReservations();
				return respond(res, sendPayload(result, 'success', 'Reservation expiry check complete', 200));
			}
			case 'reservation-details': {
				const payload = await getReservationDetails(req.body || {});
				return respond(res, payload);
			}
			case 'reservation-history': {
				const payload = await getReservationHistory(req.body || {});
				return respond(res, payload);
			}
			case 'updateProduct': {
				const payload = await updateProduct(req.body || {});
				return respond(res, payload);
			}
			case 'deleteProduct': {
				const payload = await deleteProductByOwner(req.body || {});
				return respond(res, payload);
			}
			case 'updateSaleStatus': {
				const payload = await updateSaleStatus(req.body || {});
				return respond(res, payload);
			}
			case 'submit-report': {
				const reporterId = Number(req.body?.reporter_id || 0);
				if (reporterId) {
					const restrictionCheck = await checkUserRestriction(reporterId);
					if (restrictionCheck.is_restricted) {
						return respond(res, sendPayload(null, 'error', `You are currently restricted from submitting reports. Reason: ${restrictionCheck.reason || 'Account restricted.'}`, 403));
					}
				}
				const payload = await submitReport(req.body || {});
				return respond(res, payload);
			}
			case 'submit-user-report': {
				const reporterId = Number(req.body?.reporter_id || 0);
				if (reporterId) {
					const restrictionCheck = await checkUserRestriction(reporterId);
					if (restrictionCheck.is_restricted) {
						return respond(res, sendPayload(null, 'error', `You are currently restricted from submitting reports. Reason: ${restrictionCheck.reason || 'Account restricted.'}`, 403));
					}
				}
				const payload = await submitUserReport(req.body || {});
				return respond(res, payload);
			}
			case 'update-report-status': {
				const payload = await updateReportStatus(req.body || {});
				return respond(res, payload);
			}
			case 'update-user-report-status': {
				const payload = await updateUserReportStatus(req.body || {});
				return respond(res, payload);
			}
			case 'create-conversation': {
				const payload = await createConversation(req.body || {});
				return respond(res, payload);
			}
			case 'send-message': {
				const senderId = Number(req.body?.sender_id || 0);
				if (senderId) {
					const restrictionCheck = await checkUserRestriction(senderId);
					if (restrictionCheck.is_restricted) {
						return respond(res, sendPayload(null, 'error', `You are currently restricted from sending messages. Reason: ${restrictionCheck.reason || 'Account restricted.'}`, 403));
					}
				}
				const payload = await sendMessage(req.body || {});
				return respond(res, payload);
			}
			case 'mark-messages-read': {
				const payload = await markMessagesAsRead(req.body || {});
				return respond(res, payload);
			}
			case 'archive-conversation': {
				const payload = await archiveConversation(req.body || {});
				return respond(res, payload);
			}
			case 'restore-conversation': {
				const payload = await restoreConversation(req.body || {});
				return respond(res, payload);
			}
			case 'delete-conversation': {
				const payload = await deleteConversation(req.body || {});
				return respond(res, payload);
			}
			case 'approve-product': {
				const payload = await approveProduct({
					...(req.body || {}),
					admin_id: req.jwt?.admin_id || req.body?.admin_id,
					admin_role: req.jwt?.role || req.body?.admin_role,
					admin_email: req.jwt?.email || req.body?.admin_email
				});
				return respond(res, payload);
			}
			case 'reject-product': {
				const payload = await rejectProduct({
					...(req.body || {}),
					admin_id: req.jwt?.admin_id || req.body?.admin_id,
					admin_role: req.jwt?.role || req.body?.admin_role,
					admin_email: req.jwt?.email || req.body?.admin_email
				});
				return respond(res, payload);
			}
			case 'submit-rating': {
				const payload = await submitRating(req.body || {});
				return respond(res, payload);
			}
			default:
				return respond(res, sendPayload(null, 'error', 'Forbidden', 403));
		}
	} catch (error) {
		return respond(res, sendPayload(null, 'error', error.message || 'Server error', 500));
	}
});

export default router;
