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

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<Record<string, unknown>>({});

  // Toast management
  const addToast = useCallback((type: Toast['type'], message: string, duration = 5000) => {
    const id = Date.now().toString();
    const toast: Toast = { id, type, message, duration };
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

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
      } else {
        addToast('error', data.error || 'Failed to fetch servers');
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
      addToast('error', 'Failed to connect to server');
    }
  }, [selectedServers.length, addToast]);

  // JSON content detection and parsing
  const isJsonString = (str: string): boolean => {
    try {
      const trimmed = str.trim();
      return (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
             (trimmed.startsWith('[') && trimmed.endsWith(']'));
    } catch {
      return false;
    }
  };

  const parseJsonSafely = (str: string): unknown => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  // JSON Tree Viewer Component
  const JsonTreeViewer = ({ data, level = 0 }: { data: unknown; level?: number }) => {
    const [collapsed, setCollapsed] = useState(level > 2);
    
    if (data === null) return <span className="text-gray-500">null</span>;
    if (data === undefined) return <span className="text-gray-500">undefined</span>;
    
    if (typeof data !== 'object') {
      return (
        <span className={`${
          typeof data === 'string' ? 'text-green-600 dark:text-green-400' :
          typeof data === 'number' ? 'text-blue-600 dark:text-blue-400' :
          typeof data === 'boolean' ? 'text-purple-600 dark:text-purple-400' :
          'text-gray-600 dark:text-gray-400'
        }`}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
      );
    }
    
    const isArray = Array.isArray(data);
    const entries = isArray ? data.map((item, index) => [index, item]) : Object.entries(data);
    const isEmpty = entries.length === 0;
    
    if (isEmpty) {
      return <span className="text-gray-500">{isArray ? '[]' : '{}'}</span>;
    }
    
    return (
      <div className="font-mono text-sm">
        <span 
          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▶' : '▼'} {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
        {!collapsed && (
          <div className="ml-4 mt-1 border-l border-gray-300 dark:border-gray-600 pl-2">
            {entries.map(([key, value]) => (
              <div key={String(key)} className="py-1">
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {isArray ? `[${key}]:` : `"${key}":`}
                </span>
                <span className="ml-2">
                  <JsonTreeViewer data={value} level={level + 1} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const toggleMessageExpansion = (index: number) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Fetch server templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:8000/server-templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        addToast('error', data.error || 'Failed to fetch server templates');
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      addToast('error', 'Failed to connect to server');
    }
  }, [addToast]);

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
        addToast('success', `Server "${newServerName}" added successfully`);
        fetchServers(); // Refresh server list
      } else {
        addToast('error', data.error || "Failed to add server");
      }
    } catch (error) {
      console.error("Error adding server:", error);
      addToast('error', 'Failed to connect to server');
    }
  };

  // Toggle server enable/disable
  const toggleServerStatus = async (serverName: string, enabled: boolean) => {
    try {
      const res = await fetch(`http://localhost:8000/servers/${serverName}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      
      const data = await res.json();
      if (data.success) {
        addToast('success', `Server "${serverName}" ${enabled ? 'enabled' : 'disabled'}`);
        fetchServers();
      } else {
        addToast('error', data.error || `Failed to ${enabled ? 'enable' : 'disable'} server`);
      }
    } catch (error) {
      console.error("Error toggling server status:", error);
      addToast('error', 'Failed to connect to server');
    }
  };

  // Delete server
  const deleteServer = async (serverName: string) => {
    if (!confirm(`Are you sure you want to delete server "${serverName}"?`)) {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:8000/servers/${serverName}`, {
        method: "DELETE"
      });
      
      const data = await res.json();
      if (data.success) {
        addToast('success', `Server "${serverName}" deleted successfully`);
        // Remove from selected servers if it was selected
        setSelectedServers(prev => prev.filter(s => s !== serverName));
        fetchServers();
      } else {
        addToast('error', data.error || 'Failed to delete server');
      }
    } catch (error) {
      console.error("Error deleting server:", error);
      addToast('error', 'Failed to connect to server');
    }
  };

  // Fetch detailed server status
  const fetchServerDetails = async (serverName: string) => {
    try {
      const res = await fetch(`http://localhost:8000/servers/${serverName}/status`);
      const data = await res.json();
      if (data.success) {
        setServerDetails(prev => ({ ...prev, [serverName]: data.status as Record<string, unknown> }));
      } else {
        addToast('error', data.error || 'Failed to fetch server details');
      }
    } catch (error) {
      console.error("Error fetching server details:", error);
      addToast('error', 'Failed to connect to server');
    }
  };

  // Start editing a server
  const startEditingServer = (serverName: string) => {
    setEditingServer(serverName);
    fetchServerDetails(serverName);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingServer(null);
    setServerDetails({});
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
    <main className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">MCP Chat Interface</h1>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedServers.length > 0 ? `${selectedServers.length} server${selectedServers.length > 1 ? 's' : ''} active` : 'No servers'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Server Configuration Sidebar */}
        <aside className={`${showServerConfig ? 'w-full md:w-80' : 'hidden md:block md:w-16'} transition-all duration-300 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
        <div className={`${showServerConfig ? 'px-4 py-3' : 'p-2'} border-b border-gray-200 dark:border-gray-700`}>
          <div className={`flex ${showServerConfig ? 'justify-end' : 'justify-center'} items-center`}>
            <div className={`flex gap-2 ${!showServerConfig ? 'flex-col' : ''}`}>
              {showServerConfig && (
                <button
                  onClick={fetchServers}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                  title="Refresh server list"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
              <button
                onClick={() => setShowServerConfig(!showServerConfig)}
                className={`text-xs ${showServerConfig ? 'px-2 py-1' : 'p-2'} bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center ${showServerConfig ? 'gap-1' : 'justify-center'}`}
                title={showServerConfig ? "Close configuration" : "Open configuration"}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showServerConfig ? "M6 18L18 6M6 6l12 12" : "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {showServerConfig && <span>Close</span>}
              </button>
            </div>
          </div>
        </div>
        
        <div className={`flex-1 overflow-y-auto ${showServerConfig ? 'p-4' : 'p-2'}`}>
          {/* Server Controls */}
          {showServerConfig ? (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Active Servers</h3>
              <div className="space-y-2">
                {Object.entries(servers).map(([name, server]) => (
                  <label key={name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                    <div className="flex items-center space-x-3">
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
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className={`text-sm font-medium ${!server.enabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                          {name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{server.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {server.running && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="Running"></div>
                      )}
                      {!server.enabled && (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" title="Disabled"></div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {selectedServers.length === 0 && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    ⚠️ No servers selected. Assistant will have no tools available.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {Object.entries(servers).map(([name, server]) => (
                <div
                  key={name}
                  className={`relative group cursor-pointer ${selectedServers.includes(name) && server.enabled ? 'opacity-100' : 'opacity-40'}`}
                  onClick={() => {
                    if (server.enabled) {
                      if (selectedServers.includes(name)) {
                        setSelectedServers(prev => prev.filter(s => s !== name));
                      } else {
                        setSelectedServers(prev => [...prev, name]);
                      }
                    }
                  }}
                  title={`${name} (${server.type}) - ${selectedServers.includes(name) ? 'Active' : 'Inactive'}`}
                >
                  <div className="w-8 h-8 mx-auto bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedServers.includes(name) && server.enabled 
                        ? 'bg-green-500' 
                        : server.enabled 
                        ? 'bg-gray-400' 
                        : 'bg-red-400'
                    }`}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Extended Configuration */}
          {showServerConfig && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Add New Server</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Server name"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={newServerType}
                    onChange={(e) => setNewServerType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add Server
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">All Servers</h3>
                <div className="space-y-2">
                  {Object.entries(servers).map(([name, server]) => (
                    <div key={name} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">{name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">({server.type})</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{server.description}</div>
                        </div>
                        <div className="flex flex-col items-end space-y-1 ml-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => toggleServerStatus(name, !server.enabled)}
                              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                                server.enabled 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800' 
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800'
                              }`}
                              title={`Click to ${server.enabled ? 'disable' : 'enable'}`}
                            >
                              {server.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => startEditingServer(name)}
                              className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                              title="Edit server details"
                            >
                              ✏
                            </button>
                            <button
                              onClick={() => deleteServer(name)}
                              className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900 dark:hover:text-red-300 transition-colors"
                              title="Delete server"
                            >
                              ✕
                            </button>
                          </div>
                          {server.running && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Running
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        </aside>
        
        {/* Mobile Floating Action Button */}
        {!showServerConfig && (
          <button
            onClick={() => setShowServerConfig(true)}
            className="md:hidden fixed bottom-20 right-4 z-10 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
            aria-label="Open server configuration"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-16 lg:py-24">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to MCP Chat</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">Start a conversation with your AI assistant</p>
                {selectedServers.length > 0 ? (
                  <div className="inline-flex items-center px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-700 dark:text-green-300">
                      Assistant has access to: {selectedServers.join(", ")} tools
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      No servers selected - assistant will have no tools available
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] lg:max-w-[70%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-sm ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                          : message.role === "tool"
                          ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800"
                          : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {message.role === "tool" && (
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            Tool: {message.toolName}
                          </span>
                        </div>
                      )}
                      <div className="text-sm lg:text-base">
                        {message.role === "tool" && isJsonString(message.content) ? (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">JSON Response</span>
                              <button
                                onClick={() => toggleMessageExpansion(index)}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                {expandedMessages.has(index) ? 'Collapse' : 'Expand Tree'}
                              </button>
                            </div>
                            {expandedMessages.has(index) ? (
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-96">
                                <JsonTreeViewer data={parseJsonSafely(message.content)} />
                              </div>
                            ) : (
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-32">
                                <pre className="whitespace-pre-wrap break-words text-xs font-mono text-gray-700 dark:text-gray-300">
                                  {message.content.length > 200 ? 
                                    message.content.substring(0, 200) + '...' : 
                                    message.content
                                  }
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        )}
                      </div>
                      <div className={`text-xs mt-2 ${
                        message.role === "user" ? "text-blue-200" : "text-gray-500 dark:text-gray-400"
                      }`}>
                        {message.timestamp 
                          ? (typeof message.timestamp === 'object' 
                              ? message.timestamp.toLocaleTimeString() 
                              : new Date(message.timestamp).toLocaleTimeString())
                          : new Date().toLocaleTimeString()
                        }
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {loading && (
              <div className="flex justify-start mt-6">
                <div className="max-w-[85%] lg:max-w-[70%]">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">Assistant is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 lg:gap-4">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl resize-none bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm lg:text-base"
                  rows={2}
                />
                {input.trim() && (
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    Enter to send
                  </div>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-4 lg:px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-center p-4 rounded-lg shadow-lg min-w-80 max-w-md
              transform transition-all duration-300 ease-in-out
              ${
                toast.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/80 dark:border-green-700 dark:text-green-200'
                  : toast.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/80 dark:border-red-700 dark:text-red-200'
                  : 'bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/80 dark:border-blue-700 dark:text-blue-200'
              }
            `}
          >
            <div className="flex-shrink-0 mr-3">
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-sm font-medium">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Server Details Modal */}
      {editingServer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Server Details: {editingServer}
                </h2>
                <button
                  onClick={cancelEditing}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {serverDetails[editingServer] ? (
                <div>
                {/* eslint-disable @typescript-eslint/no-explicit-any */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Server Type
                      </label>
                      <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        {(serverDetails[editingServer] as any)?.type}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Status
                      </label>
                      <div className={`text-sm p-2 rounded ${
                        (serverDetails[editingServer] as any)?.running 
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {(serverDetails[editingServer] as any)?.running ? 'Running' : 'Stopped'}
                        {(serverDetails[editingServer] as any)?.pid && ` (PID: ${(serverDetails[editingServer] as any)?.pid})`}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      {(serverDetails[editingServer] as any)?.description}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Command
                    </label>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      {(serverDetails[editingServer] as any)?.command}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Arguments
                    </label>
                    <div className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      {(serverDetails[editingServer] as any)?.args?.join(' ') || 'No arguments'}
                    </div>
                  </div>
                  
                  {(serverDetails[editingServer] as any)?.recent_logs && (serverDetails[editingServer] as any)?.recent_logs.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Recent Logs
                      </label>
                      <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
                        {(serverDetails[editingServer] as any)?.recent_logs.map((log: string, index: number) => (
                          <div key={index} className="mb-1">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => {
                        addToast('info', 'Refreshing server details...');
                        fetchServerDetails(editingServer);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Refresh Details
                    </button>
                    <button
                      onClick={() => toggleServerStatus(editingServer, !(serverDetails[editingServer] as any)?.enabled)}
                      className={`px-4 py-2 rounded transition-colors ${
                        (serverDetails[editingServer] as any)?.enabled
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {(serverDetails[editingServer] as any)?.enabled ? 'Disable' : 'Enable'} Server
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
                {/* eslint-enable @typescript-eslint/no-explicit-any */}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">Loading server details...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}