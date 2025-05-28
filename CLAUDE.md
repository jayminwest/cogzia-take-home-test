# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack application for integrating MCP (Model Context Protocol) servers through a web interface. It consists of a Next.js frontend and a FastAPI backend with Stripe MCP server integration.

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm install         # Install dependencies
npm run dev         # Start development server with Turbopack
npm run build       # Create production build
npm run start       # Run production server
npm run lint        # Run ESLint
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt  # Install dependencies
python main.py                   # Run development server
# OR
uvicorn main:app --reload        # Alternative way to run with auto-reload
```

## Architecture

### Backend (`/backend`)
- **FastAPI** application with CORS enabled
- **Chat Interface**: `POST /chat` endpoint for conversational AI with MCP tool access
- **Direct Tool Access**: `POST /call-mcp-tool` endpoint for direct tool calls
- **Anthropic Integration**: Uses Claude for natural language processing with tool calling
- MCP server configuration in `project_servers.json`
- Currently configured for Stripe MCP server integration

### Frontend (`/frontend`)
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **Chat Interface** for natural conversations with AI assistant
- **Real-time messaging** with tool call visualization
- Main application logic in `src/app/`

## Key Integration Points

The backend serves as a proxy for MCP tool calls and provides an AI chat interface:

1. **Chat Interface**: POST to `http://localhost:8000/chat` with message and conversation history
2. **Direct Tool Access**: POST to `http://localhost:8000/call-mcp-tool` for direct tool calls
3. **AI Integration**: Claude automatically calls MCP tools when needed during conversations

## MCP Servers Configuration

The `project_servers.json` file contains the MCP server configuration for Stripe integration. The backend automatically initializes and manages the MCP server process.

## Environment Variables

Create a `.env` file in the backend directory with:
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude integration