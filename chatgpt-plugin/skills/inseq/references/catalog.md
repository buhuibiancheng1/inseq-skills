# 完整功能目录

当前接入范围为 82 项能力：76 个用户入口及 6 项内部协作能力。编号沿用原目录，不顺延；已删除或合并的编号留空。表中只说明用途和输入，不包含服务实现。

使用名称或标识定位 `inseq_search_skills` / `inseq_get_skill`，按实际公开参数调用 `inseq_run_skill`；提取、主页分析、画像创建及改写优先使用各自直接入口。不要仅凭目录存在声称任务已完成，实际执行和缺项以服务回执及当前 Agent 能力为准。

## 发现类

| 编号 | 功能 | 标识 | 用户提供或复用的输入 |
| --- | --- | --- | --- |
| 01 | 机会雷达与深度研究 | `opportunity-research` | 行业或观众问题、平台与研究范围 |
| 02 | 算法规则追踪 | `skill-algorithm-updates` | 平台与需要核对的规则 |
| 03 | 对标作品分析 | `skill-competitor-analysis` | 指定作品链接或素材、分析要求 |
| 04 | 内容空白分析 | `skill-content-gap-analysis` | 行业、已有内容与研究范围 |
| 07 | 行业情报 | `skill-news-intelligence` | 行业关键词与来源范围 |
| 08 | RSS 订阅 | `skill-rss-aggregator` | 订阅源与本次操作 |

## 策划类

| 编号 | 功能 | 标识 | 用户提供或复用的输入 |
| --- | --- | --- | --- |
| 11 | 对标账号分析 | `skill-account-diagnosis` | 账号主页链接、渠道与分析要求 |
| 12 | 长文大纲 | `skill-article-outline` | 主题、读者与文章要求 |
| 13 | 受众画像 | `skill-audience-profiler` | 账号资料或真实受众样本 |
| 15 | 活动策划 | `skill-campaign-planner` | 活动目标、产品与约束 |
| 16 | 轮播规划 | `skill-carousel-planner` | 主题、素材与轮播要求 |
| 18 | 内容日历与排期 | `skill-content-calendar` | 内容计划、节点与排期要求 |
| 19 | 选题矩阵 | `skill-content-matrix` | 画像、内容目标与范围 |
| 20 | 内容策略 | `skill-content-strategy` | 画像、实际资源与内容目标 |
| 21 | 开头钩子 | `skill-hook-generator` | 主题、原稿与开头要求 |
| 22 | 直播方案 | `skill-livestream` | 直播主题、内容与时长要求 |
| 24 | 选题评估 | `skill-topic-evaluator` | 待评估选题及账号背景 |
| 25 | 蹭热点方案 | `skill-trend-rider` | 热点来源与账号创作要求 |

## 制作类

| 编号 | 功能 | 标识 | 用户提供或复用的输入 |
| --- | --- | --- | --- |
| 27 | AI 生图 | `ai-image-gen` | 图片要求及可选参考素材 |
| 28 | BGM / 音乐生成 | `ai-music` | 音乐要求及可选歌词 |
| 29 | AI 视频生成 | `ai-video-gen` | 提示词、规格、参考素材及本次报价授权 |
| 30 | 降噪 | `audio-denoise` | 音频素材与降噪要求 |
| 31 | 音频剪辑 | `audio-editing` | 音频素材与剪辑要求 |
| 33 | 音频可视化 | `audio-visualizer` | 音频素材及画面要求 |
| 34 | 一句话出片 | `auto-short-video` | 出片要求、素材与目标规格 |
| 35 | 自动字幕 | `auto-subtitle` | 音视频素材与字幕要求 |
| 36 | 卡点视频 | `beat-sync-video` | 素材、音乐与节奏要求 |
| 39 | 图文卡片制作 | `card-xiaohongshu` | 文案、素材与卡片要求 |
| 40 | 图表与信息图 | `chart-visualization` | 真实数据或结构化信息、表达要求 |
| 41 | 长片切片 | `clipify` | 长片素材与切片要求 |
| 42 | 对比图 / 一图流 | `comparison-card` | 比较内容、证据与版式要求 |
| 43 | 营销 / 带货文案 | `copywriting` | 产品事实、受众与文案要求 |
| 44 | 数据报告页 | `data-report` | 真实数据与报告要求 |
| 45 | 文稿转 PDF / 长图 | `doc-convert` | 文稿、版式与输出格式 |
| 46 | 电商详情图 | `ecom-details-image` | 商品事实、素材与图片要求 |
| 47 | 绿幕合成 | `green-screen` | 前景视频、背景素材与合成要求 |
| 48 | 公众号排版 | `gzh-design` | 文章、素材与排版要求 |
| 49 | 图像处理 | `image-editing` | 图片素材与处理要求 |
| 52 | Vibe 知识动画 | `knowledge-animation` | 知识内容、素材与动画要求 |
| 53 | 思维导图 | `mindmap` | 主题或正文及结构要求 |
| 55 | 小说连载 | `novel-writer` | 设定、已有章节与续写要求 |
| 56 | 社媒帖子成稿 | `post-formatter` | 平台、主题与成稿要求 |
| 57 | 竖版海报 | `poster-hero` | 主题、文字、素材与尺寸要求 |
| 58 | 抠图换背景 | `remove-bg` | 图片素材与背景要求 |
| 59 | AI 微短剧 | `short-drama` | 剧情、人物素材与目标规格 |
| 60 | 评论运营 | `skill-community-ops` | 真实评论与回复要求 |
| 61 | 跨平台内容策划与改编 | `skill-content-repurposing` | 原内容、目标平台与改编要求 |
| 69 | 通用社媒文案 | `social-content` | 主题或原文、创作要求 |
| 70 | 文案风格迁移 | `style-transfer` | 原文、风格要求及改写依据 |
| 71 | 字幕翻译 | `subtitle-translate` | 原字幕、真实时间及目标语言 |
| 72 | 摘要 / 金句提取 | `text-condenser` | 原文与摘要要求 |
| 73 | 润色 / 去AI味 | `text-polisher` | 原文与润色要求 |
| 75 | 章节 / 时间戳 | `video-chapters` | 音视频及真实时间信息 |
| 79 | 原片包装与成片 | `video-production` | 原片、素材与成片要求 |
| 81 | 视频脚本 | `video-script` | 主题、账号背景与脚本要求 |
| 82 | 视频策略选型 | `video-strategy` | 账号资源、目标与视频要求 |
| 83 | 视频转图文 | `video-to-article` | 视频链接或素材、图文要求 |
| 84 | 声音克隆与配音 | `voice-clone` | 文字、可用音色或已获授权的声音素材 |
| 85 | 小红书图文总入口 | `xhs-note-creator` | 主题、文字、素材与图文要求 |

## 归因类

| 编号 | 功能 | 标识 | 用户提供或复用的输入 |
| --- | --- | --- | --- |
| 86 | ROI 计算 | `roi-calculator` | 真实投入、收益及计算范围 |
| 87 | 评论洞察 | `skill-comment-insights` | 真实评论样本与分析问题 |
| 88 | 内容日历底座 | `skill-content-calendar-log` | 当前项目日历记录与操作 |
| 89 | 爆款复盘 | `skill-content-postmortem` | 真实作品、表现数据与复盘问题 |
| 90 | 数据追踪 | `skill-data-tracker` | 真实指标记录与追踪范围 |
| 91 | 互动潜力评分 | `skill-post-scorer` | 待评估作品及已知证据 |
| 92 | 内容效果分析 | `skill-publish-analytics` | 内容表现数据与分析范围 |
| 93 | 作品记录 | `skill-publish-log` | 实际作品记录与操作 |
| 94 | 月度复盘 | `skill-social-performance-review` | 本月内容及表现数据 |
| 95 | 策略迭代 | `skill-strategy-advisor` | 已有策略、真实结果与调整目标 |
| 96 | 小红书分析 | `skill-xhs-analyzer` | 小红书账号或内容来源、分析要求 |

## 通用类

| 编号 | 功能 | 标识 | 用户提供或复用的输入 |
| --- | --- | --- | --- |
| 97 | 产物管理 | `asset-manager` | 当前项目素材或成果、操作要求 |
| 98 | 批量处理 | `batch-process` | 明确的一组素材与处理要求 |
| 99 | 账号查询 | `skill-my-account` | 渠道与账号查询条件 |
| 100 | 画像构建 | `skill-profile-builder` | 名称、渠道、主页链接及本次可选业务资料 |
| 101 | 画像管理 | `skill-profile-manager` | 指定画像与查看或修改要求 |
| 102 | 模板库 | `template-library` | 当前项目模板及管理要求 |

## 内部协作能力

以下 6 项继续用于相关任务，不新增独立用户入口。

| 编号 | 能力 | 标识 | 配合任务 |
| --- | --- | --- | --- |
| 37 | 卡片视觉系统 | `card-design` | 关联图文任务的视觉要求 |
| 50 | 图像增强 | `image-enhance` | 关联图片任务的增强要求 |
| 62 | 人设一致性 | `skill-persona-check` | 当前作品与选定画像 |
| 63 | 交付检查 | `skill-publish-checklist` | 待交付内容与本次要求 |
| 64 | 质量关 | `skill-quality-gate` | 实际成果及用户验收要求 |
| 80 | 画幅转换 | `video-reframe` | 关联视频任务的目标画幅 |

## 使用范围

所有原有功能均从同一个 INSEQ Skill 路由，用户无需逐项安装。服务要求由当前 Agent 完成的创作、推理或原视频读取，必须实际完成并保存；云端制作必须取得真实产物。缺少服务、素材权限或宿主能力时如实说明，不能将返回说明当作成品。

每次视频生成仍需本次报价与用户本人明确确认；保留素材许可、数据来源、项目权限及人工修改保护。能力自动发现不扩大授权范围。
