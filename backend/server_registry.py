"""
Server Registry for managing MCP server configurations dynamically.
Provides templates for common servers and allows runtime server management.
"""

import json
import os
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from dataclasses import dataclass


class ServerConfig(BaseModel):
    """Configuration for an MCP server instance"""
    name: str  # unique identifier
    server_type: str  # template type (stripe, supabase, etc.)
    command: str
    args: List[str]
    env_vars: Dict[str, str] = {}  # environment variables to set
    description: str = ""
    enabled: bool = True

@dataclass


class ServerTemplate:
    """Template for creating server configurations"""
    server_type: str
    command: str
    base_args: List[str]
    env_requirements: List[str]  # Required env vars
    description: str


class ServerRegistry:
    """Manages MCP server configurations and templates"""

    # Built-in server templates
    TEMPLATES = {
        "stripe": ServerTemplate(
            server_type="stripe",
            command="npx",
            base_args=["-y", "@stripe/mcp", "--tools=all"],
            env_requirements=["STRIPE_SECRET_KEY"],
            description="Stripe payment processing tools"
        ),
        "git-mcp": ServerTemplate(
            server_type="git-mcp",
            command="npx",
            base_args=["-y", "git-mcp-server"],
            env_requirements=[],
            description="Git repository operations and management tools"
        )
    }


    def __init__(self, config_file: str = "server_configs.json"):
        self.config_file = config_file
        self.configs: Dict[str, ServerConfig] = {}
        self._load_configurations()


    def _load_configurations(self):
        """Load server configurations from file"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    for name, config_data in data.items():
                        self.configs[name] = ServerConfig(**config_data)
            except Exception as e:
                print(f"Error loading server configs: {e}")
                # Start with empty configs if file is corrupted
                self.configs = {}
        else:
            # Initialize with default Stripe config for backward compatibility
            self.add_server_from_template("stripe", "stripe")
            self._save_configurations()


    def _save_configurations(self):
        """Save server configurations to file"""
        try:
            data = {}
            for name, config in self.configs.items():
                data[name] = config.model_dump()

            with open(self.config_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving server configs: {e}")


    def get_templates(self) -> Dict[str, ServerTemplate]:
        """Get all available server templates"""
        return self.TEMPLATES.copy()


    def get_template(self, server_type: str) -> Optional[ServerTemplate]:
        """Get a specific server template"""
        return self.TEMPLATES.get(server_type)


    def add_server_from_template(self, name: str, server_type: str,
                                 custom_args: List[str] = None,
                                 env_vars: Dict[str, str] = None) -> bool:
        """Create a server configuration from a template"""
        template = self.get_template(server_type)
        if not template:
            return False

        # Check if required environment variables are available
        missing_env_vars = []
        for env_var in template.env_requirements:
            if not os.getenv(env_var) and (not env_vars or env_var not in env_vars):
                missing_env_vars.append(env_var)

        if missing_env_vars:
            print(f"Warning: Missing required environment variables for {server_type}: {missing_env_vars}")

        # Build args (template base + custom)
        args = template.base_args.copy()
        if custom_args:
            args.extend(custom_args)

        config = ServerConfig(
            name=name,
            server_type=server_type,
            command=template.command,
            args=args,
            env_vars=env_vars or {},
            description=template.description,
            enabled=True
        )

        self.configs[name] = config
        self._save_configurations()
        return True


    def add_custom_server(self, config: ServerConfig) -> bool:
        """Add a custom server configuration"""
        self.configs[config.name] = config
        self._save_configurations()
        return True


    def remove_server(self, name: str) -> bool:
        """Remove a server configuration"""
        if name in self.configs:
            del self.configs[name]
            self._save_configurations()
            return True
        return False


    def get_server_config(self, name: str) -> Optional[ServerConfig]:
        """Get a server configuration by name"""
        return self.configs.get(name)


    def list_servers(self, enabled_only: bool = True) -> Dict[str, ServerConfig]:
        """List all server configurations"""
        if enabled_only:
            return {name: config for name, config in self.configs.items() if config.enabled}
        return self.configs.copy()


    def enable_server(self, name: str) -> bool:
        """Enable a server"""
        if name in self.configs:
            self.configs[name].enabled = True
            self._save_configurations()
            return True
        return False


    def disable_server(self, name: str) -> bool:
        """Disable a server"""
        if name in self.configs:
            self.configs[name].enabled = False
            self._save_configurations()
            return True
        return False


    def get_legacy_format(self, server_names: List[str] = None) -> Dict[str, Dict[str, Any]]:
        """Convert configurations to legacy project_servers.json format"""
        servers_to_include = server_names or list(self.configs.keys())
        legacy_format = {}

        for name in servers_to_include:
            if name in self.configs and self.configs[name].enabled:
                config = self.configs[name]
                legacy_format[name] = {
                    "command": config.command,
                    "args": config.args,
                    "env": config.env_vars
                }

        return legacy_format
