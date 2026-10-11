# WeChat Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give SKAND a recognizable share cover and copy; connect WeChat friend/timeline customization when the owner's account permissions and credentials are configured.

**Architecture:** Keep the static website. Provide a square JPEG for WeChat and a landscape JPEG for Open Graph, with localized metadata and share payloads. A private Node signing service caches the WeChat token/ticket; the browser receives only the app ID and signature. Account-dependent activation remains pending until the owner supplies configuration.

**Tech Stack:** Static HTML/JavaScript, SVG typography rendered with Sharp, Node built-ins, WeChat JS-SDK 1.6.0, existing SSH/rsync deployment.

### Task 1: Assets and ordinary link previews
- Create brand covers using the existing black, warm white and coral palette, wordmark, Outfit and Cormorant typography. Keep the square cover legible as a small thumbnail.
- Update Open Graph/Twitter image, dimensions, alt text, site name and bilingual title/description.
- Publish assets and metadata independently of the account setup.

### Task 2: WeChat client
- Use only in the WeChat browser, and only after the signing endpoint is enabled.
- Configure updateAppMessageShareData and updateTimelineShareData with canonical, language-specific links, square cover, title and friend description.
- Preserve the original entry URL for iOS signatures; refresh Android configuration on language/back changes. Abort stale requests and leave the page functional on SDK/network failure.

### Task 3: Private signer and setup
- Add a Node service outside the static publishing root, environment-based credentials, restricted URL signing, timeout and token/ticket cache.
- Test actual signature input, cache coalescing, expiry, rejected URLs and sanitized error responses with mocked upstream only.
- Document account permissions, JS safe domain, domain verification file, server IP whitelist and secret configuration; do not put secrets in the website or chat.
- Activate and test real WeChat sharing only when account setup is available. Do not call ordinary browser tests a real WeChat test.
