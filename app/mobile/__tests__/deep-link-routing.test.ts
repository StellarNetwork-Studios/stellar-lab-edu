import { isStellarFoundryLink, parseTransactionDeepLink, resolveDeepLink } from '../utils/deep-link-routing';

describe('deep link routing', () => {
  it('recognizes StellarFoundry domains and scheme URLs', () => {
    expect(isStellarFoundryLink('StellarFoundry://transaction/12345')).toBe(true);
    expect(isStellarFoundryLink('https://StellarFoundry.to/transaction/12345')).toBe(true);
    expect(isStellarFoundryLink('https://www.StellarFoundry.to/jordan?amount=1.2')).toBe(true);
    expect(isStellarFoundryLink('https://example.com/transaction/12345')).toBe(false);
  });

  it('parses transaction deep links with query params', () => {
    const result = parseTransactionDeepLink(
      'https://www.StellarFoundry.to/transaction/999?memo=hello&txHash=0xabc',
    );
    expect(result).toEqual({
      id: '999',
      params: { memo: 'hello', txHash: '0xabc' },
    });
  });

  it('resolves payment confirmation links to the payment confirmation route', () => {
    const result = resolveDeepLink('https://StellarFoundry.to/jordan?amount=12.5&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/payment-confirmation',
        params: { username: 'jordan', amount: '12.5000000', asset: 'XLM', privacy: 'false' },
      },
    });
  });

  it('resolves transaction links to the transaction route', () => {
    const result = resolveDeepLink('StellarFoundry://transaction/abc-123?status=Success&asset=XLM');
    expect(result).toEqual({
      route: {
        pathname: '/transaction/[id]',
        params: { id: 'abc-123', status: 'Success', asset: 'XLM' },
      },
    });
  });

  it('returns an error for invalid StellarFoundry links', () => {
    const result = resolveDeepLink('https://StellarFoundry.to/transaction/');
    expect(result).toEqual({ error: 'Unsupported or expired StellarFoundry link.' });
  });

  it('returns a generic error for malformed StellarFoundry://transaction links', () => {
    const result = resolveDeepLink('StellarFoundry://transaction/');
    expect(result).toEqual({ error: 'Unsupported or expired StellarFoundry link.' });
  });

  it('ignores unrelated URLs', () => {
    expect(resolveDeepLink('https://example.com/hello')).toEqual({ ignored: true });
  });
});
