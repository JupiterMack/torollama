#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { TorNetworkClient } from "./tor-client.js";
import { TorTools } from "./tor-tools.js";

/**
 * TorOllama MCP Server
 * 
 * Provides TOR network connectivity tools for Ollama models, enabling:
 * - Anonymous HTTP requests through TOR
 * - Access to .onion hidden services
 * - IP geolocation and anonymity verification
 * - TOR circuit management
 */
class TorOllamaMcpServer {
  private server: Server;
  private torClient: TorNetworkClient;
  private torTools: TorTools;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: "torollama-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize TOR client and tools
    this.torClient = new TorNetworkClient();
    this.torTools = new TorTools(this.torClient);

    this.setupErrorHandling();
    this.setupToolHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "tor_request",
            description: "Make HTTP requests through the TOR network for anonymity",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The URL to request (supports both clearnet and .onion URLs)",
                },
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                  default: "GET",
                  description: "HTTP method to use",
                },
                headers: {
                  type: "object",
                  description: "HTTP headers to include in the request",
                  additionalProperties: { type: "string" },
                },
                body: {
                  type: "string",
                  description: "Request body (for POST, PUT, PATCH methods)",
                },
                timeout: {
                  type: "number",
                  default: 30000,
                  description: "Request timeout in milliseconds",
                },
              },
              required: ["url"],
            },
          },
          {
            name: "check_tor_connection",
            description: "Verify TOR connection and check current IP address",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_tor_status",
            description: "Get detailed TOR network status and configuration",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "new_tor_circuit",
            description: "Request a new TOR circuit for fresh anonymity",
            inputSchema: {
              type: "object",
              properties: {
                reason: {
                  type: "string",
                  description: "Reason for requesting new circuit (optional)",
                },
              },
            },
          },
          {
            name: "search_onion_services",
            description: "Search for .onion hidden services by category or keyword",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query or category (e.g., 'search engines', 'social media', etc.)",
                },
                limit: {
                  type: "number",
                  default: 10,
                  description: "Maximum number of results to return",
                },
              },
              required: ["query"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "tor_request":
            return await this.torTools.makeRequest(args);

          case "check_tor_connection":
            return await this.torTools.checkConnection();

          case "get_tor_status":
            return await this.torTools.getStatus();

          case "new_tor_circuit":
            return await this.torTools.newCircuit(args);

          case "search_onion_services":
            return await this.torTools.searchOnionServices(args);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.torClient.cleanup();
      console.log("[TorOllama] Cleanup completed");
    } catch (error) {
      console.error("[TorOllama] Cleanup error:", error);
    }
  }

  public async start(): Promise<void> {
    // Initialize TOR client
    await this.torClient.initialize();

    // Create transport and connect
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("[TorOllama] MCP Server started successfully");
    console.error("[TorOllama] TOR network connectivity enabled");
  }
}

// Start the server
async function main(): Promise<void> {
  try {
    const mcpServer = new TorOllamaMcpServer();
    await mcpServer.start();
  } catch (error) {
    console.error("[TorOllama] Failed to start server:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[TorOllama] Fatal error:", error);
    process.exit(1);
  });
}