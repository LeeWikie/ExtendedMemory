# Paperclip 来源与适配

本 Skill 以 Paperclip 主仓库的 `para-memory-files` 为基础，适配 ExtendedMemory 已确定的常驻记忆模型。

## 来源

- 仓库：[paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- 固定版本：`953b315dfb338599bd1b27910cec650423f51acd`
- [原始 SKILL.md](https://github.com/paperclipai/paperclip/blob/953b315dfb338599bd1b27910cec650423f51acd/skills/para-memory-files/SKILL.md)
- [原始事实结构与衰减规则](https://github.com/paperclipai/paperclip/blob/953b315dfb338599bd1b27910cec650423f51acd/skills/para-memory-files/references/schemas.md)
- 许可：MIT；原始版权及许可全文保留在 [LICENSE](../LICENSE)。

## 采用的做法

从对话中提炼事实，为值得独立维护的实体建立目录，以有效事实重写综合摘要。新状态替代旧状态时保留可追溯的变化关系。定期检查归纳与过时内容，让持续有价值的材料获得更多篇幅。

## 为本项目作出的适配

| 上游做法 | ExtendedMemory 的选择 |
| --- | --- |
| 顶层固定为 Projects / Areas / Resources / Archives | 从 `IDENTITY.md`、`MEMORY.md`、`USER.md` 与时效性正文 `Recent.md` 开始，下级分类由记忆处理模型归纳 |
| 实体满足出现三次、直接关系或重要性条件时新建目录 | 将这些条件作为组织判断的信号；模型同时考虑内容规模、边界和维护价值，选择段落、文件或目录 |
| 实体目录包含 `summary.md` 和 `items.yaml` | 常驻正文统一使用 Markdown；升级后的同名文件负责综合摘要，下级文件承载具体内容，不额外维护一份会重复注入的 YAML 事实副本 |
| Agent 写入记忆并通过 qmd 检索详情 | 后台模型整理，主 Agent 在会话开始时获得整个常驻目录的完整内容 |
| 原始时间线和被替代的事实继续保留 | 原始对话、整理记录和旧版本作为后台追溯依据；当前有效记忆在 `MEMORY/` 正文中可直接理解 |
| 按访问次数及 7 / 30 天分层调整摘要 | 使用有依据的出现、使用与时效信号，不将注入次数当作使用次数，也不按天数自动抹去持续有效的记忆 |
| 详情可以长期留在按需检索层 | 整个常驻集合共享约 50k tokens；由后台显式完成篇幅分配与压缩，不能让主 Agent 依赖未注入详情 |
| 原始事实带时间与状态、旧事实可被替代 | Recent 优先保存近期用户直接陈述，并按原始时间与当前时间判断当前、此前、计划和待确认状态 |

这些适配属于本项目的设计，并非 Paperclip 对动态递归目录、Recent 或 50k 全量注入的原生支持。上游的“三次”和周度重写提供初始实践参考，不是经过本项目评测的最优阈值。

## 接入状态

ExtendedMemory 默认入口使用 pi 自带的 Agent 在后台异步整理，按来源会话保留私有上下文；本 Skill 专供该 Agent 使用。Agent 通过限定在 MEMORY 内的文件工具直接整理文件，自行使用 tokenizer 工具管理总预算。运行时只负责调度、权限边界、来源记录和主会话快照注入，不校验候选内容或发布目录版本。
