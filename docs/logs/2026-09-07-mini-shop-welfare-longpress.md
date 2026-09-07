# 2026-09-07 「更多福利」改为整页海报（长按识别）

## 背景
「更多福利」入口指向**合作方小程序**（非同一主体，微信禁止直接跨小程序跳转）。此前用**弹窗**展示小程序码海报，但合作方海报里小程序码占比太小，长按整图识别不到。经讨论改为：**点击「更多福利」直接跳转一个全屏海报页，整页一张海报占满屏**，用户长按即可识别图中小程序码。

> 说明：目标海报里的小程序码需足够大（占满屏后清晰可见），微信长按才能稳定识别。

## 根因（实测确认：不是码太小）
用今华有肽自己的推广海报（大码）测试确认，识别不出的真正原因是：
1. **`<image>` 的 `show-menu-by-longpress` 默认是 `false`**（[uni-app image 文档](https://uniapp.dcloud.io/component/image)，微信小程序 2.7.0+），即默认**不开启**"长按图片显示识别小程序码菜单"。必须显式设置。
2. 此前给海报 `<image>` 绑定了 `@click="savePoster"`，点一下/长按松手都触发保存，进一步拦截了微信原生长按识别。

## 修复（`pages/promo/welfare-poster.vue`）
- 海报 `<image>` 移除 `@click="savePoster"`，改为纯展示。
- 显式加 `:show-menu-by-longpress="true"`，开启微信长按识别小程序码菜单（菜单内自带"识别小程序码/保存图片"）。
- 删除 `savePoster` 方法（不再点击保存，长按菜单已含保存）。

> 注：项目中其它展示含小程序码海报的 `<image>`（如推广页/商品素材海报）若也希望长按识别，同样需要加 `:show-menu-by-longpress="true"`。

## 说明
- 长按识别是微信客户端对 `<image>` 渲染的合法小程序码的原生行为，无需 `@longpress`、无需隐私声明。
- 需 HBuilderX 重新编译并在**真机/微信预览**验证长按识别（H5 预览无此能力）。
- 海报仍来自后端 `welfareMiniProgramQrUrl` 配置；若为空，整页显示"暂未配置"占位。

## 提交
- `git add` 后提交 `pages/promo/welfare-poster.vue`、`pages/index/index.vue`、`api/homepage.ts`、`pages.json`。
