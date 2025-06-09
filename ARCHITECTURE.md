# TorOllama MCP Server Architecture

## Project Overview

TorOllama is a professional Model Context Protocol (MCP) server that provides TOR network connectivity for AI models and applications. It enables anonymous web requests, access to hidden services (.onion sites), and enhanced privacy for AI-driven web interactions.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client                              │
│                    (Claude, GPT, etc.)                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │ JSON-RPC over stdio
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 TorOllama MCP Server                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Main Server                             │   │
│  │  • Tool registration                                    │   │
│  │  • Request routing                                      │   │
│  │  • Error handling                                       │   │
│  │  • Protocol compliance                                  │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                           │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │                TOR Tools                                │   │
│  │  • HTTP request handler                                 │   │
│  │  • Connection verification                              │   │
│  │  • Circuit management                                   │   │
│  │  • Onion service discovery                             │   │
│  └─────────────────┬───────────────────────────────────────┘   │
│                    │                                           │
│  ┌─────────────────▼───────────────────────────────────────┐   │
│  │              TOR Client                                 │   │
│  │  • SOCKS proxy management                              │   │
│  │  • TOR daemon control                                  │   │
│  │  • Circuit monitoring                                  │   │
│  │  • Connection health checks                            │   │
│  └─────────────────┬───────────────────────────────────────┘   │
└──────────────────┬─┴───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────────┐
│                      TOR Network                                │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐│
│  │  Entry Node   │─▶│  Relay Node   │─▶│     Exit Node         ││
│  │  (Guard)      │  │  (Middle)     │  │  (or Hidden Service) ││
│  └───────────────┘  └───────────────┘  └───────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Target Websites                             │
│  • Clearnet sites (google.com, github.com, etc.)             │
│  • Hidden services (.onion sites)                             │
│  • API endpoints                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Main MCP Server (`src/index.ts`)

**Responsibilities:**
- Implements MCP protocol specification
- Manages tool registration and routing
- Handles client communication via stdio
- Provides error handling and logging
- Manages server lifecycle

**Key Classes:**
- `TorOllamaMcpServer`: Main server orchestrator
- Tool handlers for each available function
- Request/response serialization

**Protocol Compliance:**
- JSON-RPC 2.0 message format
- MCP capability negotiation
- Tool schema validation
- Error code standardization

### 2. TOR Network Client (`src/tor-client.ts`)

**Responsibilities:**
- Manages TOR daemon lifecycle
- Provides SOCKS proxy abstraction
- Handles circuit management
- Monitors connection health
- Abstracts TOR control port operations

**Key Classes:**
- `TorNetworkClient`: Main TOR interface
- Configuration management
- Connection status tracking
- Circuit control operations

**Features:**
- Automatic TOR daemon startup
- SOCKS5 proxy integration
- Circuit rotation capabilities
- Connection verification
- Health monitoring

### 3. TOR Tools Implementation (`src/tor-tools.ts`)

**Responsibilities:**
- Implements MCP tools using TOR client
- Provides high-level operations
- Handles tool parameter validation
- Formats responses for MCP protocol
- Manages known onion services

**Available Tools:**
- `tor_request`: HTTP requests through TOR
- `check_tor_connection`: Connection verification
- `get_tor_status`: Detailed status information
- `new_tor_circuit`: Circuit rotation
- `search_onion_services`: Hidden service discovery

## Data Flow

### 1. Tool Invocation Flow

```
1. MCP Client ──JSON-RPC──▶ MCP Server
2. MCP Server ──validate──▶ Tool Handler
3. Tool Handler ──request──▶ TOR Client
4. TOR Client ──SOCKS5──▶ TOR Network
5. TOR Network ──HTTP──▶ Target Website
6. Target Website ──response──▶ TOR Network
7. TOR Network ──SOCKS5──▶ TOR Client
8. TOR Client ──data──▶ Tool Handler
9. Tool Handler ──format──▶ MCP Server
10. MCP Server ──JSON-RPC──▶ MCP Client
```

### 2. Circuit Management Flow

```
1. Client requests new circuit
2. TOR Tools validates request
3. TOR Client sends NEWNYM signal
4. TOR daemon establishes new route
5. Connection verification performed
6. Status updated and returned
```

## Security Architecture

### 1. Network Security

**TOR Integration:**
- All requests routed through TOR SOCKS proxy
- DNS queries handled by TOR resolver
- Circuit isolation for different operations
- Regular circuit rotation

**Connection Security:**
- HTTPS preferred for clearnet requests
- .onion addresses for hidden services
- No direct clearnet connections
- Exit node diversity preferences

### 2. Application Security

**Input Validation:**
- Zod schema validation for all inputs
- URL validation and sanitization
- Header filtering and normalization
- Timeout enforcement

**Data Protection:**
- No persistent request logging
- Memory clearance after operations
- Temporary file avoidance
- Secure configuration handling

### 3. Runtime Security

**Process Isolation:**
- Non-root user execution
- Containerized deployment support
- Resource limitation enforcement
- Signal handling for cleanup

## Configuration Management

### 1. TOR Configuration

```typescript
interface TorConfig {
  socksPort: number;          // SOCKS proxy port
  controlPort: number;        // Control port for commands
  torrcPath?: string;         // Custom torrc file
  dataDirectory?: string;     // TOR data storage
  circuitBuildTimeout?: number;
  newCircuitPeriod?: number;
}
```

### 2. Server Configuration

**Environment Variables:**
- `TOR_SOCKS_PORT`: SOCKS proxy port (default: 9050)
- `TOR_CONTROL_PORT`: Control port (default: 9051)
- `TOR_DATA_DIR`: Data directory path
- `DEBUG`: Debug logging enable/disable

**Runtime Configuration:**
- Dynamic tool registration
- Configurable timeouts
- Circuit management settings
- Exit node preferences

## Deployment Architecture

### 1. Standalone Deployment

```
┌─────────────────────────────────────┐
│           Host System               │
│  ┌─────────────────────────────┐   │
│  │      TorOllama Server       │   │
│  │  ┌───────────────────────┐  │   │
│  │  │    Node.js Process    │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │       TOR Daemon            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 2. Containerized Deployment

```
┌─────────────────────────────────────┐
│           Docker Host               │
│  ┌─────────────────────────────┐   │
│  │    TorOllama Container      │   │
│  │  ┌───────────────────────┐  │   │
│  │  │  Node.js + TOR        │  │   │
│  │  │  • MCP Server         │  │   │
│  │  │  • TOR Daemon         │  │   │
│  │  │  • Health Checks      │  │   │
│  │  └───────────────────────┘  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 3. Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Load Balancer  │  │   Monitoring    │  │   Logging   │ │
│  └─────────┬───────┘  └─────────────────┘  └─────────────┘ │
│            │                                               │
│  ┌─────────▼───────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ TorOllama Pod 1 │  │ TorOllama Pod 2 │  │     ...     │ │
│  │  • MCP Server   │  │  • MCP Server   │  │             │ │
│  │  • TOR Client   │  │  • TOR Client   │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### 1. Latency Factors

**TOR Network:**
- 3-hop circuit adds ~2-5 seconds latency
- Circuit establishment time: 5-30 seconds
- Exit node performance variation
- Network congestion effects

**Optimization Strategies:**
- Circuit pre-warming
- Connection pooling
- Request batching
- Timeout optimization

### 2. Resource Usage

**Memory:**
- Base Node.js process: ~50MB
- TOR daemon: ~50-100MB
- Request buffering: Variable
- Circuit data: ~10MB per circuit

**CPU:**
- Encryption overhead: 5-15%
- JSON parsing: Minimal
- Network I/O: Low
- TOR routing: Moderate

### 3. Scalability

**Horizontal Scaling:**
- Multiple server instances
- Load balancing support
- Circuit distribution
- Independent TOR daemons

**Vertical Scaling:**
- Memory allocation tuning
- Circuit count optimization
- Connection pooling
- Request queuing

## Error Handling Strategy

### 1. Error Categories

**Network Errors:**
- TOR connection failures
- Circuit establishment issues
- Target website unavailability
- Timeout conditions

**Protocol Errors:**
- Invalid MCP messages
- Tool parameter validation
- Schema compliance issues
- Version compatibility

**System Errors:**
- Resource exhaustion
- File system issues
- Permission problems
- Process crashes

### 2. Recovery Mechanisms

**Automatic Recovery:**
- Circuit recreation
- Connection retry logic
- Graceful degradation
- Fallback behaviors

**Manual Recovery:**
- Configuration reload
- Service restart procedures
- Circuit cleanup
- State reset operations

## Monitoring and Observability

### 1. Metrics Collection

**Performance Metrics:**
- Request latency distribution
- Circuit establishment time
- Success/failure rates
- Resource utilization

**Security Metrics:**
- Anonymous IP verification
- Circuit rotation frequency
- Connection health status
- Error rate monitoring

### 2. Logging Strategy

**Security Logging:**
- Connection attempts (no content)
- Circuit changes
- Authentication events
- Error conditions

**Operational Logging:**
- Performance metrics
- Health check results
- Configuration changes
- Service lifecycle events

## Testing Strategy

### 1. Unit Testing

**Component Tests:**
- TOR client functionality
- Tool parameter validation
- MCP protocol compliance
- Error handling paths

### 2. Integration Testing

**End-to-End Tests:**
- Full request flow validation
- TOR network connectivity
- Circuit management operations
- Tool functionality verification

### 3. Security Testing

**Anonymity Verification:**
- IP address verification
- DNS leak detection
- Traffic analysis resistance
- Circuit isolation validation

## Future Enhancements

### 1. Advanced Features

**Planned Improvements:**
- Multiple TOR instance support
- Advanced circuit selection
- Traffic shaping capabilities
- Enhanced anonymity metrics

### 2. Integration Enhancements

**API Expansions:**
- WebSocket support
- Streaming responses
- Bulk operations
- Cache management

### 3. Security Enhancements

**Advanced Security:**
- Traffic obfuscation
- Bridge relay support
- Enhanced anonymity sets
- Advanced threat detection

## Dependencies

### 1. Core Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `socks-proxy-agent`: SOCKS proxy support
- `node-fetch`: HTTP client functionality
- `zod`: Schema validation

### 2. System Dependencies

- `tor`: TOR daemon for anonymity
- `node.js`: Runtime environment (≥18.0.0)
- Operating system TOR packages

### 3. Development Dependencies

- `typescript`: Type checking and compilation
- `eslint`: Code quality and style
- Testing frameworks and utilities

---

This architecture provides a robust, secure, and scalable foundation for anonymous AI connectivity through the TOR network, following modern software engineering practices and security best practices.