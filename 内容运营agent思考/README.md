# AfterMeet Knowledge Base

AfterMeet 是一个自用的本地素材入口，用来把“会议/活动/内容素材”交给 Codex 处理：

- `index.html`：知识库主页，左侧 01-09 是全局模块总览，顶部是当前模块内工作流；
- `inbox.html`：素材输入分页，支持拖入照片、录音、截图、文本和文档；
- 自动分类素材类型，导入时立即预览；
- `local-bridge.mjs`：本地 bridge，把网页里的素材包保存到 `codex-inbox/`；
- Codex 读取保存后的素材包，负责识别图片、音频、视频和文本，并生成报告；
- 支持导出 Markdown 知识包。

## 本地使用

先启动本地 bridge：

```bash
node local-bridge.mjs
```

再启动网页服务：

```bash
python3 -m http.server 5173
```

访问：

```text
http://localhost:5173/
http://localhost:5173/inbox.html
```

网页点击“交给 Codex 一键总结”后，会生成：

```text
codex-inbox/aftermeet-<timestamp>/
  manifest.json
  prompt.md
  materials/
```

然后回到 Codex，让 Codex 读取该目录并生成 `report.md`。

## 当前边界

- 浏览器端可以预览图片、音频、视频、PDF、文本，并读取文本文件内容；
- 视频会在前端抽取最多 12 张画面帧，和原始视频一起保存；
- 本地 bridge 流程会把材料保存到 `codex-inbox/`，再由 Codex 在本地工作区完成识别和总结；
- `/api/analyze` 后端接口也支持直接识别：图片默认上限 64MB，音视频默认上限 200MB；
- 本地开发时可用 `AFTERMEET_IMAGE_LIMIT_MB` 和 `AFTERMEET_TRANSCRIPTION_LIMIT_MB` 继续调大识别上限。
