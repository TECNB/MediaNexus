# 接入登录注册认证

## 背景

MediaNexus 已有 Stitch 还原的登录页和注册页纯界面。MediaNexus-Orchestrator 第一批认证能力提供了注册码注册、登录、登出和当前用户接口，前端需要先完成登录/注册真实提交流程和 Bearer token 注入。

## 范围

- 新增 Java Auth API 封装。
- 新增 auth token 本地存储工具。
- 新增共享 Java API Axios client，并为 Java 后端请求注入 `Authorization: Bearer <token>`。
- 登录页接入 `/api/v1/auth/login`。
- 注册页接入 `/api/v1/auth/register`。
- 注册成功和登录成功都保存 token 并跳转 `/resources`。
- 前端补基础校验：
  - 用户名 3-32 位，小写字母、数字、下划线或短横线。
  - 密码 8-32 位。
  - 注册码必填。
  - 注册确认密码一致。
- 保留现有视觉风格和独立 auth 页面布局。

## 非目标

- 不做业务路由登录墙。
- 不做额度展示。
- 不做用户菜单/登出 UI。
- 不做全局 auth context。
- 不接管理员管理能力。
- 不提交、不推送。

## 验收

- `/login` 和 `/register` 表单可真实调用 Java auth API。
- Java API client 请求会自动带 Bearer token。
- 表单错误、提交中、后端错误都有可见反馈。
- 不影响现有资源、磁力、字幕页面的 Python API 调用。
