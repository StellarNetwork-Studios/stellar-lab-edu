export const SIGNED_PAYLOAD_HEADER = 'x-signed-payload';

export const SIGNED_PAYLOAD_ERROR_CODES = {
  MISSING_SIGNED_PAYLOAD: 'MISSING_SIGNED_PAYLOAD',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  REPLAY_DETECTED: 'REPLAY_DETECTED',
  BODY_TAMPERED: 'BODY_TAMPERED',
} as const;

export type SignedPayloadErrorCode =
  (typeof SIGNED_PAYLOAD_ERROR_CODES)[keyof typeof SIGNED_PAYLOAD_ERROR_CODES];

export interface SignedPayloadData {
  timestamp: number;
  method: string;
  path: string;
  body: string;
  signature: string;
}

export interface SignedPayloadConfig {
  enabled: boolean;
  replayWindowMs: number;
}

export const DEFAULT_SIGNED_PAYLOAD_CONFIG: SignedPayloadConfig = {
  enabled: true,
  replayWindowMs: 5 * 60 * 1000,
};