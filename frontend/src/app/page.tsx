"use client";

import { useState } from "react";

export default function Home() {
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const callAPI = async () => {
    setLoading(true);
    setResponse("");
    
    try {
      const res = await fetch("http://localhost:8000/call-mcp-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          server_nickname: "supabase",
          tool_name: "test_tool",
          arguments: { test: "data" }
        }),
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <h1 className="text-3xl font-bold text-center">MCP Tool Tester</h1>
        
        <div className="flex justify-center">
          <button
            onClick={callAPI}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Calling API..." : "Test API Call"}
          </button>
        </div>

        {response && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Response:</h2>
            <pre className="whitespace-pre-wrap break-words text-sm">
              {response}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}