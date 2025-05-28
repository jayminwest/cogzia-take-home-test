# MCP Chat Interface

A full-stack application demonstrating integration with MCP (Model Context Protocol) servers through a conversational AI interface. Built with Next.js, FastAPI, and Anthropic's Claude.

## Features

- **Conversational AI Interface**: Natural language chat with Claude
- **Dynamic MCP Server Management**: Add/remove/configure MCP servers at runtime
- **Multiple MCP Integrations**: Currently supports Stripe and Git MCP servers
- **Server Selection**: Choose which MCP servers are active for each conversation
- **Real-time Communication**: Live chat with message history
- **Tool Call Visualization**: See when and how MCP tools are used
- **Multi-turn Conversations**: Maintains context across the entire session

## Architecture

### Frontend (`/frontend`)
- **Next.js 15** with App Router and TypeScript
- **Tailwind CSS v4** for modern styling
- Real-time chat interface with message history
- Tool call visualization and status indicators

### Backend (`/backend`)
- **FastAPI** with async/await patterns
- **Anthropic Claude** integration for natural language processing
- **Dynamic MCP Server Registry** with template system
- **Multiple MCP Server Support** (Stripe, Git MCP)
- Automatic tool discovery and calling
- Conversation state management
- RESTful APIs for server management

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Stripe account (for API key)
- Anthropic API key

### 1. Backend Setup
```bash
# IMPORTANT: Always run from the backend directory
cd backend

pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Add your keys:
# STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Run the server (from backend directory!)
python main.py
```

> **⚠️ Important**: Always run the backend server from the `backend/` directory, not from the project root. The server registry looks for `server_configs.json` in the current working directory.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Access the Application
- Open http://localhost:3000 in your browser
- Configure which MCP servers you want active using the server selection interface
- Start chatting! Ask about Stripe operations or Git repository questions

## Usage Examples

The AI assistant can help with operations from your selected MCP servers:

### Stripe Operations
- "Show me my recent customers"
- "What payment methods do I have?"
- "Create a new product"
- "List all my invoices"
- "Help me understand my account balance"

### Git Repository Operations
- "What's the status of this repository?"
- "Show me the recent commit history"
- "List all branches in this repo"
- "Create a new branch called 'feature-x'"
- "What files have been modified?"

The assistant will automatically call the appropriate MCP tools based on your request and active servers.

## API Endpoints

### Chat Interface
- `POST /chat` - Main chat interface with conversation history and server selection
- `POST /call-mcp-tool` - Direct MCP tool calling
- `GET /list-tools/{server_nickname}` - List available tools from a specific server

### Server Management
- `GET /servers` - List all configured MCP servers
- `GET /server-templates` - List available server templates
- `POST /servers` - Add a new MCP server from template
- `DELETE /servers/{server_name}` - Remove an MCP server
- `PATCH /servers/{server_name}/status` - Enable/disable an MCP server

## Development

### Type Checking & Linting
```bash
cd frontend
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript checking
```

### MCP Server Configuration
- Use the frontend UI to add/remove/configure MCP servers dynamically
- Server configurations are stored in `backend/server_configs.json`
- Built-in templates available for: Stripe, Git MCP
- Add custom servers through the `/servers` API endpoints

## Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS v4
- **Backend**: FastAPI, Python, Anthropic SDK
- **MCP Integration**: Stripe MCP, Git MCP servers via npx
- **Communication**: JSON-RPC 2.0 over stdio
- **AI**: Claude 3.5 Sonnet with tool calling
- **Server Management**: Dynamic MCP server registry with templates

## Contributing

This is a take-home test project demonstrating MCP integration capabilities.
