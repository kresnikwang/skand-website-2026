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
