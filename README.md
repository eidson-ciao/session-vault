# Session Vault 🔐

Chrome 扩展，加密导出/导入浏览器**凭据数据**（Cookies + LocalStorage + SessionStorage）。

## 两种模式

### 📍 当前网站模式
针对**当前打开 tab 的域名**，导出/导入：
- Cookies（含 HttpOnly，含同主域子域）
- LocalStorage
- SessionStorage
- 三项默认全勾，可单选

适合：**团队共享 session**（共用测试账号、共享后台登录态）

### 🌍 全浏览器模式
- 导出：**所有域名的 cookies** + 已打开 tab 的 localStorage/sessionStorage
- 导入：写入所有 cookies；localStorage 因为受同源限制，会**暂存**，等你访问对应网站时点扩展会提示恢复

适合：**自己迁移到新电脑**

## 安全设计

- 🔒 **AES-GCM 256** + PBKDF2-SHA256（25 万次迭代）
- 📦 输出 `.json` 文件（结构是加密信封）
- 🚫 完全本地，不联网
- 🔑 密码错误 → 解密失败，无任何提示给攻击者

### 文件格式（加密后）

```json
{
  "v": 1,
  "kind": "session-vault-site" | "session-vault-global",
  "alg": "AES-GCM",
  "kdf": "PBKDF2-SHA256",
  "iterations": 250000,
  "salt": "<base64>",
  "iv": "<base64>",
  "ct": "<base64>"
}
```

`ct` 解密后是明文 payload（JSON）。

## 安装

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」→ 选 `session-vault/` 目录

## 使用

### 团队共享 session

1. 拥有账号的人，在登录状态下打开目标网站
2. 点扩展 → 「当前网站」标签
3. 输入强密码 → 点「导出加密备份」→ 得到 `.json` 文件
4. 把 **文件** 和 **密码** 通过**不同渠道**发给队友
5. 队友打开同一网站，点扩展 → 输密码 → 选文件 → 刷新页面

### 迁移到新电脑

**在旧电脑：**
1. 把你常用的几个网站 tab 都打开（这样 localStorage 才能被抓到）
2. 点扩展 → 「全浏览器」标签
3. 输入强密码 → 「导出全浏览器备份」
4. 把 `.json` 文件传到新电脑

**在新电脑：**
1. 装好这个扩展
2. 点扩展 → 「全浏览器」标签 → 输密码 → 选文件
3. cookies 立即恢复（你可能已经被登录了）
4. 访问对应网站时，扩展会显示「点击此处恢复 localStorage」横幅

## 限制说明

- **LocalStorage 跨设备**：浏览器不允许扩展给"没访问过的源"写 localStorage，所以全浏览器模式只能抓**已打开 tab** 的 localStorage，且导入时需要"暂存 + 访问触发"两步。
- **`SameSite=Strict` cookie**：少数会被浏览器拒，少数网站可能失效。
- **Cookie 过期**：备份久了的 vault 可能因为 expiry 已经到了而无效。

## 安全注意 ⚠️

- 谁拿到 `.json` + 密码 = 谁能登入这些账号（已过 2FA）
- 全浏览器备份**绝对不要分享**给任何人
- 团队共享备份用**强密码**（16+ 位），文件和密码**走不同渠道**
- 不要导入来路不明的 `.json` 文件

## 文件结构

```
session-vault/
├── manifest.json     # MV3 配置
├── popup.html        # UI（两个 tab）
├── popup.js          # 站点 + 全局两套逻辑
├── crypto.js         # AES-GCM 加解密
├── background.js     # service worker（占位）
└── icons/            # 图标（待补）
```
