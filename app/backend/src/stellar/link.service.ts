import { Injectable, Logger } from '@nestjs/common';
import {
  AssetInput,
  NormalizedAsset,
  assertSupportedAsset,
} from '../config/stellar.config';
import { AppConfigService } from '../config/app-config.service';

/**
 * Service for generating Stellar Explorer links for transactions, accounts, and contracts
 * Supports both Testnet and Mainnet with network-aware URL generation
 */
@Injectable()
export class LinkService {
  private readonly logger = new Logger(LinkService.name);

  constructor(private readonly appConfig: AppConfigService) {}

  /**
   * Validate asset input against supported assets
   */
  validateAsset(input: AssetInput): NormalizedAsset {
    return assertSupportedAsset(input);
  }

  /**
   * Generate a Stellar Explorer link for a transaction hash
   * @param txHash - Transaction hash (hex-encoded)
   * @returns Full explorer URL for the transaction
   * @example
   * generateTransactionLink('abc123...') 
   * // => 'https://stellar.expert/explorer/testnet/tx/abc123...'
   */
  generateTransactionLink(txHash: string): string {
    const explorerUrl = this.getExplorerBaseUrl();
    return `${explorerUrl}/tx/${txHash}`;
  }

  /**
   * Generate a Stellar Explorer link for an account (public key)
   * @param accountId - Stellar account ID (public key, G...)
   * @returns Full explorer URL for the account
   * @example
   * generateAccountLink('GBZVMB74...')
   * // => 'https://stellar.expert/explorer/testnet/account/GBZVMB74...'
   */
  generateAccountLink(accountId: string): string {
    const explorerUrl = this.getExplorerBaseUrl();
    return `${explorerUrl}/account/${accountId}`;
  }

  /**
   * Generate a Stellar Explorer link for a contract
   * @param contractId - Stellar contract ID (C...)
   * @returns Full explorer URL for the contract
   * @example
   * generateContractLink('CAAAA...')
   * // => 'https://stellar.expert/explorer/testnet/contract/CAAAA...'
   */
  generateContractLink(contractId: string): string {
    const explorerUrl = this.getExplorerBaseUrl();
    return `${explorerUrl}/contract/${contractId}`;
  }

  /**
   * Generate a Stellar Explorer link for an asset
   * @param code - Asset code (e.g., 'USDC', 'BTC')
   * @param issuer - Asset issuer account ID (public key)
   * @returns Full explorer URL for the asset
   * @example
   * generateAssetLink('USDC', 'GBUQWP3BOUZX34ULNQG23RQ6F4BXLFIXKKVM336SEED3SJVQ3EUEKMTCH')
   * // => 'https://stellar.expert/explorer/testnet/asset/USDC-GBUQWP3...'
   */
  generateAssetLink(code: string, issuer: string): string {
    const explorerUrl = this.getExplorerBaseUrl();
    return `${explorerUrl}/asset/${code}-${issuer}`;
  }

  /**
   * Generate a Stellar Explorer link for a ledger
   * @param ledgerSequence - Ledger sequence number
   * @returns Full explorer URL for the ledger
   * @example
   * generateLedgerLink(12345678)
   * // => 'https://stellar.expert/explorer/testnet/ledger/12345678'
   */
  generateLedgerLink(ledgerSequence: number): string {
    const explorerUrl = this.getExplorerBaseUrl();
    return `${explorerUrl}/ledger/${ledgerSequence}`;
  }

  /**
   * Get the base explorer URL for the configured network
   * @returns Base explorer URL (without trailing slash)
   * @throws Error if explorer URL is not configured
   */
  private getExplorerBaseUrl(): string {
    const explorerUrl = this.appConfig.stellarExplorerUrl;
    if (!explorerUrl) {
      this.logger.error('STELLAR_EXPLORER_URL is not configured');
      throw new Error('Explorer URL not configured. Set STELLAR_EXPLORER_URL environment variable.');
    }
    // Remove trailing slash if present to ensure consistent URL format
    return explorerUrl.replace(/\/$/, '');
  }

  /**
   * Check if the service is running on Testnet
   */
  isTestnet(): boolean {
    return this.appConfig.isTestnet;
  }

  /**
   * Check if the service is running on Mainnet
   */
  isMainnet(): boolean {
    return this.appConfig.isMainnet;
  }

  /**
   * Get the current network (testnet or mainnet)
   */
  getNetwork(): 'testnet' | 'mainnet' {
    return this.appConfig.network;
  }
}
