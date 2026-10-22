# 老王工作台

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方源码，逐步建设自己的AI工作台。这个仓库先分享实际搭建中沉淀下来的可复用工具，当前第一份是**官方源码桌面安装Skill**。

## 这个Skill用来干什么

把安装手册交给能操作电脑的Agent，让它按照固定版本准备环境、安装依赖和Electron、构建、启动源码桌面，再完成真实使用验收，交付可双击的启动入口。

它整理了本次部署的正确步骤和避坑：保留官方安装流程，区分通用步骤与本机特例，避免反复重装、猜参数和未验收就报成功。适合准备在Windows电脑上，以官方源码作为后续插件开发地基的人。

## 怎么用

把本仓库链接交给Agent，并发送：

```text
读取这个仓库的 skills/deepseek-harness-source-install/SKILL.md，按其中固定版本，在这台Windows x64电脑部署DeepSeek Harness官方源码桌面版。正常步骤直接执行，完成真实验收，交付可双击入口、数据位置和回执；遇到本地登录、合法审批或真实阻塞时说明具体事项，不绕过保护、不假报完成。
```

手册正文：[SKILL.md](skills/deepseek-harness-source-install/SKILL.md)。也可以下载该文件，全文交给Agent执行；支持Skill的工具可将整个技能文件夹安装到其技能目录。

## 当前范围

- 原生Windows x64；固定DeepSeek Harness `0.2.1-rc.2`，提交 `687f282e8625c6b8d11ff58211a90524be2e4317`。
- 开发环境使用Node `22.22.2`、pnpm `11.28.5`；具体准备与核验以Skill为准。
- 验收覆盖桌面打开、模型回复、文件写入回读、审批允许与拒绝、刷新和完整退出重开后的设置与历史。
- 本机源码框架已经实测通过，Skill经过4种新机场景推演；第二台电脑尚未实装验证。模型登录和必要审批需要在目标电脑完成。
- 当前交付源码桌面开发版的安装手册；工作台业务插件和正式Windows安装包尚未发布。

## 许可

本仓库原创文档和Skill采用[MIT许可证](LICENSE)。DeepSeek Harness由其上游仓库维护，使用时遵循上游许可；本仓库为独立实践项目。
