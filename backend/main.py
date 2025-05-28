import uvicorn
import json
import os
from typing import List, Dict, Optional
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from mcp_manager import MCPServerManager
from server_registry import ServerRegistry
import anthropic

# Load environment variables
load_dotenv()

# Initialize Server Registry and MCP Server Manager
server_registry = ServerRegistry()
mcp_manager = MCPServerManager(server_registry)

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown - clean up MCP servers
    await mcp_manager.stop_all_servers()

# Initialize the FastAPI app
app = FastAPI(lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Pydantic Models


class MCPToolRequest(BaseModel):
    server_nickname: str
    tool_name: str
    json_arguments: str


class ChatMessage(BaseModel):
    role: str
    content: str
    toolName: Optional[str] = None
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    enabled_servers: Optional[List[str]] = None  # Which servers to use for this chat


class AddServerRequest(BaseModel):
    name: str
    server_type: str
    custom_args: Optional[List[str]] = None
    env_vars: Optional[Dict[str, str]] = None


class ServerStatusRequest(BaseModel):
    name: str
    enabled: bool

# List available tools from an MCP server


@app.get("/list-tools/{server_nickname}")
async def list_tools(server_nickname: str):
    try:
        # Initialize server if needed
        if server_nickname not in mcp_manager.servers:
            await mcp_manager.initialize_server(server_nickname)

        # List tools
        tools = await mcp_manager.list_tools(server_nickname)

        return {
            "success": True,
            "server_nickname": server_nickname,
            "tools": tools
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "server_nickname": server_nickname
        }

# API Endpoint (/call-mcp-tool)


@app.post("/call-mcp-tool")
async def call_mcp_tool(request: MCPToolRequest):
    try:
        # Parse JSON arguments
        arguments = json.loads(request.json_arguments) if request.json_arguments else {}

        # Initialize server if needed
        if request.server_nickname not in mcp_manager.servers:
            await mcp_manager.initialize_server(request.server_nickname)

        # Call the tool
        result = await mcp_manager.call_tool(
            request.server_nickname,
            request.tool_name,
            arguments
        )

        return {
            "success": True,
            "data": result,
            "server_nickname": request.server_nickname,
            "tool_name": request.tool_name
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "server_nickname": request.server_nickname,
            "tool_name": request.tool_name
        }

# Server Management Endpoints


@app.get("/servers")
async def list_servers():
    """List all available MCP servers"""
    try:
        servers = mcp_manager.list_available_servers()
        return {
            "success": True,
            "servers": servers
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/server-templates")
async def list_server_templates():
    """List all available server templates"""
    try:
        templates = server_registry.get_templates()
        template_list = {}
        for name, template in templates.items():
            template_list[name] = {
                "server_type": template.server_type,
                "command": template.command,
                "base_args": template.base_args,
                "env_requirements": template.env_requirements,
                "description": template.description
            }
        return {
            "success": True,
            "templates": template_list
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/servers")
async def add_server(request: AddServerRequest):
    """Add a new MCP server from template"""
    try:
        success = server_registry.add_server_from_template(
            name=request.name,
            server_type=request.server_type,
            custom_args=request.custom_args,
            env_vars=request.env_vars
        )

        if success:
            return {
                "success": True,
                "message": f"Server '{request.name}' added successfully"
            }
        else:
            return {
                "success": False,
                "error": f"Failed to add server '{request.name}'. Unknown server type '{request.server_type}'"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.delete("/servers/{server_name}")
async def remove_server(server_name: str):
    """Remove an MCP server"""
    try:
        # Stop server if running
        if server_name in mcp_manager.servers:
            await mcp_manager.stop_server(server_name)

        # Remove from registry
        success = server_registry.remove_server(server_name)

        if success:
            return {
                "success": True,
                "message": f"Server '{server_name}' removed successfully"
            }
        else:
            return {
                "success": False,
                "error": f"Server '{server_name}' not found"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.patch("/servers/{server_name}/status")
async def update_server_status(server_name: str, request: ServerStatusRequest):
    """Enable or disable an MCP server"""
    try:
        if request.enabled:
            success = server_registry.enable_server(server_name)
        else:
            # Stop server if running before disabling
            if server_name in mcp_manager.servers:
                await mcp_manager.stop_server(server_name)
            success = server_registry.disable_server(server_name)

        if success:
            status = "enabled" if request.enabled else "disabled"
            return {
                "success": True,
                "message": f"Server '{server_name}' {status} successfully"
            }
        else:
            return {
                "success": False,
                "error": f"Server '{server_name}' not found"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

# Get available tools for the AI model
async def get_available_tools(enabled_servers: List[str] = None):
    tools = []

    # If no specific servers requested, use all enabled servers
    if enabled_servers is None:
        enabled_servers = list(server_registry.list_servers().keys())

    for server_name in enabled_servers:
        try:
            # Check if server is enabled
            server_config = server_registry.get_server_config(server_name)
            if not server_config or not server_config.enabled:
                continue

            # Initialize server if needed
            if server_name not in mcp_manager.servers:
                await mcp_manager.initialize_server(server_name)

            # Get tools from server
            server_tools = await mcp_manager.list_tools(server_name)

            # Format tools for Anthropic (sanitize server name for tool prefix)
            sanitized_server_name = server_name.replace(" ", "_").replace("-", "_")
            for tool in server_tools.get("tools", []):
                tools.append({
                    "name": f"{sanitized_server_name}_{tool['name']}",
                    "description": tool.get("description", ""),
                    "input_schema": tool.get("inputSchema", {})
                })
        except Exception as e:
            print(f"Error getting tools from {server_name}: {e}")

    return tools

# Chat endpoint


@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        # Get available tools from specified servers (or all enabled servers)
        available_tools = await get_available_tools(request.enabled_servers)

        # Convert history to Anthropic format
        messages = []
        for msg in request.history:
            if msg.role in ["user", "assistant"]:
                messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        # Add new user message
        messages.append({
            "role": "user",
            "content": request.message
        })

        # Make request to Anthropic
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            tools=available_tools,
            messages=messages
        )

        response_messages = []

        # Handle tool use properly for conversation continuity
        if response.stop_reason == "tool_use":
            # Process all tool calls
            tool_results = []

            for content_block in response.content:
                if content_block.type == "tool_use":
                    tool_name = content_block.name
                    tool_input = content_block.input

                    # Extract server from tool name (Git_MCP_toolname -> Git MCP)
                    # Handle sanitized server names
                    if tool_name.startswith("Git_MCP_"):
                        server_nickname = "Git MCP"
                        actual_tool_name = "_".join(tool_name.split("_")[2:])
                    else:
                        server_nickname = tool_name.split("_")[0]
                        actual_tool_name = "_".join(tool_name.split("_")[1:])

                    try:
                        # Call the MCP tool
                        tool_result = await mcp_manager.call_tool(
                            server_nickname,
                            actual_tool_name,
                            tool_input
                        )

                        # Store tool result for the conversation
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": json.dumps(tool_result)
                        })

                        # Add tool result message for UI display
                        response_messages.append({
                            "role": "tool",
                            "content": json.dumps(tool_result, indent=2),
                            "toolName": actual_tool_name,
                            "timestamp": None
                        })

                    except Exception as tool_error:
                        # Add error as tool result
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": f"Error: {str(tool_error)}"
                        })

                        response_messages.append({
                            "role": "tool",
                            "content": f"Error calling tool {actual_tool_name}: {str(tool_error)}",
                            "toolName": actual_tool_name,
                            "timestamp": None
                        })

            # Continue conversation with tool results
            if tool_results:
                # Add assistant message with tool use
                messages.append({
                    "role": "assistant",
                    "content": response.content
                })

                # Add tool results
                messages.append({
                    "role": "user",
                    "content": tool_results
                })

                # Get Claude's response to the tool results
                follow_up_response = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=1000,
                    tools=available_tools,
                    messages=messages
                )

                # Add Claude's final response
                response_messages.append({
                    "role": "assistant",
                    "content": follow_up_response.content[0].text,
                    "timestamp": None
                })

        else:
            # Regular text response
            response_messages.append({
                "role": "assistant",
                "content": response.content[0].text,
                "timestamp": None
            })

        return {"messages": response_messages}

    except Exception as e:
        return {
            "messages": [{
                "role": "assistant",
                "content": f"Sorry, I encountered an error: {str(e)}",
                "timestamp": None
            }]
        }

# Basic Uvicorn Runner
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
