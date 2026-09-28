# ExtendedMemory

[![CI](https://github.com/LeeWikie/ExtendedMemory/actions/workflows/ci.yml/badge.svg)](https://github.com/LeeWikie/ExtendedMemory/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

为 [pi](https://github.com/earendil-works/pi) 提供约 **50k tokens 常驻记忆**。在会话开始时全量注入 `MEMORY/`，由后台微型 Agent 持续整理文件。

记忆从少量泛概念生长为多个维度的文件和目录。后台根据内容的重要性、增长、关联和维护需要决定怎样分类、拆分、合并，并重新归纳父级摘要。

```text
MEMORY/
├── IDENTITY.md
├── MEMORY.md
├── USER.md
└── Recent.md
```

这是 [Basic 初始集合](templates/basic/README.md)，不是固定分类表。例如 `USER.md` 可以发展为 `USER/USER.md` 和下级文件；升级后的同名文件保留综合理解，整个目录的正文仍全量注入。

## 安装

要求 pi **0.87.1 或更新版本**，Node.js **22.19 或更新版本**。

```sh
git clone https://github.com/LeeWikie/ExtendedMemory.git
cd ExtendedMemory
npm install
pi install .
```

重启 pi 后生效。默认正文位于 `~/.extended-memory/MEMORY/`；可用 `EXTENDED_MEMORY_DIR` 指定其他目录。空白初始文件见 [templates/basic/MEMORY](templates/basic/MEMORY)。此项目没有向 npm 发布安装包，`npm:pi-memory` 指向上游项目。

## 工作方式

- **主会话**：开始时递归加载全部 Markdown，保留固定快照。后续轮次、压缩和恢复沿用原快照，新会话读取最新正文。主 Agent 没有记忆工具，也不会加载后台整理 Skill。
- **后台整理**：复用 pi 原生 `Agent` 运行时，独立加载 [Paperclip 整理 Skill](background/skills/para-memory-files/SKILL.md)。仅获得限定在 `MEMORY/` 内的读、搜索、写、局部编辑、建目录、移动、删除和 token 计量工具。
- **直接修改**：文件操作即时生效，没有整目录候选输出、宿主内容校验、审批或发布流程。中断保留已完成的修改，重试先读取实际文件。多文件整理期间开始的新会话可能看到整理过程中的状态。
- **独立上下文**：每个前台会话对应一个私有后台上下文，后续追加新证据和工具结果，重启后恢复。不创建 pi 的常规历史会话。模型或 Skill 配置变化时归档原记录并重新建立上下文。
- **缓存与预算**：请求使用稳定的后台 session ID 和长缓存保留选项；供应商决定实际缓存命中。Agent 用 `memory_tokens` 管理全部正文和注入包装共享的 50k 预算。加载不会静默截断，宿主也不会按预算拒绝文件修改。

后台在每轮结束、压缩前收集新增用户和助手文本；启动时恢复队列并补收当前分支。默认延迟 1.5 秒处理，主对话不等待。退出时取消未完成请求，待下次启动重试；没有退出后常驻的独立进程。失败默认 60 秒后重试。

## Recent 与事实来源

`Recent` 保存近期 session 中用户直接陈述的近况、位置变化、在办事项和短期计划，区分当前、此前、计划及待确认状态。消息原始时间与收集时间分别保留；历史导入时间不能充当事实发生时间。短暂状态标明最后确认时间，晚到的旧消息不覆盖更新的状态，示例或助手猜测不成为用户事实。

整理时按来源会话区分说话者，消解“我”“本机”“此电脑”等指代。采集主机、工作目录和平台只描述采集环境，不能证明历史消息中的设备。依据不足时保留不确定性。

## 配置

默认读取 `~/.extended-memory/config.json`。自定义正文目录时读取其父目录的 `config.json`，也可用 `EXTENDED_MEMORY_CONFIG` 显式指定。

```json
{
  "background": {
    "enabled": true,
    "model": "openai-codex/gpt-6-astra",
    "tokenBudget": 50000,
    "debounceMs": 1500,
    "timeoutMs": 120000
  }
}
```

省略 `model` 时使用启动时的会话模型；指定模型时使用 `provider/model-id`，模型须在 pi 中可用。认证、自定义 provider 和网络路由复用宿主配置。指定模型不可用时记录错误并保留任务，不自动切换。

每次模型调用最多输出 8,192 tokens，同时受模型上限约束；通过多次工具调用处理局部变化，不重新输出整个记忆集合。接近上下文容量时，请求移除完整的早期整理轮次，私有历史记录仍保留。

## 存储与 Git

```text
~/.extended-memory/
├── MEMORY/                    # 会话全量注入的 Markdown 正文
├── MEMORY.state/
│   ├── pending/               # 待处理来源
│   ├── completed/             # 来源、整理结论与实际用量
│   ├── agent-sessions/        # 私有后台上下文
│   └── last-error.json        # 最近一次错误
└── config.json
```

多个进程通过锁串行整理。来源、状态、历史记录和配置不注入主会话。旧版产生的目录版本保留用于升级恢复；新整理不再产生发布记录。历史记录目前不会自动清理。

本仓库用于公开维护插件代码、Skill、模板和测试。个人记忆可由用户放在单独的 **GitHub 私有仓库**：以正文目录的父目录为 Git 根目录，仅跟踪 `MEMORY/`，让 `.git/` 保持在后台 Agent 的文件权限之外。原始聊天导入、凭据、配置和 `MEMORY.state/` 应排除。插件本身不执行 Git 提交或联网同步，后续推送由仓库维护流程负责。

## 开发与验证

```sh
npm ci
npm test
npm run build
npm run lint
```

测试需要 Bun；未全局安装时可运行 `npm exec --yes --package=bun -- npm test`。默认测试包括上游工具回归、会话快照及后台 Agent 测试，使用隔离的临时目录，不需要模型 API key 或 qmd。

设置 `PI_SDK_ROOT` 为本机 `@earendil-works/pi-coding-agent` 包目录后，运行 `node test/resident-loader.mjs` 可检查真实扩展加载器。验证范围与命令见 [验证记录](docs/verification.md)。

## 来源与许可

基于 [jayzeng/pi-memory](https://github.com/jayzeng/pi-memory)，保留上游 Git 历史、MIT 许可和旧入口的回归代码。默认入口已改为目录常驻与后台整理；qmd 不是该入口的依赖。[上游历史文档](docs/upstream-pi-memory.md)、`design.md`、上游 API E2E 和 recall eval 描述的是旧设计。

后台 Skill 基于 Paperclip 的 `para-memory-files`，来源、固定版本及适配差异见 [Paperclip 说明](background/skills/para-memory-files/references/paperclip.md)，原许可随附。项目按 [MIT](LICENSE) 开源。
