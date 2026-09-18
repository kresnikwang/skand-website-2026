# SKAND Studio 官网项目记忆

## 项目概述
- 纯HTML单文件网站，无框架
- 定位：精品创意机构展示官网
- 风格：深色主题，coral(#E8563A)/blue(#4052B5)强调色
- 字体：Cormorant Garamond (衬线) + Outfit (无衬线)

## 页面结构
1. Hero - 大标题动画 "SKAND"
2. About - 公司介绍
3. Services - 7大服务板块
4. **Work (Portfolio)** - 作品集，核心区域
5. Clients - 品牌滚动字幕
6. Contact - Kris Wang, kris.wang@skandstudio.com

## 作品集更新指南

### 数据位置
- 作品数据在 `index.html` 的 `projects` 数组（第275-328行）
- 图片放在 `pdf_images/` 目录

### 项目数据结构
```javascript
{name:'项目名', brand:'品牌', cat:'分类', img:'pdf_images/xxx.jpg'}
```

### 分类标签 (7种)
- `imc` - IMC & Brand Voice
- `content` - Brand Content
- `social` - Social Storytelling
- `digital` - Digital Experience
- `visual` - Brand Visual Design
- `connections` - Consumer Connections
- `all` - 全部

### 筛选标签定义 (第338-339行)
```javascript
const cats = ['all','imc','content','social','digital','visual','connections'];
const catLabels = {all:'All',imc:'IMC & Brand Voice',...};
```

### 添加新作品
1. 准备图片放入 `pdf_images/` 目录
2. 在 `projects` 数组中添加新对象
3. 图片引用: `img:'pdf_images/page_XX.jpg'`

### 当前客户 (Marquee)
定义在第330行: Nike, Jordan, Converse, Salomon, Marshall, Decathlon等

## 关键特效
- Grain纹理背景
- 自定义光标
- Hero文字逐字动画
- 滚动进入动画 (IntersectionObserver)
- Lightbox图片查看器 (支持键盘导航)
- 视差背景圆环

## 技术特点
- 响应式设计 (1024px/768px断点)
- 移动端隐藏自定义光标
- 无障碍支持 (键盘导航)

## 部署与 SEO（重要）

### 部署
- 生产：`root@123.57.167.97`（sshpass 密码见 `test_ssh.exp`），1Panel OpenResty（容器 `1Panel-openresty-hoTG`）
- 网站根：`/opt/1panel/www/wwwroot/www.skandstudio.com/`（= 容器 `/www/wwwroot/www.skandstudio.com`）
- 部署命令：`rsync -az --delete`（排除见 `DEPLOYMENT.md`），静态文件即时生效
- **坑**：连续多次密码认证会触发 SSH 限流（`Connection closed by port 22`），需等数十秒~数分钟再试；
  `nginx -s reload` 是 graceful，旧 worker 退场前可能仍返回旧结果，验证前稍等或重试

### Nginx 配置
- 站点配置：`/opt/1panel/www/conf.d/skandstudio.com.conf`（→ 容器 `conf.d/`，已挂载）
- 外层 TLS：`/opt/1panel/www/stream.d/anytls-sni.conf` 的 stream 块按 SNI 把公网 443 → `127.0.0.1:9443`（应用层终止 TLS）
- 重载：`docker exec 1Panel-openresty-hoTG nginx -t && nginx -s reload`
- 备份：`skandstudio.com.conf.bak.20260913`

### SEO 规范（2026-09-13 定）
- **canonical 域 = 非 www `https://skandstudio.com`**（与 sitemap / og:url 一致）
- www → 非 www：HTTP(80) 块 `return 301 https://skandstudio.com$request_uri`；
  HTTPS(9443) 块 `if ($host = www.skandstudio.com) { return 301 ...; }`（证书 SAN 含两域名）
- `index.html` 已有 canonical + hreflang（x-default/en/zh），且 JS 随语言动态改 canonical
- `b-side.html` 已补 canonical；`egg.html` 是 `noindex,nofollow`（彩蛋页），**已从 sitemap 移除**
- `robots.txt` 引用 sitemap；sitemap 4 条 URL（`/`、`/?lang=en`、`/?lang=zh`、`/b-side.html`）
- Google Search Console 已由用户完成域名验证

