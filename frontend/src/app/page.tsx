"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  timestamp: Date | string | null;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          history: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            toolName: msg.toolName || null,
            timestamp: typeof msg.timestamp === 'object' 
              ? msg.timestamp?.toISOString() || new Date().toISOString()
              : msg.timestamp || new Date().toISOString()
          }))
        }),
      });

      const data = await res.json();
      
      if (data.messages) {
        const newMessages = data.messages.map((msg: {
          role: string;
          content: string;
          toolName?: string;
          timestamp?: string | null;
        }) => ({
          ...msg,
          timestamp: msg.timestamp || new Date().toISOString()
        }));
        setMessages(prev => [...prev, ...newMessages]);
      }
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="min-h-screen flex flex-col max-w-4xl mx-auto p-4">
      <div className="flex-1 flex flex-col">
        <h1 className="text-3xl font-bold text-center mb-6">MCP Chat Interface</h1>
        
        <div className="flex-1 border rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              Start a conversation! The assistant has access to Stripe MCP tools.
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : message.role === "tool"
                    ? "bg-green-100 dark:bg-green-900 border border-green-300"
                    : "bg-white dark:bg-gray-800 border"
                }`}
              >
                {message.role === "tool" && (
                  <div className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
                    Tool: {message.toolName}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp 
                    ? (typeof message.timestamp === 'object' 
                        ? message.timestamp.toLocaleTimeString() 
                        : new Date(message.timestamp).toLocaleTimeString())
                    : new Date().toLocaleTimeString()
                  }
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="text-left mb-4">
              <div className="inline-block p-3 rounded-lg bg-white dark:bg-gray-800 border">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Assistant is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 px-4 py-2 border rounded-lg resize-none dark:bg-gray-800"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}