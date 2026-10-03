# dsh-custom-account-launcher

给 DSH 侧边栏底部的账号入口换上你自己的头像和昵称 —— **不改动已绑定的账号**，也**不破坏外壳原本的账号菜单**。

> Give the DSH sidebar account launcher your own avatar and nickname — without
> touching the bound account and without losing the shipped account menu.

---

## 它做什么

- **重绘侧栏账号入口**：左下角那个显示头像和昵称的位置，换成你自定义的头像与昵称。
- **新增设置板块**：在 **设置 → 账号与余额** 里，账号板块与余额板块**中间**插入一个「头像与昵称」板块。
- **保留原菜单**：点击仍然弹出外壳原本的 **设置 / 意见反馈 / 退出登录**（含退登前的运行中任务检查与确认框）。
- **不碰账号**：不读取、不修改、不解绑任何账号信息，登录与余额照常。

## 安装

```sh
dsh plugin --profile <profile> add dsh-custom-account-launcher
# 或从本地目录
dsh plugin --profile <profile> add link:/path/to/dsh-custom-account-launcher
```

重启 DSH 后生效（客户端 bundle 需要重新加载）。

## 使用

打开 **设置 → 账号与余额 → 头像与昵称**：

| 控件 | 说明 |
|---|---|
| 预览 | 实时跟随**草稿**，不会影响侧栏 |
| 昵称 | 最多 24 字；留空则只显示头像 |
| 头像 | 选择本机图片（转 base64 内嵌，**离线可用，不上传**）；可清除 |
| 形状 | **圆形** / **圆角方形** |
| 确认 | 应用到侧栏并持久化；无改动时自动禁用 |
| 放弃改动 | 丢弃草稿 |

**改动只有在点「确认」之后才会应用到侧栏**，之前只在预览里可见。

界面文案跟随 **DSH 的语言设置**（非浏览器语言），运行中切换语言会即时重渲染。

## 工作原理（给维护者）

- **纯客户端插件**。宿主半区是空操作：DSH Desktop 的页面来自 `dsh-app://app/`，宿主侧的 `webServer.tapIndex` 根本送达不到，样式必须在页面内注入。
- **不占据 `settings.launcher` 槽位**。外壳的 `AccountMenu` 远不止一张图：它的触发器挂着「设置 / 意见反馈（带服务端上下文预填）/ 退出登录（先查运行中任务再确认）」整个菜单。占据槽位就会把它们全部丢掉。
- **只隐藏按钮内部它自己画的节点**（`> span`、`> svg`），再用 `::before` / `::after` 重绘。菜单是 portal 渲染的，不在按钮内部，因此完全碰不到。
- **样式表用字面量生成**，不依赖 CSS 变量间接或 `<html>` 上的开关。`content: var(--x)` 一旦求值失败就会退化成 `content: normal`——伪元素根本不生成，这正是昵称曾经显示为空白的原因。
- **`corner-shape` 在两种形状下都显式声明**。DSH 的 `corner-shape.css` 把 `corner-shape: var(--dsw-corner-shape)`（`superellipse(1.5)` 方圆角）打在 `*, :before, :after` 上；只写 `border-radius: 50%` 会得到方圆角而不是圆。

## 兼容性

- **皮肤插件**：与 `@smalltailqwq/dsh-client-ui-skin-maid-atelier` 共存（两者同时 active 运行）。已逐条核对皮肤的全部 `:before` / `:after` 规则：**没有一条落在账号入口按钮上**——它的伪元素都打在 `[data-maid-sidebar-footer]`、`[class*=sidebarCol] > div` 和设置按钮（`aria-haspopup=dialog`）上。皮肤样式化的是这个**按钮本身**（背景渐变、尺寸、颜色），本插件只作用于它的 `::before` / `::after`，两者作用在不同的盒子上，互不覆盖。
- 生成规则中只有「隐藏按钮内部自带节点」那条带 `!important`；`content`、`corner-shape`、`background-image` **刻意不加**，以免影响皮肤对按钮与侧栏底部的装饰。
- **DSH 版本**：声明 `>=0.2.0-rc.1`，在 `0.2.0-rc.2` 上完成验证。

## 已知限制

- 只影响**侧栏入口**。设置页账号板块自带的头像仍显示真实账号（它用于标识当前登录的是哪个账号）。
- 依赖外壳的 `settings.launcher` 槽位，以及账号入口按钮的 `aria-haspopup="menu"` 结构。外壳若大改这两处，需要用同样的方式重新定位；届时页面左下角会弹出红色自检提示并列出附近的 `data-slot` 值。
- 昵称与头像存在浏览器 `localStorage`，按来源（origin）隔离。

## License

MIT
