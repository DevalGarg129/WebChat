// Lightweight socket helper: create/get a single WebSocket instance.
let current = null;

export function createSocket(url) {
	if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
		return current;
	}

	const ws = new WebSocket(url);
	current = ws;

	// Clear reference when closed so a new connection can be created later
	ws.addEventListener("close", () => {
		current = null;
	});

	return ws;
}

export function getSocket() {
	return current;
}

export default { createSocket, getSocket };