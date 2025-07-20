"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    "Millie: Hello! How can I help you today?",
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    // Add user message to thread immediately
    const userMessage = `You: ${message}`;
    setMessages((prev) => [...prev, userMessage]);

    // Store message and clear input
    const messageToSend = message;
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, `Millie: ${data.response}`]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        "Millie: Sorry, I had trouble connecting",
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };
  return (
    <div>
      <h1>Chat with Millie</h1>

      {/* Display messages */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: "10px",
          height: "200px",
          overflowY: "auto",
        }}
      >
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}
