# TorOllama MCP Server

A Model Context Protocol (MCP) server that provides TOR network connectivity for Ollama and other AI models, enabling anonymous web requests and access to hidden services.

## Features

- **Anonymous HTTP Requests**: Make web requests through the TOR network for complete anonymity
- **Hidden Service Access**: Connect to .onion sites and hidden services
- **Circuit Management**: Create new TOR circuits for fresh anonymity
- **Connection Monitoring**: Check TOR connection status and IP verification
- **Onion Service Discovery**: Search for legitimate onion services by category
- **Professional Implementation**: Full TypeScript implementation following MCP standards

## Installation

### Prerequisites

1. **Node.js** (v18 or higher)
2. **TOR** installed on your system

#### Installing TOR

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tor
```

**macOS (with Homebrew):**
```bash
brew install tor
```

**Windows:**
Download from [TOR Project](https://www.torproject.org/download/) and install.

### Install TorOllama MCP Server

```bash
# Clone or download the project
cd torollama

# Install dependencies
npm install

# Build the project
npm run build

# Optional: Link globally
npm link
```

## Configuration

### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "torollama": {
      "command": "node",
      "args": ["/path/to/torollama/dist/index.js"],
      "env": {
        "TOR_SOCKS_PORT": "9050",
        "TOR_CONTROL_PORT": "9051"
      }
    }
  }
}
```

### TOR Configuration

The server can work with:
1. **Existing TOR installation**: Uses system TOR daemon (recommended)
2. **Embedded TOR instance**: Starts its own TOR process if needed

For system TOR, ensure it's running:
```bash
# Start TOR daemon
sudo systemctl start tor

# Check status
sudo systemctl status tor
```

## Usage

### Available Tools

#### 1. `tor_request`
Make HTTP requests through TOR network.

**Parameters:**
- `url` (required): Target URL (supports .onion addresses)
- `method` (optional): HTTP method (GET, POST, PUT, DELETE, PATCH)
- `headers` (optional): Custom HTTP headers
- `body` (optional): Request body for POST/PUT/PATCH
- `timeout` (optional): Request timeout in milliseconds (default: 30000)

**Example:**
```javascript
{
  "url": "https://check.torproject.org",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  }
}
```

#### 2. `check_tor_connection`
Verify TOR connection and check current anonymized IP.

**Example Response:**
```
TOR Connection Status: ✅ CONNECTED

Current IP: 185.220.101.42
TOR Version: 0.4.7.10
Circuit Established: Yes
Last Circuit: 2024-01-15T10:30:45.123Z

Your connection is routed through the TOR network and your IP is anonymized.
```

#### 3. `get_tor_status`
Get detailed TOR network status and configuration.

#### 4. `new_tor_circuit`
Request a new TOR circuit for fresh anonymity.

**Parameters:**
- `reason` (optional): Reason for requesting new circuit

#### 5. `search_onion_services`
Search for legitimate .onion hidden services.

**Parameters:**
- `query` (required): Search term or category
- `limit` (optional): Maximum results (default: 10)

**Available Categories:**
- `search`: Search engines (DuckDuckGo)
- `news`: News and journalism (NYT, BBC, ProPublica)
- `social`: Social media platforms
- `communication`: Messaging and communication tools
- `privacy`: Privacy-focused services
- `security`: Security tools and resources

## Security Considerations

### Privacy and Anonymity

- **IP Anonymization**: All requests are routed through TOR for IP anonymization
- **No Logging**: The server doesn't log request contents or destinations
- **Circuit Rotation**: Regular circuit changes enhance anonymity
- **DNS Over TOR**: DNS requests are also anonymized

### Safety Guidelines

1. **Verify Onion URLs**: Always verify .onion addresses independently
2. **HTTPS Preference**: Use HTTPS even over TOR when possible
3. **Sensitive Data**: Avoid sending sensitive data through any proxy
4. **Regular Circuits**: Use `new_tor_circuit` periodically for fresh anonymity

### Known Limitations

- **Performance**: TOR adds latency due to multiple relay hops
- **Reliability**: Some requests may fail due to TOR network issues
- **Exit Nodes**: Clearnet requests depend on TOR exit node quality
- **Legal Compliance**: Ensure usage complies with local laws and regulations

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Development mode with watch
npm run watch

# Build for production
npm run build

# Run built server
npm start

# Linting
npm run lint
npm run lint:fix
```

### Project Structure

```
torollama/
├── src/
│   ├── index.ts          # Main MCP server entry point
│   ├── tor-client.ts     # TOR network client implementation
│   └── tor-tools.ts      # MCP tools implementation
├── dist/                 # Compiled JavaScript output
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Environment Variables

- `TOR_SOCKS_PORT`: TOR SOCKS proxy port (default: 9050)
- `TOR_CONTROL_PORT`: TOR control port (default: 9051)
- `TOR_DATA_DIR`: Custom TOR data directory
- `DEBUG`: Enable debug logging

## Troubleshooting

### Common Issues

**TOR Connection Failed:**
```bash
# Check if TOR is running
ps aux | grep tor

# Restart TOR service
sudo systemctl restart tor

# Check TOR logs
journalctl -u tor -f
```

**Permission Denied:**
```bash
# Fix TOR data directory permissions
sudo chown -R $(whoami) ~/.tor
```

**Port Already in Use:**
```bash
# Check what's using the port
lsof -i :9050

# Kill conflicting process
sudo kill -9 <PID>
```

### Debug Mode

Enable detailed logging:
```bash
DEBUG=torollama* node dist/index.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting: `npm run lint:fix`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This software is provided for legitimate privacy and security purposes. Users are responsible for ensuring their usage complies with applicable laws and regulations. The developers are not responsible for any misuse of this software.

## Support

- **Issues**: Report bugs and issues on GitHub
- **Documentation**: Check the MCP specification at [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **TOR Help**: Visit [torproject.org](https://www.torproject.org) for TOR-specific support

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) for the MCP specification
- [TOR Project](https://www.torproject.org) for anonymity network
- [socks-proxy-agent](https://github.com/TooTallNate/node-socks-proxy-agent) for SOCKS proxy support
