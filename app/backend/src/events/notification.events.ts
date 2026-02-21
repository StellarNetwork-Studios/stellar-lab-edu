export enum NotificationEventType {
  LinkCreated = 'link.created',
  PaymentDetected = 'payment.detected',
  UsernameClaimed = 'username.claimed',
}

export interface LinkCreatedPayload {
  linkId: string;
  creator: string;
  timestamp: string;
}

export interface PaymentDetectedPayload {
  txHash: string;
  amount: string;
  sender: string;
  timestamp: string;
}

export interface UsernameClaimedPayload {
  username: string;
  publicKey: string;
  timestamp: string;
}
