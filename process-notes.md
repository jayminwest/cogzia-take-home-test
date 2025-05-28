# Take Home Test Thinking Process:

- Starting ~9am
- Using KOTA to plan out project based on specifications described during our meeting
- Using Aider for simple commands for setting up the frontend and backend templates
- Telling AI agent's to dial it back on how much to implement at once for easier iteration
- Correcting the agent to NOT create a new project file
- Backend and frontend templates setup (9:10am)
- Setting up minimalistic frontend that connnects to the backend on a new git branch to avoid agent mistakes causing problems
- Backend and frontend communicating (9:17am)
- Reviewing AI code, reading through the setup so far
- Had Claude Code do online research about how to best setup the MCP integration, tasked it with creating a plan and working in smaller steps (9:27am)
- Setting up JSON-RPC communication for MCP servers (9:32am)
- Supabase MCP tool setup, issues communicating with actual server on backend (9:44am)
- Running into problems with getting the MCP server to actually work with supabase
- Instructing agent to avoid writing work arounds and getting to the bottom of the supabase timeout issue (9:57am)

- Break for meeting 10-11am

- Got stripe MCP working (supabase server has a bug), setup chat interface and got model calling MCP tools (11:10am)
- Updating model to be able to handle multiturn conversations with conversational memory (11:14)
- Agent is able to correctly call tools (11:16)
- Updating codebase so that the MCP servers available is configurable and not hard coded (11:24)
- Update for multiple, custom MCP servers complete. Testing. (11:31)
- Multiple configurable MCP's working within chat (11:47)
- Running cleanup on project, linting, type checking, and organizing (11:50)
- Linting checks and cleanup complete (12:00)
