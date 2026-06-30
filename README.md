# Session Vault

Session Vault is a privacy-first Chrome extension for exporting and importing browser session data as password-encrypted local files.

It can back up cookies, localStorage, sessionStorage, IndexedDB, and Cache Storage without using any server, analytics, telemetry, cloud sync, or third-party SDK.

Privacy Policy: https://eidson-ciao.github.io/session-vault/PRIVACY.html

## What it does

Session Vault helps you create encrypted browser session backups for:

- Moving your own logged-in sessions to a new device.
- Backing up local browser session state before reinstalling Chrome.
- Sharing a controlled test-account session with teammates.
- Restoring cookies and web storage from a local vault file.

Everything runs locally in your browser. The extension does not send your data anywhere.

## Modes

### Current Site Mode

Export or import session data for the website in your active tab:

- Cookies, including HttpOnly cookies where Chrome permits access.
- localStorage.
- sessionStorage.
- IndexedDB and Cache Storage.

This mode is useful for controlled team sharing of test accounts or internal admin sessions.

### Whole Browser Mode

Export or import broader browser session state:

- All browser cookies.
- localStorage and sessionStorage for currently open tabs.
- IndexedDB and Cache Storage for currently open tabs.

This mode is intended for personal migration to a new device. Do not share a whole-browser backup with anyone.

## Security

- AES-GCM 256-bit authenticated encryption.
- PBKDF2-SHA256 key derivation with 250,000 iterations.
- Random salt and IV for every export.
- Passwords never leave your browser.
- No server, backend, analytics, telemetry, tracking, or remote code.

The encrypted `.json` file cannot be decrypted without the password. There is no backdoor, no key escrow, and no password recovery mechanism.

## Encrypted File Format

```json
{
  "v": 1,
  "kind": "session-vault-site",
  "alg": "AES-GCM",
  "kdf": "PBKDF2-SHA256",
  "iterations": 250000,
  "salt": "<base64>",
  "iv": "<base64>",
  "ct": "<base64>"
}
```

The `ct` field contains the encrypted JSON payload.

## Installation

### Install as an unpacked extension

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `session-vault/` folder.

## Usage

### Export the current site

1. Open the website you want to back up.
2. Open the Session Vault popup.
3. Select `Current Site`.
4. Choose which data types to include.
5. Enable password encryption and enter a strong password.
6. Click `Export Encrypted Backup`.
7. Store the exported `.json` file safely.

### Import the current site

1. Open the target website.
2. Open the Session Vault popup.
3. Select `Current Site`.
4. Enter the password used during export.
5. Choose the backup file.
6. Refresh the website after import completes.

### Export the whole browser

1. Open tabs for the websites whose storage you want to include.
2. Open the Session Vault popup.
3. Select `Whole Browser`.
4. Enable password encryption and enter a strong password.
5. Click `Export Whole-Browser Backup`.
6. Keep the resulting `.json` file private.

### Import the whole browser

1. Install Session Vault on the target Chrome profile.
2. Open the Session Vault popup.
3. Select `Whole Browser`.
4. Enter the password used during export.
5. Choose the backup file.
6. Cookies are restored immediately.
7. Storage for individual origins may be staged until you visit each site, due to browser same-origin restrictions.

## Important Safety Notes

- Anyone with both the backup file and the password can use the included sessions.
- Treat every vault file like a password-manager export.
- Use a strong password, preferably 16+ characters.
- If sharing a current-site backup with a teammate, send the file and password through separate channels.
- Never import vault files from untrusted sources.
- Whole-browser backups are for personal migration only and should not be shared.

## Limitations

- localStorage, sessionStorage, IndexedDB, and Cache Storage are origin-bound by browser design.
- Whole-browser storage export only includes origins that are currently open in tabs.
- Whole-browser storage import may require visiting each site before staged storage can be restored.
- Some cookies may be rejected by Chrome if their attributes are no longer valid.
- Expired cookies in old backups may no longer work.
- Some websites may invalidate sessions after device, IP, browser, or security checks change.

## Permissions

Session Vault requests the following Chrome permissions:

- `cookies`: read and write cookies during export and import.
- `storage`: store pending import data locally inside the extension.
- `activeTab`: detect the current website in Current Site mode.
- `scripting`: read and write web storage in the active tab.
- `tabs`: enumerate open tabs in Whole Browser mode.
- `downloads`: save encrypted backup files locally.
- `<all_urls>` host access: support user-initiated backup and restore for any website.

All actions are explicitly initiated by the user from the popup.

## Verifying Local-Only Behavior

You can audit the source code to confirm that Session Vault does not transmit data externally.

The extension contains no remote analytics, telemetry, tracking SDK, backend endpoint, `fetch()`, `XMLHttpRequest`, or `WebSocket` calls.

## Project Structure

```text
session-vault/
├── manifest.json
├── popup.html
├── popup.js
├── crypto.js
├── storage-deep.js
├── background.js
├── PRIVACY.md
├── PRIVACY.html
└── icons/
```

## License

No license has been selected yet. All rights are reserved unless a license is added later.
