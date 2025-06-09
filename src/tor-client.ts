import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch, { type RequestInit, type Response } from 'node-fetch';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TorConfig {
  socksPort: number;
  controlPort: number;
  torrcPath?: string;
  dataDirectory?: string;
  circuitBuildTimeout?: number;
  newCircuitPeriod?: number;
}

export interface TorConnectionStatus {
  isConnected: boolean;
  circuitEstablished: boolean;
  currentIP?: string;
  torVersion?: string;
  circuitCount?: number;
  lastCircuitTime?: Date;
}

export interface TorRequestOptions extends RequestInit {
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

/**
 * TOR Network Client
 * 
 * Manages TOR proxy connection and provides methods for:
 * - Making HTTP requests through TOR
 * - Managing TOR circuits
 * - Checking connection status
 * - Controlling TOR daemon
 */
export class TorNetworkClient {
  private config: TorConfig;
  private agent: SocksProxyAgent | null = null;
  private torProcess: ChildProcess | null = null;
  private isInitialized = false;
  private connectionStatus: TorConnectionStatus = {
    isConnected: false,
    circuitEstablished: false,
  };

  constructor(config: Partial<TorConfig> = {}) {
    this.config = {
      socksPort: config.socksPort ?? 9050,
      controlPort: config.controlPort ?? 9051,
      circuitBuildTimeout: config.circuitBuildTimeout ?? 60,
      newCircuitPeriod: config.newCircuitPeriod ?? 30,
      torrcPath: config.torrcPath ?? undefined,
      dataDirectory: config.dataDirectory ?? join(tmpdir(), 'torollama-tor'),
      ...config,
    };
  }

  /**
   * Initialize the TOR client
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // First, try to connect to existing TOR instance
      if (await this.checkExistingTorConnection()) {
        console.error('[TorClient] Using existing TOR connection');
      } else {
        // If no existing connection, start our own TOR instance
        await this.startTorDaemon();
        await this.waitForTorConnection();
      }

      // Create SOCKS proxy agent
      this.agent = new SocksProxyAgent(
        `socks5h://127.0.0.1:${this.config.socksPort}`
      );

      // Verify connection
      await this.updateConnectionStatus();
      
      if (!this.connectionStatus.isConnected) {
        throw new Error('Failed to establish TOR connection');
      }

      this.isInitialized = true;
      console.error('[TorClient] TOR client initialized successfully');
    } catch (error) {
      throw new Error(`TOR initialization failed: ${error}`);
    }
  }

  /**
   * Make an HTTP request through TOR
   */
  public async request(url: string, options: TorRequestOptions = {}): Promise<Response> {
    if (!this.isInitialized || !this.agent) {
      throw new Error('TOR client not initialized');
    }

    const {
      timeout = 30000,
      followRedirects = true,
      maxRedirects = 5,
      ...fetchOptions
    } = options;

    const requestOptions: RequestInit & { timeout?: number } = {
      ...fetchOptions,
      agent: this.agent,
      redirect: followRedirects ? 'follow' : 'manual',
      timeout,
    };

    try {
      const response = await fetch(url, requestOptions);
      
      // Log request for debugging (without sensitive data)
      console.error(`[TorClient] ${requestOptions.method ?? 'GET'} ${url} -> ${response.status}`);
      
      return response;
    } catch (error) {
      console.error(`[TorClient] Request failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get current connection status
   */
  public async getStatus(): Promise<TorConnectionStatus> {
    await this.updateConnectionStatus();
    return { ...this.connectionStatus };
  }

  /**
   * Request a new TOR circuit
   */
  public async newCircuit(): Promise<boolean> {
    try {
      // Send NEWNYM signal to TOR control port
      await this.sendControlCommand('SIGNAL NEWNYM');
      
      // Wait a moment for circuit to establish
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update status
      await this.updateConnectionStatus();
      
      this.connectionStatus.lastCircuitTime = new Date();
      
      console.error('[TorClient] New TOR circuit established');
      return true;
    } catch (error) {
      console.error(`[TorClient] Failed to create new circuit: ${error}`);
      return false;
    }
  }

  /**
   * Check if TOR connection is working
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await this.request('https://check.torproject.org/api/ip', {
        timeout: 10000,
      });
      
      if (response.ok) {
        const data = await response.json() as { IsTor: boolean; IP: string };
        this.connectionStatus.currentIP = data.IP;
        this.connectionStatus.isConnected = data.IsTor;
        return data.IsTor;
      }
      
      return false;
    } catch (error) {
      console.error(`[TorClient] Connection check failed: ${error}`);
      this.connectionStatus.isConnected = false;
      return false;
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.torProcess) {
      this.torProcess.kill('SIGTERM');
      this.torProcess = null;
    }
    
    this.agent = null;
    this.isInitialized = false;
  }

  /**
   * Check if there's an existing TOR connection
   */
  private async checkExistingTorConnection(): Promise<boolean> {
    try {
      const agent = new SocksProxyAgent(`socks5h://127.0.0.1:${this.config.socksPort}`);
      const response = await fetch('https://check.torproject.org/api/ip', {
        agent,
        timeout: 5000,
      } as RequestInit & { timeout?: number });
      
      if (response.ok) {
        const data = await response.json() as { IsTor: boolean };
        return data.IsTor;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Start TOR daemon process
   */
  private async startTorDaemon(): Promise<void> {
    // Create data directory
    await fs.mkdir(this.config.dataDirectory!, { recursive: true });

    // Create torrc file
    const torrcPath = join(this.config.dataDirectory!, 'torrc');
    const torrcContent = `
SocksPort ${this.config.socksPort}
ControlPort ${this.config.controlPort}
DataDirectory ${this.config.dataDirectory}
CircuitBuildTimeout ${this.config.circuitBuildTimeout}
NewCircuitPeriod ${this.config.newCircuitPeriod}
ExitNodes {us},{ca},{gb},{de},{fr},{nl},{se},{no},{dk}
StrictNodes 0
# Enable control port authentication
HashedControlPassword 16:872860B76453A77D60CA2BB8C1A7042072093276A3D701AD684053EC4C
CookieAuthentication 1
    `;

    await fs.writeFile(torrcPath, torrcContent.trim());

    // Start TOR process
    return new Promise((resolve, reject) => {
      this.torProcess = spawn('tor', ['-f', torrcPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let torOutput = '';

      this.torProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        torOutput += output;
        console.error(`[TOR] ${output.trim()}`);
      });

      this.torProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        torOutput += output;
        console.error(`[TOR] ${output.trim()}`);
      });

      this.torProcess.on('error', (error) => {
        reject(new Error(`Failed to start TOR: ${error.message}`));
      });

      this.torProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`TOR exited with code ${code}`));
        }
      });

      // Wait for TOR to be ready
      const checkReady = () => {
        if (torOutput.includes('Bootstrapped 100%') || torOutput.includes('Opening Socks listener')) {
          resolve();
        } else {
          setTimeout(checkReady, 1000);
        }
      };

      setTimeout(checkReady, 1000);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        reject(new Error('TOR startup timeout'));
      }, 60000);
    });
  }

  /**
   * Wait for TOR connection to be established
   */
  private async waitForTorConnection(): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        if (await this.checkExistingTorConnection()) {
          return;
        }
      } catch {
        // Continue trying
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('TOR connection timeout');
  }

  /**
   * Update connection status
   */
  private async updateConnectionStatus(): Promise<void> {
    try {
      const isConnected = await this.checkConnection();
      
      this.connectionStatus = {
        ...this.connectionStatus,
        isConnected,
        circuitEstablished: isConnected,
      };

      // Try to get TOR version
      if (isConnected) {
        try {
          const versionInfo = await this.sendControlCommand('GETINFO version');
          const versionPart = versionInfo.split('=')[1]?.trim();
          this.connectionStatus.torVersion = versionPart ?? undefined;
        } catch {
          // Version info not critical
        }
      }
    } catch (error) {
      this.connectionStatus.isConnected = false;
      this.connectionStatus.circuitEstablished = false;
    }
  }

  /**
   * Send command to TOR control port
   */
  private async sendControlCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const client = net.createConnection(this.config.controlPort, '127.0.0.1');

      let response = '';

      client.on('connect', () => {
        client.write(`${command}\r\n`);
      });

      client.on('data', (data: Buffer) => {
        response += data.toString();
        
        // Check if response is complete (ends with "250 OK" or similar)
        if (response.includes('250 OK') || response.includes('250-')) {
          client.end();
          resolve(response);
        }
      });

      client.on('error', (error: Error) => {
        reject(error);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Control command timeout'));
      });

      client.setTimeout(5000);
    });
  }
}