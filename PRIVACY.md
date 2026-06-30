# Privacy Policy for Session Vault

**Last updated: June 30, 2026**

## TL;DR

Session Vault is a **100% local-only** Chrome extension. We do **not** collect, transmit, store, or sell any of your data. Nothing leaves your device.

---

## Who we are

Session Vault is an open-source Chrome extension that lets users export and import their browser session data (cookies, localStorage, sessionStorage) as **password-encrypted local files** (AES-GCM 256-bit with PBKDF2-SHA256).

This Privacy Policy explains what data the extension accesses, how it is processed, and what we (the developer) do — and do not — do with it.

---

## Data we access

To perform its function, Session Vault accesses the following data on your local device:

| Data type | Why it's needed | Where it goes |
|---|---|---|
| **Cookies** (for current site or all sites) | To export/import authentication sessions | Encrypted into a local file on your device |
| **localStorage / sessionStorage** | To export/import full browser session state | Encrypted into a local file on your device |
| **Active tab URL / tab list** | To detect which domain to export from, or which tabs are open for the "All sites" mode | Used in-memory only, never stored or sent |
| **Extension storage** (chrome.storage) | To temporarily hold pending localStorage entries until you revisit the site (only for "All sites" import) | Local browser storage, on your device only |

---

## Data we do NOT collect

We do **not**:

- ❌ Send any data to any server (no analytics, no telemetry, no error reporting)
- ❌ Use third-party services, SDKs, or trackers
- ❌ Read, log, or upload your cookies / passwords / browsing history
- ❌ Have access to your encryption password (it never leaves your browser)
- ❌ Sell, share, or trade any data with anyone
- ❌ Use your data for advertising, profiling, or AI training

The extension has **no remote server**. There is no backend.

---

## How encryption works

When you export, your data is encrypted **entirely inside your browser** using:

- **AES-GCM 256-bit** authenticated encryption
- **PBKDF2-SHA256** key derivation with 250,000 iterations
- A random salt and IV per export

The resulting `.json` file is meaningless without your password. We (the developer) **cannot decrypt it** — there is no key escrow, no backdoor, and no recovery mechanism. If you lose your password, your data is unrecoverable.

---

## Permissions explained

Chrome requires us to request these permissions:

- **`cookies`** — Read and write cookies for export/import.
- **`storage`** — Save pending import data locally inside the extension.
- **`activeTab`** — Detect which website you're currently on (current-site mode).
- **`scripting`** — Inject a small script into your active tab to read/write localStorage and sessionStorage.
- **`tabs`** — Enumerate open tabs for "All sites" mode.
- **`downloads`** — Save the encrypted `.json` file to your Downloads folder.
- **`host_permissions: <all_urls>`** — Required because cookies and storage may belong to any domain you choose to back up. We only act when you explicitly press Export or Import in the popup.

We **never** silently scan, read, or transmit data from any website. All actions are user-initiated.

---

## Your responsibility

Because data never leaves your device, **you** are responsible for:

- Protecting the exported `.json` file (treat it like a password vault file)
- Choosing a strong password (16+ characters recommended)
- Sharing the file and password through **different channels** if used for team session sharing
- Not importing untrusted `.json` files from unknown sources

Anyone who obtains both your `.json` file and your password will be able to log in as you on the included sites (post-2FA).

---

## Children's privacy

Session Vault is not directed at children under 13 and does not knowingly collect data from anyone.

---

## Changes to this policy

If this policy ever changes, the updated version will be published in the same location with a new "Last updated" date. Since the extension does not have any remote service, changes to this policy will not retroactively affect any data — there is no data to affect.

---

## Contact

For questions about this Privacy Policy, please open an issue in the public GitHub repository for Session Vault or use the support contact listed on the Chrome Web Store listing.

---

## Verifiability

Session Vault is open source. The public repository that serves this page contains the full source code for the extension, including `manifest.json`, `popup.js`, `background.js`, `crypto.js`, and `storage-deep.js`.

The source code contains zero `fetch()`, `XMLHttpRequest`, or `WebSocket` calls to any remote endpoint.
