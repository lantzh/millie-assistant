"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Send, Bird, ChevronRight, ChevronLeft } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReasoningEvent = {
  type: "reasoning";
  node: string;
  label: string;
  detail: string;
  route?: string;
};

// ── Agent graph ────────────────────────────────────────────────────────────────

const NODE_ICONS: Record<string, string> = {
  loadContext:    "📂",
  callLlm:        "🤖",
  executeTools:   "🔧",
  saveAndRespond: "💾",
};

const GRAPH_NODES = ["loadContext", "callLlm", "executeTools", "saveAndRespond"] as const;
type GNode = (typeof GRAPH_NODES)[number];

const NODE_LABEL: Record<GNode, string> = {
  loadContext:    "Load Context",
  callLlm:        "Call Model",
  executeTools:   "Run Tools",
  saveAndRespond: "Save & Done",
};

// Center coordinates within the SVG viewBox ("-12 -5 224 310")
const NODE_CX: Record<GNode, number> = { loadContext: 100, callLlm: 100, executeTools: 100, saveAndRespond: 100 };
const NODE_CY: Record<GNode, number> = { loadContext: 28,  callLlm: 108, executeTools: 192, saveAndRespond: 275 };
const NW = 160;
const NH = 34;

const C = {
  idleStroke:   "#e2e8f0",
  idleFill:     "#ffffff",
  idleText:     "#94a3b8",
  activeStroke: "#6366f1",
  activeFill:   "#eef2ff",
  activeText:   "#3730a3",
  doneStroke:   "#86efac",
  doneFill:     "#f0fdf4",
  doneText:     "#166534",
  edgeIdle:     "#cbd5e1",
  edgeLive:     "#6366f1",
} as const;

function AgentGraph({ events, isLoading }: { events: ReasoningEvent[]; isLoading: boolean }) {
  const { runCounts, traversed, activeNode } = useMemo(() => {
    const runCounts: Record<string, number> = {};
    const traversed = new Set<string>();
    let activeNode: string | null = events.length === 0 && isLoading ? "loadContext" : null;

    for (const e of events) {
      runCounts[e.node] = (runCounts[e.node] ?? 0) + 1;

      if (e.node === "loadContext") {
        traversed.add("lc-cl");
        activeNode = "callLlm";
      } else if (e.node === "callLlm") {
        if (e.route === "executeTools") {
          traversed.add("cl-et");
          activeNode = "executeTools";
        } else {
          traversed.add("cl-sr");
          activeNode = "saveAndRespond";
        }
      } else if (e.node === "executeTools") {
        traversed.add("et-cl");
        activeNode = "callLlm";
      } else if (e.node === "saveAndRespond") {
        activeNode = null;
      }
    }

    if (!isLoading) activeNode = null;
    return { runCounts, traversed, activeNode };
  }, [events, isLoading]);

  const ns = (n: string): "idle" | "active" | "done" =>
    activeNode === n ? "active" : runCounts[n] ? "done" : "idle";

  const ec = (id: string) => (traversed.has(id) ? C.edgeLive : C.edgeIdle);
  const ea = (id: string) => `url(#${traversed.has(id) ? "arw-on" : "arw-off"})`;
  const da = (id: string) => (traversed.has(id) ? undefined : "4 3");

  return (
    <svg viewBox="-12 -5 224 310" className="w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arw-off" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 1 L 7 4 L 0 7 Z" fill={C.edgeIdle} />
        </marker>
        <marker id="arw-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 1 L 7 4 L 0 7 Z" fill={C.edgeLive} />
        </marker>
      </defs>

      {/* loadContext → callLlm */}
      <path d="M 100 45 L 100 91"
        stroke={ec("lc-cl")} strokeWidth="1.5" fill="none"
        strokeDasharray={da("lc-cl")} markerEnd={ea("lc-cl")} />

      {/* callLlm → executeTools (conditional) */}
      <path d="M 100 125 L 100 175"
        stroke={ec("cl-et")} strokeWidth="1.5" fill="none"
        strokeDasharray={da("cl-et")} markerEnd={ea("cl-et")} />

      {/* executeTools → callLlm (right-side loop) */}
      <path d="M 180 192 C 208 192 208 108 180 108"
        stroke={ec("et-cl")} strokeWidth="1.5" fill="none"
        strokeDasharray={da("et-cl")} markerEnd={ea("et-cl")} />

      {/* callLlm → saveAndRespond (left-side bypass) */}
      <path d="M 20 108 C -8 108 -8 275 20 275"
        stroke={ec("cl-sr")} strokeWidth="1.5" fill="none"
        strokeDasharray={da("cl-sr")} markerEnd={ea("cl-sr")} />

      {/* Nodes */}
      {GRAPH_NODES.map((name) => {
        const cx = NODE_CX[name];
        const cy = NODE_CY[name];
        const state = ns(name);
        const count = runCounts[name] ?? 0;

        const stroke = state === "active" ? C.activeStroke : state === "done" ? C.doneStroke : C.idleStroke;
        const fill   = state === "active" ? C.activeFill   : state === "done" ? C.doneFill   : C.idleFill;
        const tColor = state === "active" ? C.activeText   : state === "done" ? C.doneText   : C.idleText;

        return (
          <g key={name}>
            {state === "active" && (
              <rect
                x={cx - NW / 2 - 3} y={cy - NH / 2 - 3}
                width={NW + 6} height={NH + 6} rx={9}
                fill="none" stroke={C.activeStroke} strokeWidth="1" opacity="0.35"
              />
            )}
            <rect
              x={cx - NW / 2} y={cy - NH / 2}
              width={NW} height={NH} rx={6}
              fill={fill} stroke={stroke} strokeWidth={state === "active" ? 2 : 1.5}
            />
            <text
              x={cx} y={cy}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontFamily="system-ui, -apple-system, sans-serif"
              fill={tColor}
            >
              {NODE_ICONS[name]} {NODE_LABEL[name]}{count > 1 ? ` ×${count}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(["Millie: Hello! How can I help you today?"]);
  const [isLoading, setIsLoading] = useState(false);
  const [reasoningEvents, setReasoningEvents] = useState<ReasoningEvent[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoningView, setReasoningView] = useState<"log" | "graph">("log");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    setMessages((prev) => [...prev, `You: ${message}`]);
    const messageToSend = message;
    setMessage("");
    setIsLoading(true);
    setReasoningEvents([]);

    try {
      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "reasoning") {
            setReasoningEvents((prev) => [...prev, event as ReasoningEvent]);
          } else if (event.type === "response") {
            setMessages((prev) => [...prev, `Millie: ${event.text}`]);
            setIsLoading(false);
          } else if (event.type === "error") {
            setMessages((prev) => [...prev, "Millie: Sorry, I had trouble right now."]);
            setIsLoading(false);
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, "Millie: Sorry, I had trouble connecting."]);
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex gap-2 items-center mb-3">
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Millie</h1>
              <Bird className="h-8 w-8 text-primary" />
            </div>
            <p className="text-base text-muted-foreground leading-relaxed">
              Your caring AI companion — here to chat, remember, and help. Try
              asking about your day, your routines, or just say hello!
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReasoning((v) => !v)}
            className="mt-1 gap-1 text-muted-foreground text-xs shrink-0"
          >
            {showReasoning ? (
              <>Hide reasoning <ChevronRight className="h-3 w-3" /></>
            ) : (
              <>Show reasoning <ChevronLeft className="h-3 w-3" /></>
            )}
          </Button>
        </div>

        {/* Main layout */}
        <div className="flex gap-4 items-start">
          {/* Chat column */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <Card className="border-2 shadow-sm">
              <CardContent className="p-6">
                <div className="h-96 overflow-y-auto space-y-4 pr-2">
                  {messages.map((msg, index) => {
                    const isUser   = msg.startsWith("You:");
                    const isMillie = msg.startsWith("Millie:");
                    const content  = msg.replace(/^(You|Millie): /, "");
                    return (
                      <div key={index} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                        {isMillie && (
                          <Avatar className="h-9 w-9 mt-1 ring-2 ring-primary/10">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <Bird className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-[70%] px-4 py-3 rounded-lg ${isUser ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground border border-border/50"}`}>
                          <p className="text-[15px] leading-relaxed font-medium">{content}</p>
                        </div>
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
                        <p className="text-[15px] italic font-medium">Millie is thinking...</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </Card>

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

          {/* Reasoning panel */}
          {showReasoning && (
            <Card className="w-72 shrink-0 border-2 shadow-sm">
              <CardContent className="p-4">
                {/* Panel header with log/graph toggle */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Reasoning
                  </p>
                  <div className="flex rounded-sm overflow-hidden border border-border/60 text-[10px]">
                    <button
                      onClick={() => setReasoningView("log")}
                      className={`px-2 py-0.5 transition-colors ${
                        reasoningView === "log"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Log
                    </button>
                    <button
                      onClick={() => setReasoningView("graph")}
                      className={`px-2 py-0.5 border-l border-border/60 transition-colors ${
                        reasoningView === "graph"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Graph
                    </button>
                  </div>
                </div>

                {/* Log view */}
                {reasoningView === "log" && (
                  reasoningEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      {isLoading ? "Waiting for first step…" : "Send a message to see reasoning."}
                    </p>
                  ) : (
                    <ol className="space-y-3">
                      {reasoningEvents.map((event, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="mt-0.5 shrink-0">{NODE_ICONS[event.node] ?? "▶"}</span>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground leading-snug">{event.label}</p>
                            {event.detail && (
                              <p className="text-muted-foreground leading-snug mt-0.5 line-clamp-2 break-words">
                                {event.detail}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )
                )}

                {/* Graph view */}
                {reasoningView === "graph" && (
                  <AgentGraph events={reasoningEvents} isLoading={isLoading} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
