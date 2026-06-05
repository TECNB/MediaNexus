# 登录注册纯界面

## 背景

MediaNexus 需要补齐登录页与注册页的前端界面。设计来源为 Stitch 项目 `家庭媒体中心` 中的两个 screen：

- `MediaNexus 登录页`
- `MediaNexus 注册页`

本次仅实现静态前端界面与必要的本地 UI 状态，不接入真实登录、注册、鉴权、验证码、注册码校验或后端 API。

## 范围

- 新增 `/login` 登录页。
- 新增 `/register` 注册页。
- 两个页面不使用后台 `AdminLayout`，保持独立居中 auth 布局。
- 保留 MediaNexus 品牌、极简单栏表单、浅色表面、安静输入框、黑色渐变主按钮、底部 `Private Access` 文案。
- 登录页包含邮箱或用户名、密码、记住我、忘记密码、跳转注册入口。
- 注册页包含邮箱、用户名、密码、确认密码、注册码、跳转登录入口。
- 使用项目已有 React、React Router、Tailwind、lucide-react 和本地 UI 习惯实现。

## 非目标

- 不新增 API 调用。
- 不新增全局鉴权状态。
- 不新增路由保护。
- 不修改现有后台页面行为。
- 不运行全项目 build、lint、typecheck 或 test。

## 验收

- `/login` 和 `/register` 可独立访问。
- 页面视觉与 Stitch 导出的登录/注册页主要结构一致。
- 表单提交不会触发网络请求。
- 页面在移动与桌面宽度下不出现明显文本溢出或布局重叠。
