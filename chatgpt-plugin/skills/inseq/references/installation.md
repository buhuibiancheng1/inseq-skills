# 安装 INSEQ Skill

仓库：https://github.com/buhuibiancheng1/inseq-skills

入口：`skills/inseq/SKILL.md`。安装时保留完整的 `skills/inseq/` 目录，使入口中的相对链接可读取。只安装本仓库的接入资料，不下载其他 INSEQ 运行包。

## 豆包工作

在技能管理中选择通过对话创建技能，发送：

```text
新建技能 安装：https://github.com/buhuibiancheng1/inseq-skills
```

让宿主实际读取入口与相关文件。菜单名称和导入方式以当前版本为准；不猜测本机技能目录，不宣称一句话必然完成全部安装、连接和授权。

已有 INSEQ 连接器和有效授权时直接复用。否则由用户在自定义连接器中填写：名称 `INSEQ`，类型 `HTTP`，地址 `https://inseq.zhujunyue.com/mcp`，自定义 Headers 留空，再完成[网页授权](authentication.md)。无需安装 INSEQ 客户端。

## 其他宿主

使用宿主支持的 GitHub Skill 安装方式导入同一技能目录，并添加同一远程 MCP 地址。仓库根目录 `mcp.json` 提供 HTTP 配置示例；不同宿主配置字段可能不同，不自动覆盖已有配置或其他连接器。`agents/openai.yaml` 是可选的宿主元数据，其他宿主可忽略。

宿主不支持读取随附文件时，可以读取该仓库同一路径的 GitHub 原始文件，根地址为 `https://raw.githubusercontent.com/buhuibiancheng1/inseq-skills/main/skills/inseq/`。仍无法读取时说明具体缺少哪个文件，不编造其内容。

## 完成标准

分别确认技能可发现、MCP 工具已加载、账号已授权、只读调用成功。只读检查使用 `inseq_list_projects` 与 `inseq_capabilities`，不创建项目、不采集或生成。空项目列表不等于连接失败。

由用户提供素材后，分别实测自然语言任务和宿主支持的手动指定入口。只报告实际验证过的环节；没有发出工具调用，不能报告“连接测试通过”。
