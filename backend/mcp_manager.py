import json
import os
import subprocess
import asyncio
import logging
import threading
from typing import Dict, Any, Optional, List
import uuid
from server_registry import ServerRegistry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MCPServerManager:
    def __init__(self, server_registry: ServerRegistry = None):
        self.servers: Dict[str, subprocess.Popen] = {}
        self.registry = server_registry or ServerRegistry()
        self.server_logs: Dict[str, List[str]] = {}  # Store server stderr logs
        self._log_threads: Dict[str, threading.Thread] = {}  # Track log monitoring threads

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
        logger.info(f"Starting MCP server '{server_nickname}' with command: {config.command} {' '.join(config.args)}")
        
        process = subprocess.Popen(
            [config.command] + config.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1
        )

        # Initialize log storage for this server
        self.server_logs[server_nickname] = []
        
        # Start monitoring stderr in a separate thread
        self._start_stderr_monitoring(server_nickname, process)
        
        self.servers[server_nickname] = process
        logger.info(f"MCP server '{server_nickname}' started successfully with PID {process.pid}")
        return process

    def _start_stderr_monitoring(self, server_nickname: str, process: subprocess.Popen):
        """Start monitoring stderr output from an MCP server in a separate thread"""
        def monitor_stderr():
            try:
                while True:
                    line = process.stderr.readline()
                    if not line:
                        break
                    
                    # Store the stderr line
                    stderr_msg = line.strip()
                    if stderr_msg:
                        self.server_logs[server_nickname].append(stderr_msg)
                        
                        # Log based on content
                        if any(keyword in stderr_msg.lower() for keyword in ['error', 'failed', 'exception', 'traceback']):
                            logger.error(f"MCP server '{server_nickname}' stderr: {stderr_msg}")
                        elif any(keyword in stderr_msg.lower() for keyword in ['warning', 'warn']):
                            logger.warning(f"MCP server '{server_nickname}' stderr: {stderr_msg}")
                        else:
                            logger.debug(f"MCP server '{server_nickname}' stderr: {stderr_msg}")
                        
                        # Keep only last 100 log entries per server to prevent memory issues
                        if len(self.server_logs[server_nickname]) > 100:
                            self.server_logs[server_nickname] = self.server_logs[server_nickname][-100:]
                            
            except Exception as e:
                logger.error(f"Error monitoring stderr for server '{server_nickname}': {e}")
        
        thread = threading.Thread(target=monitor_stderr, daemon=True)
        thread.start()
        self._log_threads[server_nickname] = thread
        logger.debug(f"Started stderr monitoring thread for server '{server_nickname}'")

    async def stop_server(self, server_nickname: str):
        """Stop an MCP server"""
        if server_nickname in self.servers:
            logger.info(f"Stopping MCP server '{server_nickname}'")
            process = self.servers[server_nickname]
            process.terminate()
            await asyncio.sleep(0.5)
            if process.poll() is None:
                logger.warning(f"MCP server '{server_nickname}' did not terminate gracefully, killing...")
                process.kill()
            
            # Clean up tracking data
            del self.servers[server_nickname]
            if server_nickname in self.server_logs:
                del self.server_logs[server_nickname]
            if server_nickname in self._log_threads:
                del self._log_threads[server_nickname]
            
            logger.info(f"MCP server '{server_nickname}' stopped successfully")

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
            logger.debug(f"Sending request to '{server_nickname}': {method} with params: {params}")
            
            process.stdin.write(request_str)
            process.stdin.flush()

            # Read response with timeout
            loop = asyncio.get_event_loop()
            response_line = await asyncio.wait_for(
                loop.run_in_executor(None, process.stdout.readline),
                timeout=10.0
            )

            if not response_line:
                error_msg = f"No response from MCP server '{server_nickname}' for method '{method}'"
                logger.error(error_msg)
                # Include recent stderr logs if available
                if server_nickname in self.server_logs and self.server_logs[server_nickname]:
                    recent_logs = self.server_logs[server_nickname][-5:]  # Last 5 stderr messages
                    logger.error(f"Recent stderr from '{server_nickname}': {recent_logs}")
                raise Exception(error_msg)

            logger.debug(f"Received response from '{server_nickname}': {response_line.strip()}")
            response = json.loads(response_line)

            # Check for errors
            if "error" in response:
                error_msg = f"MCP server '{server_nickname}' error for method '{method}': {response['error']}"
                logger.error(error_msg)
                raise Exception(error_msg)

            logger.debug(f"Successfully processed request to '{server_nickname}' for method '{method}'")
            return response.get("result", {})

        except asyncio.TimeoutError:
            error_msg = f"Timeout waiting for response from MCP server '{server_nickname}' for method '{method}'"
            logger.error(error_msg)
            # Include recent stderr logs if available
            if server_nickname in self.server_logs and self.server_logs[server_nickname]:
                recent_logs = self.server_logs[server_nickname][-5:]
                logger.error(f"Recent stderr from '{server_nickname}': {recent_logs}")
            raise Exception(error_msg)
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON response from MCP server '{server_nickname}': {e}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Unexpected error communicating with MCP server '{server_nickname}': {e}")
            raise

    async def initialize_server(self, server_nickname: str) -> Dict[str, Any]:
        """Initialize connection with MCP server"""
        return await self.send_request(server_nickname, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "cogzia-mcp-client",
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
                error_msg = f"Error getting tools from {server_name}: {e}"
                logger.error(error_msg)
                all_tools[server_name] = {"error": str(e), "tools": []}

        return all_tools

    def get_server_logs(self, server_nickname: str = None) -> Dict[str, List[str]]:
        """Get stderr logs from MCP servers"""
        if server_nickname:
            return {server_nickname: self.server_logs.get(server_nickname, [])}
        return self.server_logs.copy()

    def get_server_status(self, server_nickname: str) -> Dict[str, Any]:
        """Get detailed status information for a specific server"""
        config = self.registry.get_server_config(server_nickname)
        if not config:
            return {"error": f"Server '{server_nickname}' not found"}
        
        is_running = server_nickname in self.servers
        process = self.servers.get(server_nickname)
        
        status = {
            "name": server_nickname,
            "type": config.server_type,
            "description": config.description,
            "enabled": config.enabled,
            "running": is_running,
            "command": config.command,
            "args": config.args,
        }
        
        if is_running and process:
            status.update({
                "pid": process.pid,
                "poll": process.poll(),  # None if still running, exit code if terminated
            })
            
            # Include recent logs if available
            if server_nickname in self.server_logs:
                status["recent_logs"] = self.server_logs[server_nickname][-10:]  # Last 10 entries
        
        return status
