"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Send, Bird, Flower, Flower2 } from "lucide-react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    "Millie: Hello! How can I help you today?",
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Simple Header - Just "Millie" */}
        <div className="mb-8">
          <div className="flex gap-2 items-center mb-3">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Millie
            </h1>
            <Bird className="h-8 w-8 text-primary" />
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            {" "}
            Your caring AI companion — here to chat, remember, and help. Try
            asking about your day, your routines, or just say hello!
          </p>
        </div>

        {/* Messages Area */}
        <Card className="mb-4 border-2 shadow-sm">
          <CardContent className="p-6">
            <div className="h-96 overflow-y-auto space-y-4 pr-2">
              {messages.map((msg, index) => {
                const isUser = msg.startsWith("You:");
                const isMillie = msg.startsWith("Millie:");
                const content = msg.replace(/^(You|Millie): /, "");

                return (
                  <div
                    key={index}
                    className={`flex gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Millie's avatar (left side) */}
                    {isMillie && (
                      <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bird className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`max-w-[70%] px-4 py-3 rounded-lg ${
                        isUser
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-foreground border border-border/50"
                      }`}
                    >
                      <p className="text-[15px] leading-relaxed font-medium">
                        {content}
                      </p>
                    </div>

                    {/* User's avatar (right side) */}
                    {isUser && (
                      <Avatar className="h-9 w-9 mt-1 ring-2 ring-secondary/10">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted text-muted-foreground px-4 py-3 rounded-lg border border-border/50">
                    <p className="text-[15px] italic font-medium">
                      Millie is thinking...
                    </p>
                  </div>
                </div>
              )}

              {/* Auto-scroll target */}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Input area */}
        <Card className="border-2 shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                disabled={isLoading}
                className="text-[15px] font-medium h-11 border-border/50 focus-visible:border-primary"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !message.trim()}
                className="gap-2 h-11 px-5 font-semibold"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
