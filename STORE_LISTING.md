# Chrome Web Store Listing - Session Vault

## 1. Name (插件名称)
```
Session Vault — Encrypted Cookie & Session Backup
```
> ⚠️ Chrome 限制 45 字符,这版 44 字符,刚好

**备选短版本(如果太长被拒):**
```
Session Vault
```

---

## 2. Summary / Short Description (132 字符以内)

**英文版(推荐):**
```
Encrypted backup & sharing of cookies, localStorage and sessionStorage. AES-256, 100% local, zero servers, zero tracking.
```
> 119 字符 ✅

**中文版(如果你想发中文区):**
```
加密备份与共享 Cookie、localStorage 和 sessionStorage。AES-256 加密,100% 本地运行,不联网,不追踪。
```

---

## 3. Detailed Description (详细描述)

**英文版:**

```
🔐 Session Vault is a privacy-first Chrome extension that lets you export
and import your browser session — cookies, localStorage, and sessionStorage
— as a password-encrypted file.

Everything happens 100% locally. No servers. No tracking. No telemetry.
Your data and your password never leave your browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ TWO MODES

📍 Current Site Mode
Export/import the cookies + localStorage + sessionStorage of just the
website you're viewing. Perfect for:
• Sharing a test account session with teammates
• Sharing admin panel logins safely within a team
• Quickly transferring a logged-in session to another machine

🌍 All Sites Mode
Export every cookie in your browser, plus the localStorage of every tab
that's currently open. Perfect for:
• Migrating your entire browser session to a new computer
• Creating a personal encrypted backup before reinstalling Chrome
• Backing up your logged-in state across dozens of sites at once

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒 SECURITY

• AES-GCM 256-bit authenticated encryption
• PBKDF2-SHA256 key derivation (250,000 iterations)
• Random salt + IV per export
• Wrong password = silent failure (no oracle for attackers)
• Open source — audit the code yourself

The encrypted .json file is meaningless without your password.
Even we (the developer) cannot decrypt it. There is no backdoor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 WHAT WE DON'T DO

❌ No data collection
❌ No analytics or tracking
❌ No external servers
❌ No third-party SDKs
❌ No ads
❌ No account required

The extension contains zero network calls. You can verify this in the
source code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ HOW IT WORKS

1. Open the extension popup
2. Choose Current Site or All Sites mode
3. Enter a strong password (16+ chars recommended)
4. Click "Export" → a .json file is downloaded
5. To restore: open the popup, enter the same password, select the file

For team session sharing:
• Send the .json file and the password through DIFFERENT channels
• Use a strong password
• Treat the file like a password vault

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT NOTES

• localStorage is bound to its origin — in "All Sites" import mode,
  localStorage is queued and restored when you next visit the site.
• Some SameSite=Strict cookies may be rejected by Chrome.
• Anyone with both your file and password can log in as you on those
  sites (post-2FA). Treat backups accordingly.
• Never import a .json file from an untrusted source.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ PERMISSIONS EXPLAINED

• cookies — read/write cookies for export and import
• storage — temporarily hold pending localStorage entries
• activeTab + tabs — detect which sites to back up
• scripting — read/write localStorage and sessionStorage in your tabs
• downloads — save the encrypted .json file
• <all_urls> — your cookies belong to many domains; this allows export/
  import of any domain you choose. All actions are user-initiated only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 OPEN SOURCE

Source code: [Your GitHub URL]
Privacy policy: [Your privacy policy URL]
Issues / feedback: [Your GitHub Issues URL]

Built for engineers, teams, and anyone who wants a secure way to back
up or share their browser sessions without trusting a third-party cloud.
```

---

## 4. Category (类别)
**主类别:** `Productivity` (生产力)
**备选:** `Developer Tools` (开发者工具)

> 💡 建议选 Productivity,搜索量大;Developer Tools 受众太窄

---

## 5. Single Purpose (单一用途说明)

Chrome 商店会问你"这个插件的单一用途是什么",回答:

```
Securely export and import browser session data (cookies, localStorage,
sessionStorage) as locally-encrypted files, enabling personal backups and
controlled team session sharing without relying on any cloud service.
```

---

## 6. Permission Justifications (权限解释 - Chrome 会逐项要求)

复制粘贴用:

**`cookies`:**
```
Required to read cookies for export and write cookies back during import.
This is the core function of the extension. No cookies are ever sent
to any server.
```

**`storage`:**
```
Used to temporarily store pending localStorage entries when importing
an "All Sites" backup. localStorage can only be written from within
its origin, so the data is queued in chrome.storage until the user
visits the matching site.
```

**`activeTab`:**
```
Used to detect the current tab's domain in "Current Site" mode, so the
user knows which site they are about to back up or restore.
```

**`scripting`:**
```
Used to inject a small content script into the user's active tab to
read/write localStorage and sessionStorage. The extension cannot read
these through other APIs.
```

**`tabs`:**
```
Used in "All Sites" mode to enumerate currently open tabs so their
localStorage can be captured (localStorage is per-origin and only
accessible from open tabs).
```

**`downloads`:**
```
Used to save the encrypted .json backup file to the user's Downloads
folder via chrome.downloads API.
```

**`host_permissions: <all_urls>`:**
```
Cookies and storage in a browser belong to arbitrary domains. To allow
the user to back up or restore session data for any site they choose,
the extension requires broad host access. The extension does NOT
silently access any site — every action is initiated explicitly by
the user pressing Export or Import in the popup. No data is transmitted
externally; everything is encrypted locally and saved to a file.
```

**Remote code use:**
```
This extension does not use remote code. All JavaScript is bundled
and executes locally. There are zero fetch/XHR calls in the codebase.
```

**Data collection disclosure (in the "Privacy practices" section):**
```
Personally identifiable information: NO
Health information: NO
Financial and payment information: NO
Authentication information: NO (the extension handles cookies but
  never transmits or stores them remotely — they are only encrypted
  locally and given back to the user as a file)
Personal communications: NO
Location: NO
Web history: NO
User activity: NO
Website content: NO
```

✅ 勾选: "I do not sell or transfer user data to third parties..."
✅ 勾选: "I do not use or transfer user data for purposes unrelated..."
✅ 勾选: "I do not use or transfer user data to determine creditworthiness..."

---

## 7. Screenshots (截图建议)

需要 1-5 张,1280×800 或 640×400。建议拍这几张:

1. **主界面 - Current Site 模式**:打开 popup,显示当前网站名 + 三个 checkbox + 密码框
2. **主界面 - All Sites 模式**:切换到 All Sites tab
3. **加密说明小卡片**:做一张图文说明 "AES-256 + PBKDF2 + 100% Local"
4. **使用场景图**:画一个团队共享 session 的流程图(可选)
5. **导出成功的样子**:显示一个 .json 文件被下载

> 💡 第 3 张可以用 Figma / Canva 做,免费模板很多

---

## 8. Promotional Tile (可选但推荐)

- **Small Promo Tile**: 440×280 — 写 "Session Vault" + 加密小图标
- **Marquee Promo Tile**: 1400×560 — 横幅大图,展示功能

---

## 9. 提交前 Checklist

- [ ] 图标四个尺寸(16/48/128 + 32 用于工具栏)✅ 已生成
- [ ] manifest.json 含完整 icons 字段 ✅ 已更新
- [ ] 截图至少 1 张(1280×800)
- [ ] 详细描述完整
- [ ] 隐私政策 URL(把 PRIVACY.md 放到 GitHub Pages 或个人网站)
- [ ] GitHub 仓库 URL(强烈建议公开源码,会大大提高过审率)
- [ ] 删掉根目录的三个原始素材 PNG/SVG 再打包
- [ ] 打包成 ZIP(manifest 在根目录,不要套文件夹)

---

## 10. 关键提醒 ⚠️

1. **`<all_urls>` + `cookies` 是高敏感组合**,Google 几乎一定会人工审核
2. **强烈建议把代码放 GitHub 公开**,然后在描述里贴链接 — 审核员会去看,过审快很多
3. **隐私政策必须是公开 URL**(不能是 GitHub README),用 GitHub Pages 几分钟就能搞定
4. 如果第一次被拒,根据邮件指引改完再提交,**不要换号重提**
