import {
  Account,
  Asset,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from 'stellar-sdk';

type AssetInput =
  | { type: 'native' }
  | { type: 'credit'; code: string; issuer: string };

export type PathPaymentOptions = {
  network: 'public' | 'testnet';
  serverUrl: string;
  sourceSecret?: string;
  destination: string;
  sendAsset: AssetInput;
  destAsset: AssetInput;
  sendMax: string;
  destAmount: string;
  path?: Asset[];
};

function toStellarAsset(asset: AssetInput): Asset {
  return asset.type === 'native'
    ? Asset.native()
    : new Asset(asset.code, asset.issuer);
}

export function calculateSlippage(
  expectedAmount: string | number,
  actualAmount: string | number,
  _hopCount?: number
) {
  const expected = Number(expectedAmount);
  const actual = Number(actualAmount);

  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected <= 0) {
    return 0;
  }

  const slippage = ((expected - actual) / expected) * 100;
  return slippage < 0 ? 0 : slippage;
}

function buildPathPaymentOperation(
  options: PathPaymentOptions
): ReturnType<typeof Operation.pathPaymentStrictReceive> {
  const sendAsset = toStellarAsset(options.sendAsset);
  const destAsset = toStellarAsset(options.destAsset);

  return Operation.pathPaymentStrictReceive({
    sendAsset,
    sendMax: options.sendMax,
    destination: options.destination,
    destAsset,
    destAmount: options.destAmount,
    path: options.path ?? [],
  });
}

export async function buildPathPaymentTransaction(
  userAccount: { accountId: string; sequenceNumber: string | number },
  options: PathPaymentOptions
) {
  const networkPassphrase =
    options.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;

  const sourceAccount = new Account(
    userAccount.accountId,
    String(userAccount.sequenceNumber)
  );

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(buildPathPaymentOperation(options))
    .setTimeout(30)
    .build();

  return transaction;
}

export async function submitPathPaymentTransaction(
  signedXdr: string,
  options: Pick<PathPaymentOptions, 'network' | 'serverUrl'>
) {
  const server = new Horizon.Server(options.serverUrl);

  return server.submitTransaction(
    TransactionBuilder.fromXDR(
      signedXdr,
      options.network === 'public' ? Networks.PUBLIC : Networks.TESTNET
    )
  );
}
