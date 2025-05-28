# cogznia-take-home-test

A full-stack application for testing MCP (Model Context Protocol) server integrations through a web interface.

## Overview

This project provides a web-based interface to interact with MCP servers (Supabase and Stripe) through a FastAPI backend proxy.

## Project Structure

```
├── frontend/          # Next.js frontend application
├── backend/           # FastAPI backend server
└── CLAUDE.md         # Development guide for AI assistants
```

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the server:
   ```bash
   python main.py
   ```

The backend will start on `http://localhost:8000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

The frontend will start on `http://localhost:3000`.

## Usage

1. Start both the backend and frontend servers
2. Open `http://localhost:3000` in your browser
3. Click the "Test API Call" button to send a request to the FastAPI backend
4. View the response in the UI

## API Endpoint

The backend exposes a single endpoint:

- `POST /call-mcp-tool`
  - Accepts: `server_nickname`, `tool_name`, and `arguments`
  - Returns: Response from the specified MCP server tool
