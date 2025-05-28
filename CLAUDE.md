# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack application for integrating MCP (Model Context Protocol) servers through a web interface. It consists of a Next.js frontend and a FastAPI backend.

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
- Single endpoint: `POST /call-mcp-tool` that accepts:
  - `server_nickname`: string (e.g., "supabase", "stripe")
  - `tool_name`: string
  - `arguments`: JSON object
- MCP server configuration in `project_servers.json`
- Currently configured for Supabase and Stripe MCP servers

### Frontend (`/frontend`)
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- Main application logic in `src/app/`

## Key Integration Points

The backend serves as a proxy for MCP tool calls. The frontend should make POST requests to `http://localhost:8000/call-mcp-tool` with the appropriate server nickname, tool name, and arguments.

## MCP Servers Configuration

The `project_servers.json` file contains the MCP server configurations for Supabase and Stripe integrations. These are used by the backend to route tool calls to the appropriate MCP server.