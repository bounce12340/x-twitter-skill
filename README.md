# X-Twitter Skill for OpenClaw 🐦‍⬛

<p align="center">
  <h2 align="center">Twitter/X API Skill for OpenClaw</h2>
  <p align="center">Read tweets, search, post, and manage your timeline from OpenClaw</p>
  <p align="center">
    <a href="#english">🇺🇸 English</a> • 
    <a href="#繁體中文">🇹🇼 繁體中文</a>
  </p>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/OpenClaw-Skill-blue?style=flat-square" alt="OpenClaw">
</p>

---

<a name="english"></a>

## 🇺🇸 English

> A powerful Twitter/X API skill for OpenClaw that allows you to interact with Twitter/X posts, timelines, and users directly from your OpenClaw agent.

### ✨ Features

| Feature | Description |
|---------|-------------|
| 📖 **Read Tweets** | Read single tweets, threads, and replies with full metadata |
| 🔍 **Search** | Search tweets with advanced operators and filters |
| ✍️ **Post Tweets** | Post tweets, replies, and quotes with optional media |
| ❤️ **Engage** | Like, retweet, bookmark, and manage interactions |
| 👤 **User Profiles** | View user profiles, timelines, and follow/unfollow |
| 📊 **Trending** | Get trending topics worldwide or by location |
| 📝 **Lists** | Manage Twitter lists and view list timelines |

### 📋 Prerequisites

1. **Twitter API Bearer Token**
   - Get it from [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Set environment variable: `TWITTER_BEARER_TOKEN`

2. **Node.js** 18+ [Download](https://nodejs.org/)

3. **OpenClaw** installed

### 🚀 Installation

```bash
# Clone this repository
git clone https://github.com/bounce12340/x-twitter-skill.git
cd x-twitter-skill

# Install dependencies
npm install

# Or install globally
npm install -g twclaw
```

### ⚙️ Configuration

Set your Twitter API credentials as environment variables:

**Windows (PowerShell):**
```powershell
$env:TWITTER_BEARER_TOKEN = "your_bearer_token_here"
$env:TWITTER_API_KEY = "your_api_key_here"        # Optional, for write operations
$env:TWITTER_API_SECRET = "your_api_secret_here"  # Optional, for write operations
```

**Windows (CMD):**
```cmd
set TWITTER_BEARER_TOKEN=your_bearer_token_here
set TWITTER_API_KEY=your_api_key_here
set TWITTER_API_SECRET=your_api_secret_here
```

**Linux/Mac:**
```bash
export TWITTER_BEARER_TOKEN="your_bearer_token_here"
export TWITTER_API_KEY="your_api_key_here"
export TWITTER_API_SECRET="your_api_secret_here"
```

Verify configuration:
```bash
twclaw auth-check
```

### 📚 Usage

#### Reading Tweets

```bash
# Read a single tweet
twclaw read https://x.com/elonmusk/status/1234567890
twclaw read 1234567890

# Read a thread
twclaw thread https://x.com/elonmusk/status/1234567890

# Read replies
twclaw replies 1234567890 -n 20

# View user profile
twclaw user @elonmusk

# View user's tweets
twclaw user-tweets @elonmusk -n 20
```

#### Timelines

```bash
# Home timeline
twclaw home -n 20

# Mentions
twclaw mentions -n 10

# User's liked tweets
twclaw likes @elonmusk -n 10
```

#### Search

```bash
# Basic search
twclaw search "OpenAI" -n 10

# Search with operators
twclaw search "from:elonmusk AI" -n 5
twclaw search "#trending" --recent
twclaw search "AI news" --popular
```

#### Trending

```bash
# Worldwide trending
twclaw trending

# Trending in specific location (WOEID)
twclaw trending --woeid 23424977  # United States
```

#### Posting

```bash
# Post a tweet
twclaw tweet "Hello World from OpenClaw! 🐦‍⬛"

# Reply to a tweet
twclaw reply 1234567890 "This is a great point!"

# Quote tweet
twclaw quote 1234567890 "Interesting perspective on this"

# Tweet with media
twclaw tweet "Check out this image" --media ./image.png
```

#### Engagement

```bash
# Like / Unlike
twclaw like 1234567890
twclaw unlike 1234567890

# Retweet / Unretweet
twclaw retweet 1234567890
twclaw unretweet 1234567890

# Bookmark / Unbookmark
twclaw bookmark 1234567890
twclaw unbookmark 1234567890
```

#### Following

```bash
# Follow / Unfollow
twclaw follow @elonmusk
twclaw unfollow @elonmusk

# View followers / following
twclaw followers @elonmusk -n 20
twclaw following @elonmusk -n 20
```

#### Lists

```bash
# Your lists
twclaw lists

# List timeline
twclaw list-timeline 123456789 -n 20

# Manage list members
twclaw list-add 123456789 @username
twclaw list-remove 123456789 @username
```

### 🎛️ Output Options

```bash
--json          # JSON output for programmatic use
--plain         # Plain text, no formatting
--no-color      # Disable ANSI colors
-n, --count     # Number of results (default: 10)
--cursor        # Pagination cursor for next page
--all           # Fetch all pages (use with caution)
```

### 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Check `TWITTER_BEARER_TOKEN` is set and valid |
| `429 Rate Limited` | Wait and retry. Twitter API has rate limits (usually 15-min windows) |
| `403 Forbidden` | Ensure your API key has required permissions for write operations |
| Command not found | Run `npm install -g twclaw` or use `./bin/twclaw.js` |
| Authentication failed | Run `twclaw auth-check` to verify credentials |

### 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<a name="繁體中文"></a>

## 🇹🇼 繁體中文

> 強大的 Twitter/X API Skill，讓你能直接從 OpenClaw 與 Twitter/X 貼文、時間軸和使用者互動。

### ✨ 特色

| 特色 | 說明 |
|------|------|
| 📖 **讀取貼文** | 讀取單一貼文、串文和回覆，含完整元資料 |
| 🔍 **搜尋** | 使用進階運算子和篩選器搜尋貼文 |
| ✍️ **發佈貼文** | 發佈貼文、回覆和引用，可選擇附上媒體 |
| ❤️ **互動** | 按讚、轉推、書籤和管理互動 |
| 👤 **使用者檔案** | 檢視使用者檔案、時間軸和追蹤/取消追蹤 |
| 📊 **熱門趨勢** | 取得全球或特定地點的熱門趨勢 |
| 📝 **列表** | 管理 Twitter 列表和檢視列表時間軸 |

### 📋 系統需求

1. **Twitter API Bearer Token**
   - 從 [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) 取得
   - 設定環境變數：`TWITTER_BEARER_TOKEN`

2. **Node.js** 18+ [下載](https://nodejs.org/)

3. **OpenClaw** 已安裝

### 🚀 安裝

```bash
# 複製此專案
git clone https://github.com/bounce12340/x-twitter-skill.git
cd x-twitter-skill

# 安裝依賴
npm install

# 或全域安裝
npm install -g twclaw
```

### ⚙️ 設定

將你的 Twitter API 認證設定為環境變數：

**Windows (PowerShell):**
```powershell
$env:TWITTER_BEARER_TOKEN = "your_bearer_token_here"
$env:TWITTER_API_KEY = "your_api_key_here"        # 選擇性，用於寫入操作
$env:TWITTER_API_SECRET = "your_api_secret_here"  # 選擇性，用於寫入操作
```

**Windows (CMD):**
```cmd
set TWITTER_BEARER_TOKEN=your_bearer_token_here
set TWITTER_API_KEY=your_api_key_here
set TWITTER_API_SECRET=your_api_secret_here
```

**Linux/Mac:**
```bash
export TWITTER_BEARER_TOKEN="your_bearer_token_here"
export TWITTER_API_KEY="your_api_key_here"
export TWITTER_API_SECRET="your_api_secret_here"
```

驗證設定：
```bash
twclaw auth-check
```

### 📚 使用方式

#### 讀取貼文

```bash
# 讀取單一貼文
twclaw read https://x.com/elonmusk/status/1234567890
twclaw read 1234567890

# 讀取串文
twclaw thread https://x.com/elonmusk/status/1234567890

# 讀取回覆
twclaw replies 1234567890 -n 20

# 檢視使用者檔案
twclaw user @elonmusk

# 檢視使用者貼文
twclaw user-tweets @elonmusk -n 20
```

#### 時間軸

```bash
# 首頁時間軸
twclaw home -n 20

# 提及
twclaw mentions -n 10

# 使用者按讚的貼文
twclaw likes @elonmusk -n 10
```

#### 搜尋

```bash
# 基本搜尋
twclaw search "OpenAI" -n 10

# 使用運算子搜尋
twclaw search "from:elonmusk AI" -n 5
twclaw search "#trending" --recent
twclaw search "AI news" --popular
```

#### 熱門趨勢

```bash
# 全球熱門
twclaw trending

# 特定地點熱門 (WOEID)
twclaw trending --woeid 23424977  # 美國
```

#### 發佈貼文

```bash
# 發佈貼文
twclaw tweet "Hello World from OpenClaw! 🐦‍⬛"

# 回覆貼文
twclaw reply 1234567890 "這是很棒的觀點！"

# 引用貼文
twclaw quote 1234567890 "對這個有趣的想法"

# 貼文附圖片
twclaw tweet "看看這張圖片" --media ./image.png
```

#### 互動

```bash
# 按讚 / 取消按讚
twclaw like 1234567890
twclaw unlike 1234567890

# 轉推 / 取消轉推
twclaw retweet 1234567890
twclaw unretweet 1234567890

# 書籤 / 移除書籤
twclaw bookmark 1234567890
twclaw unbookmark 1234567890
```

#### 追蹤

```bash
# 追蹤 / 取消追蹤
twclaw follow @elonmusk
twclaw unfollow @elonmusk

# 檢視追蹤者 / 正在追蹤
twclaw followers @elonmusk -n 20
twclaw following @elonmusk -n 20
```

#### 列表

```bash
# 你的列表
twclaw lists

# 列表時間軸
twclaw list-timeline 123456789 -n 20

# 管理列表成員
twclaw list-add 123456789 @username
twclaw list-remove 123456789 @username
```

### 🎛️ 輸出選項

```bash
--json          # JSON 格式輸出，供程式使用
--plain         # 純文字，無格式
--no-color      # 停用 ANSI 色彩
-n, --count     # 結果數量（預設：10）
--cursor        # 分頁游標，用於下一頁
--all           # 取得所有頁面（謹慎使用）
```

### 🐛 疑難排解

| 問題 | 解決方案 |
|------|----------|
| `401 Unauthorized` | 檢查 `TWITTER_BEARER_TOKEN` 是否正確設定且有效 |
| `429 Rate Limited` | 等待後重試。Twitter API 有限制（通常 15 分鐘窗口） |
| `403 Forbidden` | 確保你的 API Key 有寫入操作所需的權限 |
| 找不到命令 | 執行 `npm install -g twclaw` 或使用 `./bin/twclaw.js` |
| 認證失敗 | 執行 `twclaw auth-check` 驗證認證 |

### 📄 授權

MIT 授權 — 詳見 [LICENSE](LICENSE)

---

## 🙏 Acknowledgments / 致謝

This skill is designed to work with [OpenClaw](https://github.com/openclaw/openclaw), the open-source AI agent framework.

本 Skill 設計用於 [OpenClaw](https://github.com/openclaw/openclaw)，開源 AI Agent 框架。

---

<p align="center">
  Made with ❤️ for the OpenClaw community
</p>
