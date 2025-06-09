#!/bin/bash

# TorOllama MCP Server Setup Script
# This script installs and configures the TorOllama MCP server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOR_DATA_DIR="$HOME/.torollama/tor"
CONFIG_DIR="$HOME/.torollama"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt-get; then
            echo "ubuntu"
        elif command_exists yum; then
            echo "centos"
        elif command_exists pacman; then
            echo "arch"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

# Install Node.js if not present
install_nodejs() {
    if command_exists node && command_exists npm; then
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo $node_version | cut -d'.' -f1)
        
        if [ "$major_version" -ge 18 ]; then
            log_success "Node.js $node_version is already installed"
            return 0
        else
            log_warning "Node.js version $node_version is too old (need >= 18)"
        fi
    fi

    log_info "Installing Node.js..."
    
    local os=$(detect_os)
    case $os in
        ubuntu)
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        centos)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo yum install -y nodejs npm
            ;;
        arch)
            sudo pacman -S nodejs npm
            ;;
        macos)
            if command_exists brew; then
                brew install node
            else
                log_error "Please install Homebrew first: https://brew.sh/"
                exit 1
            fi
            ;;
        *)
            log_error "Unsupported OS. Please install Node.js manually: https://nodejs.org/"
            exit 1
            ;;
    esac
    
    log_success "Node.js installed successfully"
}

# Install TOR if not present
install_tor() {
    if command_exists tor; then
        log_success "TOR is already installed"
        return 0
    fi

    log_info "Installing TOR..."
    
    local os=$(detect_os)
    case $os in
        ubuntu)
            sudo apt-get update
            sudo apt-get install -y tor
            ;;
        centos)
            sudo yum install -y epel-release
            sudo yum install -y tor
            ;;
        arch)
            sudo pacman -S tor
            ;;
        macos)
            if command_exists brew; then
                brew install tor
            else
                log_error "Please install Homebrew first: https://brew.sh/"
                exit 1
            fi
            ;;
        *)
            log_error "Unsupported OS. Please install TOR manually: https://www.torproject.org/"
            exit 1
            ;;
    esac
    
    log_success "TOR installed successfully"
}

# Configure TOR
configure_tor() {
    log_info "Configuring TOR..."
    
    # Create TOR data directory
    mkdir -p "$TOR_DATA_DIR"
    
    # Create torrc configuration
    local torrc_path="$CONFIG_DIR/torrc"
    cat > "$torrc_path" << EOF
# TorOllama MCP Server Configuration
SocksPort 9050
ControlPort 9051
DataDirectory $TOR_DATA_DIR

# Circuit settings
CircuitBuildTimeout 60
NewCircuitPeriod 30
MaxCircuitDirtiness 300

# Exit node preferences (optional)
ExitNodes {us},{ca},{gb},{de},{fr},{nl},{se},{no},{dk}
StrictNodes 0

# Security settings
CookieAuthentication 1
ControlSocket $TOR_DATA_DIR/control_socket

# Logging
Log notice file $TOR_DATA_DIR/tor.log
EOF

    log_success "TOR configuration created at $torrc_path"
}

# Install dependencies and build project
setup_project() {
    log_info "Setting up TorOllama MCP Server..."
    
    cd "$SCRIPT_DIR"
    
    # Install npm dependencies
    log_info "Installing dependencies..."
    npm install
    
    # Build the project
    log_info "Building project..."
    npm run build
    
    # Make scripts executable
    chmod +x test-server.js
    
    log_success "Project setup completed"
}

# Create configuration directories
create_config() {
    log_info "Creating configuration directories..."
    
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$TOR_DATA_DIR"
    
    # Create MCP client configuration example
    local mcp_config="$CONFIG_DIR/mcp-client-config.json"
    cat > "$mcp_config" << EOF
{
  "mcpServers": {
    "torollama": {
      "command": "node",
      "args": ["$SCRIPT_DIR/dist/index.js"],
      "env": {
        "TOR_SOCKS_PORT": "9050",
        "TOR_CONTROL_PORT": "9051",
        "TOR_DATA_DIR": "$TOR_DATA_DIR"
      }
    }
  }
}
EOF

    log_success "Configuration files created in $CONFIG_DIR"
}

# Test installation
test_installation() {
    log_info "Testing installation..."
    
    cd "$SCRIPT_DIR"
    
    # Test if the server can start
    timeout 10s node dist/index.js >/dev/null 2>&1 || true
    
    if [ $? -eq 124 ]; then
        log_success "Server starts correctly (timed out as expected)"
    else
        log_warning "Server test inconclusive"
    fi
    
    # Run comprehensive tests
    if [ -f "test-server.js" ]; then
        log_info "Running MCP protocol tests..."
        node test-server.js
    fi
}

# Start TOR service
start_tor() {
    log_info "Starting TOR service..."
    
    local os=$(detect_os)
    case $os in
        ubuntu|centos)
            if command_exists systemctl; then
                sudo systemctl enable tor
                sudo systemctl start tor
                log_success "TOR service started with systemd"
            else
                log_warning "Please start TOR manually: sudo service tor start"
            fi
            ;;
        macos)
            if command_exists brew; then
                brew services start tor
                log_success "TOR service started with Homebrew"
            else
                log_warning "Please start TOR manually: tor -f $CONFIG_DIR/torrc"
            fi
            ;;
        *)
            log_warning "Please start TOR manually: tor -f $CONFIG_DIR/torrc"
            ;;
    esac
}

# Verify TOR connection
verify_tor() {
    log_info "Verifying TOR connection..."
    
    # Wait a moment for TOR to start
    sleep 5
    
    # Test SOCKS proxy
    if command_exists curl; then
        local tor_ip=$(curl -s --socks5 127.0.0.1:9050 https://api.ipify.org 2>/dev/null || echo "")
        local direct_ip=$(curl -s https://api.ipify.org 2>/dev/null || echo "")
        
        if [ -n "$tor_ip" ] && [ -n "$direct_ip" ] && [ "$tor_ip" != "$direct_ip" ]; then
            log_success "TOR connection verified (IP: $tor_ip)"
        else
            log_warning "TOR connection could not be verified"
        fi
    else
        log_warning "curl not available, cannot verify TOR connection"
    fi
}

# Print usage instructions
print_usage() {
    echo
    log_success "🎉 TorOllama MCP Server installation completed!"
    echo
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Add the server to your MCP client configuration:"
    echo "   File: $CONFIG_DIR/mcp-client-config.json"
    echo
    echo "2. Test the server:"
    echo "   cd $SCRIPT_DIR"
    echo "   node test-server.js"
    echo
    echo "3. Start the server manually:"
    echo "   node $SCRIPT_DIR/dist/index.js"
    echo
    echo -e "${BLUE}Configuration files:${NC}"
    echo "   TOR config: $CONFIG_DIR/torrc"
    echo "   TOR data: $TOR_DATA_DIR"
    echo "   MCP config: $CONFIG_DIR/mcp-client-config.json"
    echo
    echo -e "${BLUE}Useful commands:${NC}"
    echo "   Check TOR status: sudo systemctl status tor"
    echo "   View TOR logs: journalctl -u tor -f"
    echo "   Test TOR connection: curl --socks5 127.0.0.1:9050 https://api.ipify.org"
    echo
}

# Main installation process
main() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║           TorOllama MCP Server Setup             ║"
    echo "║     Anonymous AI connectivity through TOR       ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    log_info "Starting installation process..."
    
    # Check for required tools
    if ! command_exists curl; then
        log_error "curl is required but not installed. Please install curl first."
        exit 1
    fi
    
    # Install dependencies
    install_nodejs
    install_tor
    
    # Setup configuration
    create_config
    configure_tor
    
    # Setup project
    setup_project
    
    # Start services
    start_tor
    verify_tor
    
    # Test installation
    test_installation
    
    # Print usage instructions
    print_usage
    
    log_success "Setup completed successfully!"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        echo "TorOllama MCP Server Setup Script"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --test-only    Only run tests, skip installation"
        echo "  --no-tor       Skip TOR installation and configuration"
        echo
        exit 0
        ;;
    --test-only)
        test_installation
        exit 0
        ;;
    --no-tor)
        log_warning "Skipping TOR installation (--no-tor flag)"
        install_nodejs
        create_config
        setup_project
        test_installation
        print_usage
        ;;
    *)
        main
        ;;
esac