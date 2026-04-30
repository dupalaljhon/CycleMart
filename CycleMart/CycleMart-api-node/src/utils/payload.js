export function sendPayload(data, status, message, code) {
	return {
		status,
		code,
		message,
		data
	};
}

export function respond(res, payload) {
	const statusCode = Number(payload?.code || 200);
	return res.status(statusCode).json(payload);
}
