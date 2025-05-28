import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Initialize the FastAPI app
app = FastAPI()

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

# API Endpoint Stub (/call-mcp-tool)
@app.post("/call-mcp-tool")
async def call_mcp_tool(request: MCPToolRequest):
    # Log the received request (simple print for now)
    print(f"Received request: {request.dict()}")
    return {
        "success": True,
        "data": {"message": "Endpoint hit, MCP interaction not yet implemented"},
        "server_nickname": request.server_nickname,
        "tool_name": request.tool_name
    }

# Basic Uvicorn Runner
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
