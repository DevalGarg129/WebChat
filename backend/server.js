const express = require("express");
const http = require("http");
const cors = require("cors");
const websocket = require("ws");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const wss = new websocket.Server({ server });

// simple client id generator and map of connections
let nextClientId = 1;
const connections = {};

wss.on("connection", (ws, req) => {
    const id = nextClientId++;
    ws.id = id;
    connections[id] = ws;

    // try to get client ip from the upgrade request (works behind reverse proxies too)
    const clientIp = (req && req.socket && req.socket.remoteAddress) || (ws._socket && ws._socket.remoteAddress) || "unknown";
    console.log(`New client connected (id=${id}, ip=${clientIp})`);

    ws.on("message", (message) => {
        const text = message.toString();

        // try to parse JSON to handle special message types
        try {
            const data = JSON.parse(text);
            if (data && data.type === "join") {
                ws.username = data.user || "unknown";
                console.log(`User connected: ${ws.username} (id=${ws.id})`);
                return; // don't broadcast join messages
            }
            // typing indicator events: broadcast typing status to others
            if (data && data.type === "typing") {
                // forward typing status to other clients
                const payload = JSON.stringify({ type: "typing", user: data.user, typing: !!data.typing });
                wss.clients.forEach((client) => {
                    if (client !== ws && client.readyState === websocket.OPEN) {
                        client.send(payload);
                    }
                });
                return;
            }
        } catch (e) {
            // not JSON — continue to broadcast raw text
        }

        console.log("Received: " + text);
        // Broadcast the received message to all connected clients except the sender
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === websocket.OPEN) {
                client.send(text);
            }
        });
    });

    ws.on("close", () => {
        console.log(`Client disconnected: ${ws.username || "unknown"} (id=${ws.id})`);
        // remove from connections map
        delete connections[ws.id];
    });

    ws.on("error", (error) => {
        console.error("WebSocket error: ", error);
    });
});

app.get("/", (req, res) => {
    res.send("WebSocket server is running");
});

// Start the HTTP server (this is the server the WebSocket server was attached to)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        if (PORT === 3000) {
            console.warn("Warning: port 3000 is commonly used by the React dev server. Consider using 5000 for the backend to avoid conflicts.");
        }
});