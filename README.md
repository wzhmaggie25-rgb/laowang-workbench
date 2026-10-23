# 老王工作台 · Skill合集

把我实际做过的事，沉淀成别人拿走就能用的Skill。**一个Skill解决一个明确问题，持续新增。**

## Skill目录

| Skill | 用来做什么 | 使用手册 |
|---|---|---|
| DeepSeek Harness源码部署 | 让Agent在Windows x64准备官方源码桌面开发环境，完成安装、构建、启动和真实验收 | [SKILL.md](skills/deepseek-harness-source-install/SKILL.md) |

DeepSeek Harness源码部署是本仓库的第一个Skill，整理了本次实际部署的步骤和避坑。后续Skill统一加入上表，每个Skill保存在独立目录。

## 插件

除Skill外，仓库里还带DeepSeek Harness插件源码——插件是代码，不是给Agent读的流程文档，所以单独放`plugins/`。

| 插件 | 用来做什么 | 说明 |
|---|---|---|
| [dsh-plugin-publish](plugins/dsh-publish/README.md) | 一个插件管住所有平台发布：唯一发布入口、人工审批门禁、回执台账 | **v0.1骨架，未跑过真实发布**；上传交给[xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp)和[social-auto-upload](https://github.com/dreammis/social-auto-upload)，插件只做编排 |

插件按Cordis协议写（`name`/`inject`/`apply`），注册4个工具：`publish_accounts`、`publish_prepare`、`publish_submit`、`publish_status`。加平台只加适配器，不加工具。

安装、配置、停用和已知边界都写在插件自己的[README](plugins/dsh-publish/README.md)里；自己装、自己测。装之前注意两点：插件目录要放进DSH源码仓库内（peer依赖靠仓库`node_modules`解析，放外面会`ERR_MODULE_NOT_FOUND`），`cordis.patch.yml`里的`<占位符>`要换成绝对路径。

## 怎么用

选择需要的Skill，让Agent读取对应的`SKILL.md`并执行；支持Skill的工具可安装整个技能文件夹。

例如，要部署DeepSeek Harness，把本仓库链接交给能操作电脑的Agent，并发送：

```text
读取这个仓库的 skills/deepseek-harness-source-install/SKILL.md，按其中固定版本，在这台Windows x64电脑部署DeepSeek Harness官方源码桌面版。正常步骤直接执行，完成真实验收，交付可双击入口、数据位置和回执；遇到本地登录、合法审批或真实阻塞时说明具体事项，不绕过保护、不假报完成。
```

## 目录结构

```text
skills/
└── deepseek-harness-source-install/
    └── SKILL.md
plugins/
└── dsh-publish/
    ├── README.md
    ├── src/
    ├── scripts/
    ├── tests/
    └── cordis.patch.yml
```

每个Skill的适用环境、固定版本、操作步骤和验收要求，写在各自的手册中。

当前第一个安装Skill基于本机已通过的源码框架验收，经过4种新机场景推演；第二台电脑尚未实装验证。

## 许可

本仓库原创文档和Skill采用[MIT许可证](LICENSE)。Skill涉及的第三方项目遵循各自上游许可。
