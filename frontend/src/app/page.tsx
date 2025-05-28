"use client";

import { useState, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  timestamp: Date | string | null;
}

interface Server {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  running: boolean;
}

interface ServerTemplate {
  server_type: string;
  command: string;
  base_args: string[];
  env_requirements: string[];
  description: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<Record<string, Server>>({});
  const [templates, setTemplates] = useState<Record<string, ServerTemplate>>({});
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerType, setNewServerType] = useState("");

  // Fetch available servers
  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:8000/servers?_t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();
      if (data.success) {
        setServers(data.servers);
        // Auto-select all enabled servers by default
        const enabledServers = Object.entries(data.servers)
          .filter(([, server]) => (server as Server).enabled)
          .map(([name]) => name);
        if (selectedServers.length === 0) {
          setSelectedServers(enabledServers);
        }
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
    }
  }, [selectedServers.length]);

  // Fetch server templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/server-templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }, []);

  // Add a new server
  const addServer = async () => {
    if (!newServerName.trim() || !newServerType) return;
    
    try {
      const res = await fetch("http://localhost:8000/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServerName,
          server_type: newServerType
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setNewServerName("");
        setNewServerType("");
        fetchServers(); // Refresh server list
      } else {
        alert(data.error || "Failed to add server");
      }
    } catch (error) {
      console.error("Error adding server:", error);
      alert("Error adding server");
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchServers();
    fetchTemplates();
  }, [fetchServers, fetchTemplates]);

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
          enabled_servers: selectedServers.length > 0 ? selectedServers : null,
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
        
        {/* Server Configuration Panel */}
        <div className="mb-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">MCP Servers</h2>
            <div className="flex gap-2">
              <button
                onClick={fetchServers}
                className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                title="Refresh server list"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {showServerConfig ? "Hide Config" : "Configure"}
              </button>
            </div>
          </div>
          
          {/* Server Selection */}
          <div className="mb-3">
            <h3 className="text-sm font-medium mb-2">Active Servers for Chat:</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(servers).map(([name, server]) => (
                <label key={name} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedServers.includes(name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedServers(prev => [...prev, name]);
                      } else {
                        setSelectedServers(prev => prev.filter(s => s !== name));
                      }
                    }}
                    disabled={!server.enabled}
                    className="rounded"
                  />
                  <span className={`text-sm ${!server.enabled ? 'text-gray-400' : ''}`}>
                    {name} ({server.type})
                    {server.running && <span className="text-green-500 ml-1">●</span>}
                  </span>
                </label>
              ))}
            </div>
            {selectedServers.length === 0 && (
              <p className="text-sm text-orange-600 mt-1">
                No servers selected. Assistant will have no tools available.
              </p>
            )}
          </div>
          
          {/* Extended Configuration */}
          {showServerConfig && (
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium mb-2">Add New Server:</h3>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Server name"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="px-3 py-1 border rounded text-sm dark:bg-gray-800"
                />
                <select
                  value={newServerType}
                  onChange={(e) => setNewServerType(e.target.value)}
                  className="px-3 py-1 border rounded text-sm dark:bg-gray-800"
                >
                  <option value="">Select type...</option>
                  {Object.entries(templates).map(([type, template]) => (
                    <option key={type} value={type}>
                      {type} - {template.description}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addServer}
                  disabled={!newServerName.trim() || !newServerType}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              
              <h3 className="text-sm font-medium mb-2">Available Servers:</h3>
              <div className="space-y-2">
                {Object.entries(servers).map(([name, server]) => (
                  <div key={name} className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 p-2 rounded">
                    <div>
                      <span className="font-medium">{name}</span>
                      <span className="text-gray-500 ml-2">({server.type})</span>
                      <span className={`ml-2 ${server.enabled ? 'text-green-600' : 'text-red-600'}`}>
                        {server.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {server.running && <span className="text-blue-600 ml-2">Running</span>}
                    </div>
                    <div className="text-xs text-gray-600">{server.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 border rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <div>Start a conversation!</div>
              {selectedServers.length > 0 ? (
                <div className="mt-2 text-sm">
                  Assistant has access to: {selectedServers.join(", ")} MCP tools
                </div>
              ) : (
                <div className="mt-2 text-sm text-orange-600">
                  No servers selected - assistant will have no tools available
                </div>
              )}
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