import { useState, useEffect, useRef } from "react";
import "./App.css";
import { createSocket } from "./socket";
function App() {
  const [status, setStatus] = useState("Connecting");
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [nameInput, setNameInput] = useState("");
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSentRef = useRef(false);

  useEffect(() => {
    function connect() {
      setStatus("Connecting");

      // Use page hostname so phone clients connecting to laptop IP use the same host
      const host = window.location.hostname || "localhost";
      const wsUrl = `ws://${host}:5000`;
      const ws = createSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected");
        // focus message input when connected
        setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // typing indicator messages handled separately
          if (data && data.type === "typing") {
            setTypingUsers((prev) => {
              const user = data.user || "unknown";
              if (data.typing) {
                if (prev.includes(user)) return prev;
                return [...prev, user];
              } else {
                return prev.filter((u) => u !== user);
              }
            });
            return;
          }

          setMessages((prev) => [...prev, data]);
        } catch (e) {
          // fallback for plain text
          setMessages((prev) => [
            ...prev,
            { user: "", text: event.data, time: new Date().toISOString() },
          ]);
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        // attempt reconnect
        setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        setStatus("Error");
        ws.close();
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = () => {
    if (!username) return alert("Set a username first");
    if (chat.trim() !== "") {
      const ws = wsRef.current;
      const payload = {
        user: username,
        text: chat,
        time: new Date().toISOString(),
      };
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        // append locally — server broadcasts only to other clients
        setMessages((prev) => [...prev, payload]);
      } else {
        console.error("WebSocket not open");
      }
      setChat("");
      // send typing=false when message sent
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "typing", user: username, typing: false }));
        }
      } catch (e) {}
      typingSentRef.current = false;
    }
  };

  const handleSetName = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUsername(name);
    setNameInput("");
    // notify server that this user joined (so server can log username)
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "join", user: name, time: new Date().toISOString() })
        );
      }
    } catch (e) {
      console.error("Failed to send join message", e);
    }
  };

  // typing indicator: call on each input change
  const handleTyping = () => {
    const ws = wsRef.current;
    if (!username) return; // only send typing status when named
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (!typingSentRef.current) {
      try {
        ws.send(JSON.stringify({ type: "typing", user: username, typing: true }));
        typingSentRef.current = true;
      } catch (e) {}
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "typing", user: username, typing: false }));
        }
      } catch (e) {}
      typingSentRef.current = false;
    }, 800);
  };

  // auto-scroll chat to bottom when messages change
  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) {
      box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="container">
      <h1>WebSocket Chat</h1>
      <p>Status: {status}</p>

      {!username ? (
        <div className="login-area">
          <input
            placeholder="Enter your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetName()}
          />
          <button className="btn btn-danger" onClick={handleSetName}>Join Chat</button>
        </div>
      ) : (
        <>
          <div className="input-row">
            <input
              ref={inputRef}
              className="message-input"
              type="text"
              value={chat}
              disabled={status !== "Connected"}
              placeholder={
                status === "Connected"
                  ? "Type your message..."
                  : "Cannot send messages while disconnected"
              }
              onChange={(e) => {
                setChat(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />

            <button
              className="btn btn-primary send-btn"
              type="button"
              onClick={sendMessage}
              disabled={chat.trim() === "" || status !== "Connected"}
            >
              Send
            </button>
          </div>
        </>
      )}
      <div className="chat-box" ref={chatBoxRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`bubble ${msg.user === username ? "me" : ""}`}
          >
            <div className="meta">
              <strong>{msg.user || "Server"}</strong>
              <small>{new Date(msg.time).toLocaleTimeString()}</small>
            </div>
            <div className="text">{msg.text}</div>
          </div>
        ))}
      </div>
      <div className="typing-area">
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.slice(0, 3).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
