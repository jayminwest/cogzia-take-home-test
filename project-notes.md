# Project Notes: MCP Chat Interface

## Overview
This is a full-stack application that provides a conversational AI interface for integrating with MCP (Model Context Protocol) servers. The system allows users to dynamically manage multiple MCP servers and interact with them through Claude AI, effectively creating a bridge between Anthropic's Claude and various external tools/services via the MCP protocol.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  MCP Servers    │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│  (Subprocesses) │
│                 │    │                 │    │                 │
│ - Chat UI       │    │ - Server Mgmt   │    │ - Stripe MCP    │
│ - Server Config │    │ - Claude API    │    │ - Git MCP       │
│ - Tool Results  │    │ - MCP Manager   │    │ - Custom MCPs   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Anthropic API  │
                       │    (Claude)     │
                       └─────────────────┘
```

## Core Components Breakdown

### 1. Frontend (`/frontend`)

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript for type safety
- Tailwind CSS v4 for styling
- React hooks for state management

**Key Features:**
- **Chat Interface**: Real-time messaging with Claude AI
- **Server Management**: Dynamic UI for adding/removing/configuring MCP servers
- **Tool Visualization**: JSON tree viewer for complex tool responses
- **Toast Notifications**: User feedback for all operations
- **Server Details Modal**: Comprehensive server status and configuration view

**Main File: `src/app/page.tsx`**
This is the entire frontend application in a single component containing:
- State management for messages, servers, and UI
- Chat functionality with message history
- Server configuration sidebar
- Toast notification system
- JSON tree viewer for tool results
- Server details modal

### 2. Backend (`/backend`)

**Technology Stack:**
- FastAPI for REST API
- Python with asyncio for async operations
- JSON-RPC 2.0 for MCP communication
- Subprocess management for MCP servers
- Anthropic SDK for Claude integration

#### Core Files:

**`main.py`** - FastAPI Application
- REST API endpoints for frontend communication
- Chat endpoint that orchestrates Claude + MCP tool calls
- Server management endpoints (CRUD operations)
- Integration with Anthropic's Claude API
- Tool result processing and conversation continuity

**`mcp_manager.py`** - MCP Server Management
- Subprocess lifecycle management for MCP servers
- JSON-RPC communication with MCP servers
- Server initialization and tool discovery
- Enhanced logging and stderr monitoring
- Error handling and timeout management

**`server_registry.py`** - Server Configuration
- Template-based server configuration system
- Persistent storage in `server_configs.json`
- Built-in templates for Stripe and Git MCP servers
- Server enable/disable functionality
- Environment variable management

**Configuration Files:**
- `server_configs.json`: Persistent server configurations
- `project_servers.json`: Default server templates
- `requirements.txt`: Python dependencies

### 3. MCP (Model Context Protocol) Integration

**What is MCP?**
MCP is a protocol that allows AI assistants to securely connect with external data sources and tools. In this project, MCP servers run as separate processes that expose tools via JSON-RPC.

**Built-in MCP Servers:**
1. **Stripe MCP**: Integrates with Stripe API for payment operations
2. **Git MCP**: Provides Git repository management tools

**Communication Flow:**
1. Frontend selects which MCP servers to use for a conversation
2. Backend discovers available tools from selected servers
3. Claude receives tool definitions and can call them during conversation
4. Backend translates Claude's tool calls to MCP JSON-RPC requests
5. Tool results are returned to Claude for response generation

## Key Workflows

### 1. Chat Conversation Flow
```
User Message → Frontend → Backend → Claude API → Tool Calls → MCP Servers → Results → Claude → Response → Frontend
```

1. User types message in chat interface
2. Frontend sends message + server selection + history to backend
3. Backend gathers available tools from selected MCP servers
4. Backend calls Claude API with tools and conversation context
5. Claude decides if/which tools to use
6. Backend executes tool calls on appropriate MCP servers
7. Tool results are sent back to Claude for final response
8. Complete conversation is returned to frontend
9. Frontend displays messages with tool results in JSON tree format

### 2. Server Management Flow
```
Add Server → Template Selection → Configuration → Subprocess Launch → Tool Discovery → Ready for Use
```

1. User selects server template (Stripe, Git, etc.)
2. Server configuration is saved to registry
3. When selected for chat, subprocess is launched
4. MCP server is initialized via JSON-RPC
5. Available tools are discovered and cached
6. Server is ready to receive tool calls

### 3. MCP Server Lifecycle
```
Configure → Enable → Start Process → Initialize → Discover Tools → Execute Tools → Monitor/Log → Stop
```

- **Configure**: Template-based setup with environment variables
- **Enable**: Mark server as available for use
- **Start Process**: Launch subprocess with stdio pipes
- **Initialize**: JSON-RPC handshake with protocol version
- **Discover Tools**: Query available tools and their schemas
- **Execute Tools**: Handle tool calls during conversations
- **Monitor/Log**: Track stderr output and process health
- **Stop**: Graceful shutdown with cleanup

## Data Flow & State Management

### Frontend State
- **Messages**: Complete conversation history with timestamps
- **Servers**: Available server configurations and status
- **Selected Servers**: Which servers are active for current conversation
- **UI State**: Modal visibility, loading states, toast notifications
- **Server Details**: Cached detailed server information

### Backend State
- **MCP Processes**: Running subprocess instances
- **Server Registry**: Persistent configuration storage
- **Tool Cache**: Discovered tools from each server
- **Logs**: Stderr output from MCP servers

### Persistent Storage
- **`server_configs.json`**: Server configurations
- **Environment Variables**: API keys and secrets
- **Process Memory**: Runtime state and caches

## Security & Environment

**Environment Variables Required:**
- `ANTHROPIC_API_KEY`: For Claude API access
- `STRIPE_SECRET_KEY`: For Stripe MCP server (if used)

**Security Considerations:**
- MCP servers run as isolated subprocesses
- Environment variables are properly isolated
- No direct file system access from frontend
- API keys are server-side only

## Development & Deployment

**Frontend Development:**
```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Production build
npm run lint   # Code quality check
```

**Backend Development:**
```bash
cd backend
pip install -r requirements.txt
python main.py          # Development server
# OR
uvicorn main:app --reload  # Alternative with auto-reload
```

**Key Files to Modify:**
- `frontend/src/app/page.tsx`: All frontend functionality
- `backend/main.py`: API endpoints and chat logic
- `backend/mcp_manager.py`: MCP server management
- `backend/server_registry.py`: Server configuration templates

## Recent Enhancements (Your Additions)

1. **Toast Notifications**: User feedback system for all operations
2. **JSON Tree Viewer**: Structured display of complex tool results
3. **Enhanced Logging**: Comprehensive MCP server monitoring with stderr capture
4. **Server Details Modal**: Complete server management interface

## Talking Points for Interviews

**Architecture Decisions:**
- Why FastAPI: Async support, automatic OpenAPI docs, type hints
- Why Next.js: Modern React framework with SSR capabilities
- Why subprocess management: Isolation and security for MCP servers
- Why JSON-RPC: Standard protocol for MCP communication

**Technical Challenges Solved:**
- Managing multiple concurrent MCP server processes
- Handling async communication between Claude and MCP servers
- Maintaining conversation context across tool calls
- Real-time subprocess monitoring and logging
- Type-safe communication between frontend and backend

**Scalability Considerations:**
- Template-based server configuration for easy extension
- Modular architecture allows adding new MCP servers
- Async/await patterns for handling multiple concurrent operations
- Proper error handling and timeout management

**User Experience Features:**
- Real-time chat interface with tool result visualization
- Dynamic server selection per conversation
- Comprehensive error handling with user-friendly messages
- Server management UI with detailed status information

This architecture demonstrates full-stack development, API integration, process management, real-time communication, and modern web development practices.