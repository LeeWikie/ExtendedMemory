# Basic

ExtendedMemory 的初始记忆文件集合，以 IDENTITY、MEMORY、USER 三个泛概念作为起点，并保留负责时效性记忆的 Recent。

`MEMORY/` 下的文件共同承载约 50k tokens 的常驻记忆，在会话开始时全量注入，由后台记忆处理模型维护。

```text
MEMORY/
├── IDENTITY.md
├── MEMORY.md
├── USER.md
└── Recent.md
```

| 文件 | 范围 |
| --- | --- |
| `IDENTITY.md` | 关于助手自身的身份、定位与自我认知。 |
| `MEMORY.md` | 交流与经历中积累、值得延续的记忆。 |
| `USER.md` | 关于用户的综合理解。 |
| `Recent.md` | 近期直接陈述的近况、位置、在办事项和短期计划，保留时间与状态。 |

每个文件内部保留自由归纳空间。`MEMORY/` 是整个记忆集合的目录，目录内的 `MEMORY.md` 是其中一个初始文件。

后续的拆分、目录新建及重新归纳交由记忆处理模型决定。本集合不预设细分文件、固定子栏目、强制拆分阈值或各文件的容量配额。

Recent 也可生长为 `Recent/Recent.md` 和下级文件。整理时区分已确认当前状态、先前背景和未来计划；临时状态标明最后确认时间，过时而未获确认的状态不得继续写成“现在”。历史消息使用其原始时间，示例和模型猜测不属于用户事实。

整理方案采用 Paperclip 的 `para-memory-files`，适配为项目内的[后台整理 Skill](../../background/skills/para-memory-files/SKILL.md)。以实体反复出现、直接关系、重要性和内容增长作为组织判断的信号；分类从实际记忆中形成。文件升级为目录时，重新归纳父级摘要和下级内容。

`MEMORY/` 保存全量注入的常驻正文，整个目录共享约 50k tokens，包括 Recent。后台整理规则、来源记录和旧版本不放进这个目录；当前会话使用启动时的完整快照，后台直接修改后的正文供后续新会话读取。

文件内仅有标题和简短范围说明，不包含个人资料或示例记忆。此 README 位于 `MEMORY/` 外，用于说明模板设计。

当前默认入口已接入 pi 原生后台 Agent、专用整理 Skill、持久队列、受限文件工具和会话快照注入，不设候选版本校验或发布环节。Paperclip 的来源、许可及本项目适配见[说明](../../background/skills/para-memory-files/references/paperclip.md)。
