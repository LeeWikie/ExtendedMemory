# ExtendedMemory

面向 [pi](https://github.com/earendil-works/pi) 用户的常驻 Markdown 记忆扩展：在会话开始时全量注入约 50k tokens 预算内的 `MEMORY/` 目录，同时由独立的后台 Agent 异步整理对话证据，避免主对话承担记忆工具调用开销或破坏前缀缓存。

> **Summary (English):** ExtendedMemory is a resident Markdown memory extension for the [pi](https://github.com/earendil-works/pi) coding agent. It injects the full `MEMORY/` tree as a fixed per-session snapshot at startup (~50k token shared budget) while a private background pi `Agent` organizes new conversation turns asynchronously using 9 filesystem-scoped tools—keeping foreground sessions tool-free and prompt-prefix stable.

记忆从少量泛概念文件起步，由后台 Agent 根据内容的重要性、增长、关联与维护成本自行决定拆分、建目录、合并和重新归纳父级摘要：

```text
MEMORY/
├── IDENTITY.md
├── MEMORY.md
├── USER.md
└── Recent.md
```

上述为 [Basic 初始集合](templates/basic/README.md)，而非固定分类表。例如 `USER.md` 可以演化为 `USER/USER.md` 及下级文件；升级后的同名文件保留综合理解，整个目录内的 Markdown 仍全量注入。

## 安装与使用

环境要求：pi **>= 0.87.1**，Node.js **>= 22.19.0**。

```sh
git clone https://github.com/LeeWikie/ExtendedMemory.git
cd ExtendedMemory
npm install
pi install .
```

重启 pi 后生效。

- 默认记忆目录为 `~/.extended-memory/MEMORY/`，可通过环境变量 `EXTENDED_MEMORY_DIR` 覆盖。
- 空白初始模板见 [templates/basic/MEMORY](templates/basic/MEMORY)，首次使用可直接复制到目标 `MEMORY/` 目录。
- 本仓库未发布到 npm；`npm:pi-memory` 指向上游项目。

## 架构与工程设计

默认入口位于 `index.ts`（`registerExtendedMemory`），单文件实现、无构建步骤，由 pi 直接加载 TypeScript。核心设计如下：

- **前景快照稳定与零工具暴露**（`index.ts`：`readResidentMemory`、`registerExtendedMemory`）：在 `session_start` 时递归读取 `MEMORY/**/*.md` 并包装为 `<extended_memory>` 注入系统提示词，同时写入会话自定义条目 `extended-memory-snapshot`。同一会话的后续轮次、压缩和恢复均沿用该快照，新会话读取最新磁盘正文。主会话不注册任何记忆工具，也不加载后台整理 Skill。
- **复用原生 Agent 运行时**（`index.ts`：`runMemoryAgent`、`createBackgroundStream`）：后台整理直接复用 `@earendil-works/pi-agent-core` 的 `Agent`，顺序执行工具调用（`toolExecution: "sequential"`），独立加载 [Paperclip 整理 Skill](background/skills/para-memory-files/SKILL.md)。请求配置 `cacheRetention: "long"`、`reasoningEffort: "low"` 与单次输出上限 `min(model.maxTokens, 8192)`，使用稳定的后台 `cacheKey` 提升供应商前缀缓存命中机会（实际命中由供应商决定）。
- **受限文件系统工具与安全边界**（`index.ts`：`createMemoryTools`）：后台 Agent 仅获得限定在 `MEMORY/` 内的 9 个工具——`memory_list`、`memory_read`、`memory_search`、`memory_write`、`memory_edit`、`memory_mkdir`、`memory_move`、`memory_remove`、`memory_tokens`（基于 `js-tiktoken` 的 `o200k_base` 计量含包装标签的完整注入载荷）。路径校验拒绝路径穿越、控制字符、Windows 保留名与 ADS、符号链接与硬链接（`nlink > 1`），每次操作重验 `realpathSync(root)`，并通过临时文件 + 重命名完成单文件原子写入。
- **直接落盘与中断恢复**（`index.ts`：`createMemoryOrganizer`、`runMemoryAgent`）：文件修改即时生效，不设整目录候选输出、宿主内容校验或发布门禁。每个前台会话对应一份持久化私有后台上下文（`MEMORY.state/agent-sessions/`），模型或 Skill 签名变化时自动归档至 `agent-archive/` 并重建。若整理中途中断，未完成的工具调用在恢复时会被补全为错误结果并提示 Agent 先重读实时文件。
- **异步队列、并发锁与上下文裁剪**（`index.ts`：`createMemoryOrganizer`）：在 `session_start`、`agent_end`、`session_before_compact` 和 `session_shutdown` 收集增量文本，按 32,000 字符分批并基于内容哈希去重；默认防抖 1.5 秒、单任务超时 120 秒、失败 60 秒后重试。多进程通过 `worker.lock`（PID 检测）串行整理。当后台对话上下文超过模型窗口 70% 时，`transformContext` 按完整早期轮次裁剪请求上下文，同时保留本地私有历史文件。
- **Recent 与事实来源区分**（`index.ts`：`MemorySource`、`MemoryCollectionContext`）：`Recent.md` 记录近期用户直接陈述的近况、位置变化、在办事项与短期计划，区分当前、此前、计划与待确认状态。原始消息时间（`timestamp`）与采集时间（`capturedAt`）分离保存，采集主机、工作目录和平台信息仅描述采集环境，不作为历史消息设备归属的证明。

## 配置

默认读取 `~/.extended-memory/config.json`；自定义 `MEMORY/` 路径时读取其父目录下的 `config.json`，也可用 `EXTENDED_MEMORY_CONFIG` 显式指定。

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

- 省略 `model` 时沿用当前会话模型；指定时使用 `provider/model-id` 格式，认证、自定义 provider 与网络路由复用 pi 宿主配置。指定模型不可用时写入 `last-error.json` 并保留待处理任务，不自动回退。
- `tokenBudget`、`debounceMs`、`timeoutMs` 会在启动时做合法性校验。

## 存储与 Git 管理

```text
~/.extended-memory/
├── MEMORY/                    # 会话全量注入的 Markdown 正文
├── MEMORY.state/
│   ├── pending/               # 待处理的增量对话来源
│   ├── completed/             # 已完成来源、整理摘要与实际 token 用量
│   ├── seen/                  # 按会话记录的已采集消息 ID
│   ├── agent-sessions/        # 私有后台 Agent 上下文
│   ├── agent-archive/         # 模型或 Skill 变更后的归档上下文
│   ├── worker.lock            # 跨进程串行整理锁
│   └── last-error.json        # 最近一次后台错误
└── config.json
```

`MEMORY.state/` 与 `config.json` 不会注入主会话。建议将个人记忆放在独立的 **GitHub 私有仓库**：以 `MEMORY/` 的父目录为 Git 根目录，仅跟踪 `MEMORY/`，排除 `MEMORY.state/`、`config.json`、原始导入与凭据，使 `.git/` 始终处于后台 Agent 的文件权限之外。插件本身不执行 Git 提交或联网同步。

## 验证与测试

```sh
npm ci
npm test
npm run build
npm run lint
```

- `npm test` 运行 198 个 Bun 测试（`test/unit.test.ts` 与 `test/resident.test.ts`）以及 5 个 Node 后台回归脚本（`npm run test:background`，涵盖 `test/memory-agent.test.mjs`、`test/memory-filesystem.test.mjs`、`test/background.test.mjs`、`test/background-lifecycle.test.mjs`、`test/recent.test.mjs`）。全部使用隔离临时目录与 mock stream，不需要模型 API key 或 qmd。
- 未全局安装 Bun 时可使用：`npm exec --yes --package=bun -- npm test`。
- `npm run build` 执行 `tsc -p tsconfig.json --noEmit` 类型检查；`npm run lint` 执行 Biome 检查。
- **真实加载器检查**：设置 `PI_SDK_ROOT` 指向本机 `@earendil-works/pi-coding-agent` 包目录后，运行 `node test/resident-loader.mjs` 验证 pi 实际扩展加载路径。
- **CI**：[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 `ubuntu-latest` 运行 lint + build + unit tests，在 `windows-latest` 运行 unit tests。详细验证范围见 [docs/verification.md](docs/verification.md)。
- `npm run test:e2e` 与 `npm run test:eval` 为上游旧入口（`registerLegacyMemory`）的历史验证脚本，不作为当前默认入口的 CI 检查。

## 当前状态与已知限制

- **无退出后常驻进程**：pi 退出时取消未完成的后台请求，未处理任务保留在 `pending/` 中，待下次启动恢复。
- **并发读取可见性**：后台直接修改实时文件，多文件整理过程中启动的新会话可能读取到中间状态。
- **软预算约束**：50k token 预算由后台 Agent 通过 `memory_tokens` 自主控制，加载器不会静默截断，宿主也不会因超预算拒绝写入。
- **历史状态不自动清理**：`MEMORY.state/completed/`、`agent-sessions/` 与 `agent-archive/` 目前不会自动清理，需按需手动维护。
- **遗留代码保留**：`index.ts` 中保留了上游的 `registerLegacyMemory` 及对应单元测试，默认入口不注册，也不依赖 qmd。

## 来源、许可与联系

- 基于 [jayzeng/pi-memory](https://github.com/jayzeng/pi-memory)，保留上游 Git 历史、MIT 许可与旧入口回归测试；旧设计见 [docs/upstream-pi-memory.md](docs/upstream-pi-memory.md) 与 `design.md`。
- 后台 Skill 基于 Paperclip 的 `para-memory-files`，来源、固定版本及适配差异见 [background/skills/para-memory-files/references/paperclip.md](background/skills/para-memory-files/references/paperclip.md)，原许可随附。
- 开源协议：[MIT](LICENSE)。
- 联系方式：me@neryc.net
