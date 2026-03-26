# Universal Links & App Links Setup for QuickEx

## iOS (Apple Universal Links)
- `.well-known/apple-app-site-association` is configured for domain: `quickex.to`
- Update `appID` in the file to your real Apple Team ID and Bundle ID.
- Add your domain to `associatedDomains` in `app.json` under `ios`.

## Android (App Links)
- `.well-known/assetlinks.json` is configured for domain: `quickex.to`
- Update `package_name` and `sha256_cert_fingerprints` in the file to match your app.
- Add intent filters in `app.json` under `android`.

## Testing
- Deploy `.well-known` files to your production domain root.
- Use Apple/Google tools to verify association.

## Example Deep Link
- `https://quickex.to/payment/12345` will open the app if installed.

---

**Replace all placeholder values with your real app IDs and fingerprints before production.**
