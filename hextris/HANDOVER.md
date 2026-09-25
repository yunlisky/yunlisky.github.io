# Hextris 魔改版 · 技术交接文档

> 更新时间：2026-09-25　|　维护人：待交接
> 线上地址：https://yunlisky.github.io/hextris/
> 代码仓库：https://github.com/yunlisky/yunlisky.github.io （游戏在 `hextris/` 子目录，main 分支）

---

## 1. 项目是什么

基于开源游戏 [Hextris/hextris](https://github.com/Hextris/hextris)（GPL，六边形消除类小游戏）的二次修改版，做了三件事：

1. **移除全部推广/追踪因素**
2. **增强移动端（手机/平板）支持**
3. **全界面简体中文汉化**

纯静态项目：HTML + JS + Canvas，**无构建步骤、无依赖安装**，改完文件推送即生效。

## 2. 技术栈与目录结构

```
hextris/
├── index.html              # 入口，所有脚本在此加载
├── manifest.webmanifest    # PWA 清单（可"添加到主屏幕"）
├── js/
│   ├── main.js             # 游戏主循环、init()、帮助页文案（中文在 showHelp()）
│   ├── view.js             # 渲染/文字绘制（"开始游戏""游戏暂停"等 canvas/overlay 文案）
│   ├── initialization.js   # 初始化、触屏设备检测（platform: mobile/nonmobile）
│   ├── input.js            # 键盘 + 点击/触摸输入（点屏幕左右半边旋转）
│   ├── Hex.js / Block.js / wavegen.js / update.js / render.js / checking.js
│   ├── Text.js / comboTimer.js / save-state.js（localStorage 存档与最高分）
│   └── math.js
├── vendor/                 # 第三方库（jquery、hammer、keypress、js.cookie、jsonfn、sweet-alert）
├── style/style.css         # 全部样式，末尾有 "mobile enhancements" 段
└── images/                 # 按钮 SVG、图标
```

上游原版在 `gh-pages` 分支的本地克隆里开发（origin 指向上游），**发布内容同步复制到 yunlisky.github.io 仓库的 `hextris/` 子目录**。两处代码保持一致。

## 3. 相对上游的改动清单

### 3.1 去推广/追踪（commit: Remove promo/tracking elements）

| 移除项 | 位置 |
|---|---|
| Google Analytics（2 处内联脚本） | index.html、js/initialization.js |
| Google AdSense 广告脚本 | index.html |
| `hextris.io/a.js` 外链追踪脚本加载器 | js/main.js 末尾 IIFE |
| Twitter/Facebook/VK 分享按钮、"SHARE MY SCORE!" | index.html（`#socialShare`、`.rrssb-buttons`）+ vendor/rrssb.min.js + style/rrssb.css（已删文件） |
| iOS/Android 应用商店徽章与 `apple-itunes-app` meta、og/twitter meta | index.html、images/（android.png、appstore.svg 等已删） |
| 暂停页"购买无广告版"链接（pausedAndroid/pausediOS/pausedOther） | js/view.js `showText()` |
| 帮助页作者/官网/商店链接 | js/main.js `showHelp()` |
| `CNAME`（hextris.io 域名劫持文件，会污染 GitHub Pages） | 根目录（已删） |
| `FUNDING.yml`（GitHub 赞助按钮） | .github/（已删） |

**注意**：`#buttonCont` 是空 div 但**必须保留**在 index.html 的 `#bottomContainer` 里——`setBottomContainer()`（main.js）会读它的 offset，删掉会导致 `init()` 崩溃、游戏白屏。这是删分享按钮时踩过的真实坑。

### 3.2 移动端增强

- **设备检测修复**：js/initialization.js 的正则补了 `iPad`，并新增「maxTouchPoints>1 且平台为 Mac」判定（iPadOS 13+ 伪装 Mac 的场景），否则这类设备走桌面配置、无触屏输入
- **CSS**（style/style.css 末尾 `mobile enhancements` 段）：
  - `touch-action: manipulation/none` 禁双击缩放和手势、`overscroll-behavior: none` 禁橡皮筋、`user-select: none` 禁长按选中
  - 按钮 `env(safe-area-inset-*)` 刘海屏安全区适配（帮助钮左上、暂停/重开右下/左下）
- **viewport** 加了 `viewport-fit=cover`（index.html）
- 触屏交互本身上游已有：点屏幕左右半边旋转（js/input.js `handleClickTap`），无需改动

### 3.3 简体中文汉化（commit: 本地化）

| 文案 | 位置 |
|---|---|
| 网页标题「Hextris · 六边形消除」、最高分/游戏结束/历史最高 | index.html |
| canvas 文字「开始游戏」「Hextris」标题 | js/view.js（drawScoreboard 内） |
| overlay「游戏暂停」「点击屏幕开始 / 按回车键开始」 | js/view.js `showText()` |
| 帮助页整页说明 | js/main.js `showHelp()` |
| manifest 描述 | manifest.webmanifest |

### 3.4 编码坑（重要！）

页面**必须**保持这两处 UTF-8 声明，否则中文在 canvas 里变 GBK 乱码（「寮€濮嬫父鎴?」这种）：

1. `<head>` 第一行 `<meta charset="utf-8">`
2. 含中文的两个脚本标签显式声明：`<script type='text/javascript' charset="utf-8" src="js/view.js">`（main.js 同理）

背景：GitHub Pages 对 .js 返回 `charset=utf-8` 头所以线上安全；但本地 `python -m http.server` 等不带头，浏览器会按 GBK 猜。**浏览器还会缓存首次的错误解码结果**——验证乱码修复时务必换端口或硬刷新。

## 4. 部署流程（网络环境：GitHub HTTPS 被墙）

本机 SSH 到 GitHub 可用（端口 22 直连，已配密钥并 `gh auth` 登录为 yunlisky）。**不要走 HTTPS push（502）。**

```bash
# 1) 游戏源码在本地 hextris/（gh-pages 分支，origin 指向上游，仅用于 diff 参考）
#    改动在这里做完、本地验证后：

# 2) 同步到发布仓库（首次需要 clone，见下）
SITE=/tmp/yunlisky-site-XXXX   # 用 mktemp -d 生成，避免和旧的坏目录冲突
git clone git@github.com:yunlisky/yunlisky.github.io.git "$SITE"

# 3) 复制（排除 .git，--delete 保持一致）
rsync -a --exclude='.git' --delete /path/to/hextris/ "$SITE/hextris/"

# 4) 提交推送（SSH 协议）
cd "$SITE" && git add -A && git commit -m "..." && git push origin main

# 5) 验证（Pages 构建约 1 分钟，CDN 缓存约 10 分钟）
curl -s https://yunlisky.github.io/hextris/ | grep 六边形消除
gh api repos/yunlisky/yunlisky.github.io/pages/builds/latest --jq '.status'   # 应为 built
```

**注意**：仓库根目录的 `index.html`/`Project1`/`static` 是用户原有主页，**不要动**，游戏只放 `hextris/` 子目录。

## 5. 本地运行与验证

```bash
# 起本地服务（推荐带 charset 头的写法，避免中文乱码干扰判断）：
python3 -c "
import http.server
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js':'text/javascript; charset=utf-8'}
    def __init__(self,*a,**k): super().__init__(*a, directory='<hextris路径>', **k)
http.server.ThreadingHTTPServer(('127.0.0.1', 8789), H).serve_forever()"
# 浏览器打开 http://localhost:8789/
```

自测清单（无头浏览器 agent-browser 或手动均可）：
- [ ] 菜单页：「开始游戏」「最高分」中文正常（无乱码）
- [ ] 点 Play 开始，点屏幕左右半边能旋转
- [ ] 帮助按钮（左上 ?）→「游戏玩法」内容完整
- [ ] 暂停按钮 →「游戏暂停」
- [ ] Game Over →「游戏结束 / 历史最高」，无任何分享/商店按钮
- [ ] 检查 DevTools Network：无任何对外部域（google-analytics、adsbygoogle、hextris.io 等）的请求
- [ ] 手机 UA / 真机：触屏旋转正常、按钮不被刘海遮挡

## 6. 遗留事项（接手人注意）

1. **workspace 垃圾目录**：`site/`、`site-deploy/`、`deploy-20260925/` 是历次中断克隆留下的坏仓库（HEAD 损坏），删除被安全护栏拦截，确认无用后可手动清理
2. `vendor/sweet-alert.min.js` 已无代码引用，可删（约 7KB，未删是为最小改动）
3. `js/*.js` 里对 `$('#fork-ribbon')` 的 jQuery 调用是空操作（元素已随去推广移除），无害，可顺手清理
4. 上游 LICENSE.md（GPL）保留在仓库，二次分发需保留
5. 本地预览服务若还在跑：8788 端口是旧实例（无 charset 头），8789 是带头的，任选但别被 8788 的乱码误导
6. 云端与本地可能因 CDN 缓存有约 10 分钟延迟，改完没生效先等再查

## 7. 快速命令速查

```bash
# 测 SSH 通不通
ssh -T git@github.com                                   # 期望: Hi yunlisky!

# 上游有没有新版本（走镜像 clone 对比，直连会 502）
git clone --depth 1 https://gitclone.com/github.com/Hextris/hextris.git /tmp/upstream
```
