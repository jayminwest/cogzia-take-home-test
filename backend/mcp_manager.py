import json
import os
import subprocess
import asyncio
from typing import Dict, Any, Optional, List
import uuid
from server_registry import ServerRegistry


class MCPServerManager:
    def __init__(self, server_registry: ServerRegistry = None):
        self.servers: Dict[str, subprocess.Popen] = {}
        self.registry = server_registry or ServerRegistry()

    def get_server_config(self, server_name: str) -> dict:
        """Get server configuration in legacy format"""
        config = self.registry.get_server_config(server_name)
        if not config:
            raise ValueError(f"Unknown server: {server_name}")

        return {
            "command": config.command,
            "args": config.args,
            "env": config.env_vars
        }

    def _prepare_env(self, server_nickname: str) -> dict:
        """Prepare environment variables for server"""
        env = os.environ.copy()

        # Get server configuration
        config = self.registry.get_server_config(server_nickname)
        if not config:
            return env

        # Add server-specific environment variables from config
        for env_var, value in config.env_vars.items():
            env[env_var] = value

        # Add environment variables from system environment
        if config.server_type == "stripe":
            stripe_key = os.getenv("STRIPE_SECRET_KEY")
            if stripe_key:
                env["STRIPE_SECRET_KEY"] = stripe_key

        elif config.server_type == "git-mcp":
            # git-mcp doesn't require special environment variables
            # but could be extended to set repository paths or API tokens
            pass

        return env

    async def start_server(self, server_nickname: str) -> subprocess.Popen:
        """Start an MCP server subprocess"""
        config = self.registry.get_server_config(server_nickname)
        if not config:
            raise ValueError(f"Unknown server: {server_nickname}")

        if not config.enabled:
            raise ValueError(f"Server {server_nickname} is disabled")

        env = self._prepare_env(server_nickname)

        # Start the server process
        process = subprocess.Popen(
            [config.command] + config.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1
        )

        self.servers[server_nickname] = process
        return process

    async def stop_server(self, server_nickname: str):
        """Stop an MCP server"""
        if server_nickname in self.servers:
            process = self.servers[server_nickname]
            process.terminate()
            await asyncio.sleep(0.5)
            if process.poll() is None:
                process.kill()
            del self.servers[server_nickname]

    async def stop_all_servers(self):
        """Stop all running MCP servers"""
        for server_nickname in list(self.servers.keys()):
            await self.stop_server(server_nickname)

    def get_server(self, server_nickname: str) -> Optional[subprocess.Popen]:
        """Get a running server process"""
        return self.servers.get(server_nickname)

    async def send_request(self, server_nickname: str, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send a JSON-RPC request to an MCP server"""
        # Ensure server is running
        if server_nickname not in self.servers:
            await self.start_server(server_nickname)

        process = self.servers[server_nickname]

        # Create JSON-RPC request
        request_id = str(uuid.uuid4())
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "id": request_id
        }

        # Only add params if they exist
        if params:
            request["params"] = params

        # Send request
        try:
            request_str = json.dumps(request) + "\n"
            process.stdin.write(request_str)
            process.stdin.flush()

            # Read response with timeout
            loop = asyncio.get_event_loop()
            response_line = await asyncio.wait_for(
                loop.run_in_executor(None, process.stdout.readline),
                timeout=10.0
            )

            if not response_line:
                raise Exception("No response from MCP server")

            response = json.loads(response_line)

            # Check for errors
            if "error" in response:
                raise Exception(f"MCP server error: {response['error']}")

            return response.get("result", {})

        except Exception:
            raise

    async def initialize_server(self, server_nickname: str) -> Dict[str, Any]:
        """Initialize connection with MCP server"""
        return await self.send_request(server_nickname, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "cogznia-mcp-client",
                "version": "1.0.0"
            }
        })

    async def list_tools(self, server_nickname: str) -> Dict[str, Any]:
        """List available tools from an MCP server"""
        # Try with empty params explicitly
        return await self.send_request(server_nickname, "tools/list", {})

    async def call_tool(self, server_nickname: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool on an MCP server"""
        return await self.send_request(server_nickname, "tools/call", {
            "name": tool_name,
            "arguments": arguments
        })

    def list_available_servers(self) -> Dict[str, Any]:
        """List all available server configurations"""
        servers = {}
        for name, config in self.registry.list_servers().items():
            servers[name] = {
                "name": name,
                "type": config.server_type,
                "description": config.description,
                "enabled": config.enabled,
                "running": name in self.servers
            }
        return servers

    async def get_all_tools(self, server_names: List[str] = None) -> Dict[str, Any]:
        """Get tools from specified servers (or all enabled servers)"""
        if server_names is None:
            server_names = list(self.registry.list_servers().keys())

        all_tools = {}
        for server_name in server_names:
            try:
                if server_name not in self.servers:
                    await self.initialize_server(server_name)

                tools = await self.list_tools(server_name)
                all_tools[server_name] = tools
            except Exception as e:
                print(f"Error getting tools from {server_name}: {e}")
                all_tools[server_name] = {"error": str(e), "tools": []}

        return all_tools
