#!/usr/bin/env node

/**
 * Test script for TorOllama MCP Server
 * 
 * This script tests the MCP server functionality without requiring a full MCP client.
 * It simulates MCP protocol messages to verify that the server responds correctly.
 */

const { spawn } = require('child_process');
const { setTimeout } = require('timers/promises');

class MCPTester {
  constructor() {
    this.server = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🚀 Starting TorOllama MCP Server Tests\n');

    try {
      await this.startServer();
      await this.runServerTests();
      await this.stopServer();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async startServer() {
    console.log('📡 Starting MCP server...');
    
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    this.server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('TorOllama') || output.includes('MCP Server')) {
        console.log('   ', output.trim());
      }
    });

    this.server.on('error', (error) => {
      throw new Error(`Failed to start server: ${error.message}`);
    });

    // Wait for server to initialize
    await setTimeout(3000);
    console.log('✅ Server started\n');
  }

  async runServerTests() {
    console.log('🧪 Running MCP protocol tests...\n');

    // Test 1: Initialize
    await this.testInitialize();
    
    // Test 2: List tools
    await this.testListTools();
    
    // Test 3: Check TOR connection
    await this.testCheckConnection();
    
    // Test 4: Get TOR status
    await this.testGetStatus();
    
    // Test 5: Search onion services
    await this.testSearchOnionServices();
    
    // Test 6: Request new circuit
    await this.testNewCircuit();
    
    // Test 7: Make TOR request (if TOR is available)
    await this.testTorRequest();
  }

  async testInitialize() {
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: "torollama-test",
          version: "1.0.0"
        }
      }
    };

    const result = await this.sendRequest(request);
    this.assertTest('Initialize', result && result.result && result.result.capabilities);
  }

  async testListTools() {
    const request = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };

    const result = await this.sendRequest(request);
    const hasTools = result && result.result && result.result.tools && Array.isArray(result.result.tools);
    const expectedTools = ['tor_request', 'check_tor_connection', 'get_tor_status', 'new_tor_circuit', 'search_onion_services'];
    
    let allToolsPresent = false;
    if (hasTools) {
      const toolNames = result.result.tools.map(tool => tool.name);
      allToolsPresent = expectedTools.every(toolName => toolNames.includes(toolName));
    }

    this.assertTest('List Tools', hasTools && allToolsPresent, 
      hasTools ? `Found ${result.result.tools.length} tools` : 'No tools found');
  }

  async testCheckConnection() {
    const request = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "check_tor_connection",
        arguments: {}
      }
    };

    const result = await this.sendRequest(request);
    const hasContent = result && result.result && result.result.content && Array.isArray(result.result.content);
    
    this.assertTest('Check TOR Connection', hasContent, 
      hasContent ? 'Connection check completed' : 'Failed to check connection');
  }

  async testGetStatus() {
    const request = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_tor_status",
        arguments: {}
      }
    };

    const result = await this.sendRequest(request);
    const hasContent = result && result.result && result.result.content && Array.isArray(result.result.content);
    
    this.assertTest('Get TOR Status', hasContent, 
      hasContent ? 'Status retrieved' : 'Failed to get status');
  }

  async testSearchOnionServices() {
    const request = {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "search_onion_services",
        arguments: {
          query: "search",
          limit: 5
        }
      }
    };

    const result = await this.sendRequest(request);
    const hasContent = result && result.result && result.result.content && Array.isArray(result.result.content);
    
    this.assertTest('Search Onion Services', hasContent, 
      hasContent ? 'Search completed' : 'Search failed');
  }

  async testNewCircuit() {
    const request = {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "new_tor_circuit",
        arguments: {
          reason: "Test circuit creation"
        }
      }
    };

    const result = await this.sendRequest(request);
    const hasContent = result && result.result && result.result.content && Array.isArray(result.result.content);
    
    this.assertTest('New TOR Circuit', hasContent, 
      hasContent ? 'Circuit request processed' : 'Circuit request failed');
  }

  async testTorRequest() {
    const request = {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "tor_request",
        arguments: {
          url: "https://httpbin.org/ip",
          method: "GET",
          timeout: 15000
        }
      }
    };

    const result = await this.sendRequest(request);
    const hasContent = result && result.result && result.result.content && Array.isArray(result.result.content);
    
    this.assertTest('TOR HTTP Request', hasContent, 
      hasContent ? 'HTTP request completed' : 'HTTP request failed (TOR may not be available)');
  }

  async sendRequest(request) {
    return new Promise((resolve) => {
      const requestStr = JSON.stringify(request) + '\n';
      
      let responseData = '';
      const onData = (data) => {
        responseData += data.toString();
        
        // Check if we have a complete JSON response
        try {
          const response = JSON.parse(responseData.trim());
          this.server.stdout.removeListener('data', onData);
          resolve(response);
        } catch {
          // Not complete yet, keep accumulating
        }
      };

      this.server.stdout.on('data', onData);
      this.server.stdin.write(requestStr);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.server.stdout.removeListener('data', onData);
        resolve(null);
      }, 10000);
    });
  }

  assertTest(testName, condition, details = '') {
    const result = {
      name: testName,
      passed: !!condition,
      details: details
    };
    
    this.testResults.push(result);
    
    const status = condition ? '✅' : '❌';
    const detailsStr = details ? ` (${details})` : '';
    console.log(`${status} ${testName}${detailsStr}`);
  }

  async stopServer() {
    if (this.server) {
      this.server.kill('SIGTERM');
      await setTimeout(1000);
      console.log('\n🛑 Server stopped');
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`Passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! TorOllama MCP Server is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the details above.');
      
      const failed = this.testResults.filter(r => !r.passed);
      console.log('\nFailed tests:');
      failed.forEach(test => {
        console.log(`  - ${test.name}: ${test.details || 'Unknown error'}`);
      });
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Install TOR if tests show connection issues');
    console.log('   2. Configure your MCP client with the server');
    console.log('   3. Test with real AI models like Claude or GPT');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new MCPTester();
  tester.runTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = MCPTester;