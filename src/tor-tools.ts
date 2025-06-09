import { z } from 'zod';
import { TorNetworkClient, type TorRequestOptions } from './tor-client.js';

export interface OnionService {
  name: string;
  url: string;
  description: string;
  category: string;
  verified: boolean;
}

/**
 * TOR Tools for MCP Server
 * 
 * Provides high-level tools for interacting with the TOR network:
 * - HTTP requests through TOR
 * - Connection verification
 * - Circuit management
 * - Onion service discovery
 */
export class TorTools {
  private torClient: TorNetworkClient;

  // Well-known onion services for discovery
  private knownOnionServices: OnionService[] = [
    {
      name: "DuckDuckGo",
      url: "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion",
      description: "Privacy-focused search engine",
      category: "search",
      verified: true
    },
    {
      name: "Facebook",
      url: "https://facebookwkhpilnemxj7asaniu7vnjjbiltxjqhye3mhbshg7kx5tfyd.onion",
      description: "Social networking platform",
      category: "social",
      verified: true
    },
    {
      name: "The New York Times",
      url: "https://nytimes3xbfgragh.onion",
      description: "News and journalism",
      category: "news",
      verified: true
    },
    {
      name: "ProPublica",
      url: "https://p53lf57qovyuvwsc6xnrppddxpr23otqjb4a6d7vyb2ot2ouu7qd.onion",
      description: "Investigative journalism",
      category: "news",
      verified: true
    },
    {
      name: "BBC News",
      url: "https://bbcnewsv2vjtpsuy.onion",
      description: "British news service",
      category: "news",
      verified: true
    },
    {
      name: "Keybase",
      url: "https://keybase5wmilwokqirssclfnsqrjdsi7jdir5wy7y7iu3tanwmtp6oid.onion",
      description: "Secure messaging and file sharing",
      category: "communication",
      verified: true
    },
    {
      name: "Privacy International",
      url: "https://privacyintyqcroe.onion",
      description: "Privacy rights organization",
      category: "privacy",
      verified: true
    },
    {
      name: "SecureDrop",
      url: "https://secrdrop5wyphb5x.onion",
      description: "Secure document sharing for journalists",
      category: "security",
      verified: true
    }
  ];

  constructor(torClient: TorNetworkClient) {
    this.torClient = torClient;
  }

  /**
   * Make HTTP request through TOR
   */
  public async makeRequest(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      url: z.string().url(),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
      timeout: z.number().positive().default(30000),
    });

    const { url, method, headers, body, timeout } = schema.parse(args);

    try {
      const options: TorRequestOptions = {
        method,
        headers: {
          'User-Agent': 'TorOllama-MCP/1.0.0',
          ...headers,
        },
        timeout,
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = body;
      }

      const response = await this.torClient.request(url, options);
      const responseText = await response.text();

      const isOnion = url.includes('.onion');
      const statusInfo = `${response.status} ${response.statusText}`;
      
      return {
        content: [
          {
            type: "text",
            text: `**TOR Request Results**\n\n` +
                  `**URL:** ${url}\n` +
                  `**Method:** ${method}\n` +
                  `**Status:** ${statusInfo}\n` +
                  `**Network:** ${isOnion ? 'Hidden Service (.onion)' : 'Clearnet via TOR'}\n` +
                  `**Response Size:** ${responseText.length} bytes\n\n` +
                  `**Headers:**\n${this.formatHeaders(response.headers)}\n\n` +
                  `**Response Body:**\n\`\`\`\n${responseText.slice(0, 4000)}${responseText.length > 4000 ? '\n... (truncated)' : ''}\n\`\`\``
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `**TOR Request Failed**\n\n` +
                  `**URL:** ${url}\n` +
                  `**Method:** ${method}\n` +
                  `**Error:** ${errorMessage}\n\n` +
                  `This could be due to:\n` +
                  `- Network connectivity issues\n` +
                  `- TOR circuit problems\n` +
                  `- Target server unavailable\n` +
                  `- Invalid .onion address\n\n` +
                  `Try requesting a new TOR circuit if the issue persists.`
          }
        ]
      };
    }
  }

  /**
   * Check TOR connection status
   */
  public async checkConnection(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const isConnected = await this.torClient.checkConnection();
      const status = await this.torClient.getStatus();

      if (isConnected) {
        return {
          content: [
            {
              type: "text",
              text: `**TOR Connection Status: ✅ CONNECTED**\n\n` +
                    `**Current IP:** ${status.currentIP || 'Unknown'}\n` +
                    `**TOR Version:** ${status.torVersion || 'Unknown'}\n` +
                    `**Circuit Established:** ${status.circuitEstablished ? 'Yes' : 'No'}\n` +
                    `**Last Circuit:** ${status.lastCircuitTime ? status.lastCircuitTime.toISOString() : 'N/A'}\n\n` +
                    `Your connection is routed through the TOR network and your IP is anonymized.`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `**TOR Connection Status: ❌ DISCONNECTED**\n\n` +
                    `The TOR connection is not working properly. This could be due to:\n` +
                    `- TOR daemon not running\n` +
                    `- Network connectivity issues\n` +
                    `- Firewall blocking TOR traffic\n` +
                    `- SOCKS proxy configuration problems\n\n` +
                    `Please check your TOR installation and network configuration.`
            }
          ]
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `**TOR Connection Check Failed**\n\n` +
                  `**Error:** ${errorMessage}\n\n` +
                  `Unable to verify TOR connection status.`
          }
        ]
      };
    }
  }

  /**
   * Get detailed TOR status
   */
  public async getStatus(): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      const status = await this.torClient.getStatus();
      
      return {
        content: [
          {
            type: "text",
            text: `**TOR Network Status**\n\n` +
                  `**Connection:** ${status.isConnected ? '✅ Connected' : '❌ Disconnected'}\n` +
                  `**Circuit:** ${status.circuitEstablished ? '✅ Established' : '❌ Not Established'}\n` +
                  `**Current IP:** ${status.currentIP || 'Unknown'}\n` +
                  `**TOR Version:** ${status.torVersion || 'Unknown'}\n` +
                  `**Circuit Count:** ${status.circuitCount || 'Unknown'}\n` +
                  `**Last Circuit Time:** ${status.lastCircuitTime ? status.lastCircuitTime.toISOString() : 'N/A'}\n\n` +
                  `**Network Information:**\n` +
                  `- Traffic is ${status.isConnected ? 'anonymized' : 'NOT anonymized'} through TOR\n` +
                  `- ${status.circuitEstablished ? 'Ready for .onion services' : 'Cannot access .onion services'}\n` +
                  `- Connection quality: ${this.getConnectionQuality(status)}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `**TOR Status Check Failed**\n\n` +
                  `**Error:** ${errorMessage}`
          }
        ]
      };
    }
  }

  /**
   * Request new TOR circuit
   */
  public async newCircuit(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      reason: z.string().optional(),
    });

    const { reason } = schema.parse(args);

    try {
      const success = await this.torClient.newCircuit();
      
      if (success) {
        const status = await this.torClient.getStatus();
        
        return {
          content: [
            {
              type: "text",
              text: `**New TOR Circuit Established ✅**\n\n` +
                    `${reason ? `**Reason:** ${reason}\n` : ''}` +
                    `**New IP:** ${status.currentIP || 'Checking...'}\n` +
                    `**Circuit Time:** ${new Date().toISOString()}\n\n` +
                    `Your anonymity has been refreshed with a new route through the TOR network.`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `**Failed to Create New Circuit ❌**\n\n` +
                    `Unable to establish a new TOR circuit. This could be due to:\n` +
                    `- TOR control port access issues\n` +
                    `- Network congestion\n` +
                    `- TOR daemon configuration problems\n\n` +
                    `Try again in a few moments.`
            }
          ]
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `**Circuit Creation Failed**\n\n` +
                  `**Error:** ${errorMessage}`
          }
        ]
      };
    }
  }

  /**
   * Search for onion services
   */
  public async searchOnionServices(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      query: z.string(),
      limit: z.number().positive().default(10),
    });

    const { query, limit } = schema.parse(args);

    try {
      const searchTerm = query.toLowerCase();
      
      // Filter known onion services based on query
      const results = this.knownOnionServices.filter(service => 
        service.name.toLowerCase().includes(searchTerm) ||
        service.description.toLowerCase().includes(searchTerm) ||
        service.category.toLowerCase().includes(searchTerm)
      ).slice(0, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `**No Onion Services Found**\n\n` +
                    `No known onion services match "${query}".\n\n` +
                    `**Available Categories:**\n` +
                    `- search (search engines)\n` +
                    `- news (journalism and news)\n` +
                    `- social (social media)\n` +
                    `- communication (messaging)\n` +
                    `- privacy (privacy tools)\n` +
                    `- security (security tools)\n\n` +
                    `Try searching by category or service name.`
            }
          ]
        };
      }

      const resultText = results.map(service => 
        `**${service.name}** ${service.verified ? '✅' : '⚠️'}\n` +
        `- **URL:** ${service.url}\n` +
        `- **Category:** ${service.category}\n` +
        `- **Description:** ${service.description}\n`
      ).join('\n');

      return {
        content: [
          {
            type: "text",
            text: `**Onion Services Found (${results.length})**\n\n` +
                  `${resultText}\n` +
                  `**Legend:**\n` +
                  `✅ = Verified and trusted\n` +
                  `⚠️ = Use with caution\n\n` +
                  `**Note:** These are well-known legitimate onion services. Always verify URLs independently and exercise caution when accessing onion sites.`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `**Onion Service Search Failed**\n\n` +
                  `**Error:** ${errorMessage}`
          }
        ]
      };
    }
  }

  /**
   * Format HTTP headers for display
   */
  private formatHeaders(headers: any): string {
    const headerLines: string[] = [];
    
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value: string, name: string) => {
        headerLines.push(`  ${name}: ${value}`);
      });
    } else if (headers && typeof headers === 'object') {
      Object.entries(headers).forEach(([name, value]) => {
        headerLines.push(`  ${name}: ${value}`);
      });
    }
    
    return headerLines.length > 0 ? headerLines.join('\n') : '  (no headers)';
  }

  /**
   * Assess connection quality based on status
   */
  private getConnectionQuality(status: any): string {
    if (!status.isConnected) return 'Poor (No connection)';
    if (!status.circuitEstablished) return 'Fair (No circuit)';
    if (status.currentIP) return 'Good (Fully anonymous)';
    return 'Unknown';
  }
}