import { LinkService } from './link.service';
import { AppConfigService } from '../config/app-config.service';

describe('LinkService - Explorer Links', () => {
  let service: LinkService;
  let mockAppConfig: jest.Mocked<AppConfigService>;

  beforeEach(() => {
    mockAppConfig = {
      stellarExplorerUrl: 'https://stellar.expert/explorer/testnet',
      isTestnet: true,
      isMainnet: false,
      network: 'testnet',
    } as any;

    service = new LinkService(mockAppConfig);
  });

  describe('generateTransactionLink', () => {
    it('should generate correct transaction link for testnet', () => {
      const txHash = 'abc123def456789';
      const result = service.generateTransactionLink(txHash);

      expect(result).toBe('https://stellar.expert/explorer/testnet/tx/abc123def456789');
    });

    it('should generate correct transaction link for mainnet', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;
      mockAppConfig.network = 'mainnet';

      const txHash = 'xyz789abc456def';
      const result = service.generateTransactionLink(txHash);

      expect(result).toBe('https://stellar.expert/explorer/public/tx/xyz789abc456def');
    });

    it('should handle transaction hash with special characters', () => {
      const txHash = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const result = service.generateTransactionLink(txHash);

      expect(result).toContain('/tx/');
      expect(result).toContain(txHash);
    });

    it('should remove trailing slash from explorer URL', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/testnet/';

      const txHash = 'test123';
      const result = service.generateTransactionLink(txHash);

      expect(result).toBe('https://stellar.expert/explorer/testnet/tx/test123');
      expect(result).not.toContain('//tx');
    });
  });

  describe('generateAccountLink', () => {
    it('should generate correct account link for testnet', () => {
      const accountId = 'GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF';
      const result = service.generateAccountLink(accountId);

      expect(result).toBe(
        `https://stellar.expert/explorer/testnet/account/${accountId}`
      );
    });

    it('should generate correct account link for mainnet', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;

      const accountId = 'GDZST3XVCDTUJ76ZAV2HA72KYABU5AAEA3GNRGXYUV2SQP4HRJ5JJL5';
      const result = service.generateAccountLink(accountId);

      expect(result).toBe(
        `https://stellar.expert/explorer/public/account/${accountId}`
      );
    });
  });

  describe('generateContractLink', () => {
    it('should generate correct contract link for testnet', () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      const result = service.generateContractLink(contractId);

      expect(result).toBe(
        `https://stellar.expert/explorer/testnet/contract/${contractId}`
      );
    });

    it('should generate correct contract link for mainnet', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;

      const contractId = 'CAB24D54CB3BA5AD84F45A6DFF2C2D556F88E86B34364A76D5D923467D5CC8C1';
      const result = service.generateContractLink(contractId);

      expect(result).toBe(
        `https://stellar.expert/explorer/public/contract/${contractId}`
      );
    });
  });

  describe('generateAssetLink', () => {
    it('should generate correct asset link for testnet', () => {
      const code = 'USDC';
      const issuer = 'GBUQWP3BOUZX34ULNQG23RQ6F4BXLFIXKKVM336SEED3SJVQ3EUEKMTCH';
      const result = service.generateAssetLink(code, issuer);

      expect(result).toBe(
        `https://stellar.expert/explorer/testnet/asset/${code}-${issuer}`
      );
    });

    it('should generate correct asset link for mainnet', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;

      const code = 'BTC';
      const issuer = 'GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKMTCH';
      const result = service.generateAssetLink(code, issuer);

      expect(result).toBe(
        `https://stellar.expert/explorer/public/asset/${code}-${issuer}`
      );
    });
  });

  describe('generateLedgerLink', () => {
    it('should generate correct ledger link for testnet', () => {
      const ledgerSequence = 12345678;
      const result = service.generateLedgerLink(ledgerSequence);

      expect(result).toBe(
        `https://stellar.expert/explorer/testnet/ledger/${ledgerSequence}`
      );
    });

    it('should generate correct ledger link for mainnet', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;

      const ledgerSequence = 87654321;
      const result = service.generateLedgerLink(ledgerSequence);

      expect(result).toBe(
        `https://stellar.expert/explorer/public/ledger/${ledgerSequence}`
      );
    });
  });

  describe('Network Switching', () => {
    it('should correctly report testnet status', () => {
      mockAppConfig.isTestnet = true;
      mockAppConfig.isMainnet = false;
      mockAppConfig.network = 'testnet';

      expect(service.isTestnet()).toBe(true);
      expect(service.isMainnet()).toBe(false);
      expect(service.getNetwork()).toBe('testnet');
    });

    it('should correctly report mainnet status', () => {
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;
      mockAppConfig.network = 'mainnet';

      expect(service.isTestnet()).toBe(false);
      expect(service.isMainnet()).toBe(true);
      expect(service.getNetwork()).toBe('mainnet');
    });

    it('should switch explorer URLs when network changes', () => {
      // Start on testnet
      expect(service.generateTransactionLink('abc')).toContain('/testnet/');

      // Switch to mainnet
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/public';
      mockAppConfig.isTestnet = false;
      mockAppConfig.isMainnet = true;

      expect(service.generateTransactionLink('abc')).toContain('/public/');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when explorer URL is not configured', () => {
      mockAppConfig.stellarExplorerUrl = undefined;

      expect(() => {
        service.generateTransactionLink('abc123');
      }).toThrow('Explorer URL not configured');
    });

    it('should throw error when generating account link without explorer URL', () => {
      mockAppConfig.stellarExplorerUrl = '';

      expect(() => {
        service.generateAccountLink('GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF');
      }).toThrow('Explorer URL not configured');
    });

    it('should throw error when generating contract link without explorer URL', () => {
      mockAppConfig.stellarExplorerUrl = null as any;

      expect(() => {
        service.generateContractLink('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4');
      }).toThrow('Explorer URL not configured');
    });
  });

  describe('URL Format Consistency', () => {
    it('should generate consistent URL formats across all link types', () => {
      const baseUrl = 'https://stellar.expert/explorer/testnet';
      mockAppConfig.stellarExplorerUrl = baseUrl;

      const txLink = service.generateTransactionLink('abc');
      const accountLink = service.generateAccountLink('GBZVMB74Z7...');
      const contractLink = service.generateContractLink('CAAAA...');
      const assetLink = service.generateAssetLink('USDC', 'GBUQW...');

      expect(txLink).toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/tx\//);
      expect(accountLink).toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/account\//);
      expect(contractLink).toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/contract\//);
      expect(assetLink).toMatch(/^https:\/\/stellar\.expert\/explorer\/testnet\/asset\//);
    });

    it('should not have double slashes in generated URLs', () => {
      mockAppConfig.stellarExplorerUrl = 'https://stellar.expert/explorer/testnet/';

      const links = [
        service.generateTransactionLink('abc'),
        service.generateAccountLink('GBZVMB74Z7...'),
        service.generateContractLink('CAAAA...'),
        service.generateAssetLink('USDC', 'GBUQW...'),
        service.generateLedgerLink(12345),
      ];

      links.forEach((link) => {
        // Count consecutive slashes - should only appear in protocol (https://)
        const doubleSlashCount = (link.match(/\/\//g) || []).length;
        expect(doubleSlashCount).toBe(1); // Only in https://
      });
    });
  });

  describe('Integration', () => {
    it('should generate all link types for a complete transaction scenario', () => {
      const txHash = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const accountId = 'GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF';
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
      const ledger = 12345678;

      const txLink = service.generateTransactionLink(txHash);
      const accountLink = service.generateAccountLink(accountId);
      const contractLink = service.generateContractLink(contractId);
      const ledgerLink = service.generateLedgerLink(ledger);

      expect(txLink).toBeDefined();
      expect(accountLink).toBeDefined();
      expect(contractLink).toBeDefined();
      expect(ledgerLink).toBeDefined();

      // Verify all use the same base URL
      const baseUrl = 'https://stellar.expert/explorer/testnet';
      expect(txLink).toContain(baseUrl);
      expect(accountLink).toContain(baseUrl);
      expect(contractLink).toContain(baseUrl);
      expect(ledgerLink).toContain(baseUrl);
    });
  });
});
