import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';

import { SignedPayloadService } from './signed-payload.service';
import { ReplayProtectionService } from './replay-protection.service';
import { SIGNED_PAYLOAD_ERROR_CODES } from './signed-payload.types';

describe('SignedPayloadService', () => {
  let service: SignedPayloadService;
  let replayProtection: ReplayProtectionService;

  const testKeypair = Keypair.fromSecret(
    'SCZANGBA5YHTNYVVCR4EBHFIYSVJ5TAEJKGKIGXRJBBAY3DZDSZ4BMTG6XY',
  );
  const testPublicKey = testKeypair.publicKey();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignedPayloadService,
        ReplayProtectionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SIGNED_PAYLOAD_ENABLED') return true;
              if (key === 'SIGNED_PAYLOAD_REPLAY_WINDOW_MS') return 300000;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SignedPayloadService>(SignedPayloadService);
    replayProtection = module.get<ReplayProtectionService>(ReplayProtectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verify', () => {
    it('should reject timestamp outside window', async () => {
      const oldTimestamp = Date.now() - 10 * 60 * 1000;
      const payload = service.buildPayload(oldTimestamp, 'POST', '/test', '{"foo":"bar"}');
      const signature = service.sign(payload, testKeypair);

      const data = {
        timestamp: oldTimestamp,
        method: 'POST',
        path: '/test',
        body: '{"foo":"bar"}',
        signature,
      };

      await expect(service.verify(data, testPublicKey)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject invalid signature', async () => {
      const timestamp = Date.now();
      const payload = service.buildPayload(timestamp, 'POST', '/test', '{"foo":"bar"}');
      const invalidSignature = 'INVALID_SIGNATURE_BASE64==';

      const data = {
        timestamp,
        method: 'POST',
        path: '/test',
        body: '{"foo":"bar"}',
        signature: invalidSignature,
      };

      await expect(service.verify(data, testPublicKey)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should accept valid signature within window', async () => {
      const timestamp = Date.now();
      const payload = service.buildPayload(timestamp, 'POST', '/test', '{"foo":"bar"}');
      const signature = service.sign(payload, testKeypair);

      const data = {
        timestamp,
        method: 'POST',
        path: '/test',
        body: '{"foo":"bar"}',
        signature,
      };

      await expect(service.verify(data, testPublicKey)).resolves.not.toThrow();
    });
  });

  describe('buildPayload', () => {
    it('should build correct payload string', () => {
      const result = service.buildPayload(12345, 'POST', '/test', '{"foo":"bar"}');
      expect(result).toBe('12345:POST:/test:{"foo":"bar"}');
    });
  });

  describe('sign', () => {
    it('should produce base64 signature', () => {
      const payload = '12345:POST:/test:{"foo":"bar"}';
      const signature = service.sign(payload, testKeypair);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });
  });
});

describe('ReplayProtectionService', () => {
  let service: ReplayProtectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReplayProtectionService],
    }).compile();

    service = module.get<ReplayProtectionService>(ReplayProtectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addSignature / isReplay', () => {
    it('should detect replayed signature', () => {
      const sig = 'test-signature';
      service.addSignature(sig);
      expect(service.isReplay(sig)).toBe(true);
    });

    it('should return false for new signature', () => {
      expect(service.isReplay('new-signature')).toBe(false);
    });
  });
});