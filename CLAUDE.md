# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack application for integrating MCP (Model Context Protocol) servers through a conversational AI interface. Built with Next.js, FastAPI, and Anthropic's Claude, supporting dynamic MCP server management with Stripe and Git MCP integrations.

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install         # Install dependencies
npm run dev         # Start development server with Turbopack
npm run build       # Create production build
npm run start       # Run production server
npm run lint        # Run ESLint
npx tsc --noEmit    # TypeScript type checking
```

### Backend (FastAPI)
```bash
# IMPORTANT: Always run from the backend directory
cd backend
pip install -r requirements.txt  # Install dependencies (fastapi, uvicorn, anthropic, python-dotenv, pydantic)
python main.py                   # Run development server
# OR
uvicorn main:app --reload        # Alternative with auto-reload
```

## Architecture

### Backend (`/backend`)
- **FastAPI** application with async/await patterns and CORS enabled
- **Dynamic MCP Server Registry** (`server_registry.py`): Template-based server management system
- **MCP Manager** (`mcp_manager.py`): Handles server lifecycle, tool discovery, and JSON-RPC communication
- **API Endpoints**:
  - `POST /chat`: Conversational AI with selected MCP servers
  - `POST /call-mcp-tool`: Direct MCP tool invocation
  - `GET /servers`: List all configured servers
  - `POST /servers`: Add new server from template
  - `DELETE /servers/{server_name}`: Remove server
  - `PATCH /servers/{server_name}/status`: Enable/disable server
  - `GET /server-templates`: Available server templates
  - `GET /list-tools/{server_nickname}`: Tools from specific server
- Server configurations stored in `server_configs.json`
- Environment variables loaded from `.env` file

### Frontend (`/frontend`)
- **Next.js 15** with App Router and TypeScript
- **Tailwind CSS v4** for styling
- **Server Selection UI**: Dynamic checkbox interface for activating MCP servers per conversation
- **Chat Interface**: Real-time messaging with tool call visualization
- **Message History**: Full conversation context maintained
- Main application in `src/app/page.tsx`

## Key Integration Points

1. **MCP Server Communication**: JSON-RPC 2.0 over stdio with subprocess management
2. **Dynamic Server Registry**: Template system for Stripe and Git MCP servers
3. **Tool Discovery**: Automatic tool enumeration when servers initialize
4. **Anthropic Integration**: Claude 3.5 Sonnet with parallel tool calling support
5. **Conversation Context**: Full message history with selected servers maintained per session

## MCP Server Templates

Built-in templates in `server_registry.py`:
- **Stripe MCP**: Requires `STRIPE_SECRET_KEY` environment variable
- **Git MCP**: Requires repository path configuration

## Environment Variables

Create `.env` file in backend directory:
```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```