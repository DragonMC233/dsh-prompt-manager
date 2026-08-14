# dsh-prompt-manager

查看、Hook、替换和切换 DeepSeek Harness 系统提示词的 DSH 插件（Cordis bundle，双半插件）。

- **查看**：实时列出当前实际生效的提示词段（name/text）、动态上下文、工具与变量，并可预览渲染后的完整系统提示词。
- **Hook / 替换**：在官方 `system-prompt/assemble` waterfall 末尾按 preset 规则改写组装结果（replace / insert / remove），返回值权威，对所有作用域生效。
- **切换**：多套 preset（提示词方案）按需切换，下一个模型步骤立即生效；支持文件热重载。
- **双入口**：Web 设置页「提示词管理」tab + agent 工具（`switch_prompt` / `list_prompts` / `get_prompt` / `save_prompt`）。

## 安装

```sh
# 从源码目录（本包声明了 dsh.bundle）
dsh plugin --profile web add /path/to/dsh-prompt-manager
# 或发布到 npm 后
dsh plugin --profile web add dsh-prompt-manager
```

配置树会在下次启动时叠加该 bundle 的 patch（`cordis.patch.yml`），挂载 `prompt-manager` 行。开发期也可用 `--patch` 覆盖层本地加载。

> 注意：`link:` 方式安装（`pnpm add <本地路径>`）时，Node 从包的真实目录解析依赖。若运行环境无法解析 `@deepseek-ai/*` 与 `js-yaml`，在包目录内放置指向 DSH 安装 `node_modules` 的符号链接（`ln -s <dsh安装>/node_modules ./node_modules`）。发布到 npm 后由 pnpm 安装真实依赖，无需此步。

## 用法

### Web GUI

设置 → 「提示词管理」：

- **预设方案**：新建 / 设为当前 / 停用 / 编辑（YAML）/ 删除。
- **当前生效的提示词段**：分段查看或查看渲染后的完整系统提示词。

### 工具（agent 可见）

| 工具 | 说明 |
|---|---|
| `switch_prompt` | 切换 active preset 或停用（`off: true`） |
| `list_prompts` | 列出预设、active 与当前提示词段 |
| `get_prompt` | 读取指定 section 的当前文本（如 `deployment:persona`） |
| `save_prompt` | 把当前 section 文本固化为某 preset 的 replace 规则 |

### 文件布局

```
# 内置预设（随插件分发，只读）——目录可为空，放入的 yml 即为内置示例
<插件安装目录>/dsh-prompt-manager/presets/

# 个性化预设（用户数据，可编辑/删除）
$DSH_HOME/prompts/
├── active.yml        # active: <preset>（null = 不启用）
├── creative.yml      # 示例：创意写作风格（可编辑/删除）
└── <preset>.yml      # 每个预设一个文件（label / description / overrides）
```

个性化预设默认不启用；同名时个性化预设覆盖内置预设。内置预设只读（编辑按钮为"另存为个性化"，删除/改写 API 拒绝）。

预设 YAML 格式：

```yaml
label: 创作模式
description: 面向创意写作的提示词集
overrides:
  - action: replace          # replace | insert | remove
    section: deployment:persona
    text: |
      你是一位创意写作助手……
  - action: insert
    section: creative:guidance
    after: tools:guidance    # 可选：插入到该段之后；缺省追加到末尾
    text: |
      写作流程建议……
  - action: remove
    section: plan-mode:prompt
```

替换文本中的 `{{variable}}`（如 `{{provider}}` `{{model}}` `{{cwd}}`）保留给渲染阶段正常插值。

## 限制与已知行为

- **complete 段**：某作用域存在 `complete: true` 段时，注册表会在 waterfall 之后把它还原为唯一提示词段，preset 对 sections 的改写不会生效（v1 不处理，界面与文档会标注）。
- **insert 排序**：组装后的 section 不带数值 order；新插入段默认追加到末尾（`after:` 可指定相对位置）。
- **作用域**：preset 作用于全局组装（所有会话）；per-agent 覆盖请通过 agent preset 的 `dsh-persona` 行或 `agent.ctx` 注册实现。
- **实时性**：预设文件修改即时热重载；切换在下一个模型步骤生效。

## 开发

```sh
node --check index.js && node --check client.js
```

- Host 半：`index.js`（服务 / waterfall Hook / 工具 / `/api` RPC）。
- Client 半：`client.js`（`window.__ModuleLoader__.load` 格式的浏览器模块，注册设置页 section）。
- 设计文档：`docs/DESIGN.md`。

## 验收（已在本机 web profile 验证，含真实浏览器 CDP 走查）

1. `dsh --profile web --dump-config` 可见 `prompt-manager` 行。
2. `/plugins/dsh-prompt-manager/client.js` HTTP 200，且出现在页面 boot manifest。
3. `/api/prompt-manager/*` RPC 全部可用：getCatalog / listPresets / getPreset / getPresetYaml / createPreset / updatePreset / updatePresetYaml / deletePreset / setActive / refresh。
4. 激活预设后 `refresh` 返回的 sections 中目标段被替换、新段被插入；停用后恢复原状。
5. 预设文件热重载：`$DSH_HOME/prompts/` 下新增 `<name>.yml` 后 `listPresets` 立即可见。
6. **浏览器走查（headless Chrome + CDP）**：设置 →「提示词管理」面板完整渲染——
   - 预设目录与激活指针路径（`$DSH_HOME/prompts/`、`active.yml`）与每个预设文件路径；
   - 每个提示词段的完整内容、位置编号、来源归属（`来源：` 静态索引）、被预设覆盖的 badge；
   - 激活「创作模式」后覆盖 badge 出现、渲染结果预览立即包含新 persona 与新插入段；停用后恢复；
   - 面板全程 0 报错。

## v0.2：预设分类 / 开关 / 幕布

- **预设分类**：内置（随插件分发，灰色虚线 badge，只读）与个性化（`$DSH_HOME/prompts/`，强调色 badge，可编辑/删除）。同名时个性化覆盖内置。
- **开关**：每个预设一个开关（toggle），默认全部关闭；打开后下一个模型步骤生效，关闭即恢复。
- **幕布（组装流水线画布，全屏独立页面）**：「提示词管理」面板顶部「全屏查看幕布」→ 独立页面 `http://127.0.0.1:3080/prompt-manager/pipeline`（设置页内不内嵌画布）。布局**从左到右**分层（简化 Sugiyama：列分层 + 层内稳定顺序 + 列垂直居中 + 平滑贝塞尔连线）：
  - 主链：来源片段节点（name + order + 归属来源）→ 预设覆盖节点（操作 + 来源预设文件；**无激活预设时省略该列直通**）→ 变量插值节点（**仅在实际发生 `{{var}}` 替换时显示**，badge 列出 `{{model}}→值` 替换对）→ 最终系统提示词节点；同类型段按**命名空间 tag 自动收纳**为组节点（如 `tool:` → 工具说明段），点击展开成**收纳面板**逐条查看每个成员的完整提示词（Android 桌面文件夹式）；
  - 顶部侧翼（虚线连入，按语义就近对齐）：变量（插值输入，对齐插值列）、动态上下文快照（作为 user-role 消息追加）、工具 schema（工具定义 name/description/参数，由 dsh-tools 汇总各工具插件注册，随请求发送；点击展开逐条查看）；
  - 交互：加载后自动 fit 且**内容居中**（缩放/滚轮均围绕中心），拖拽平移、`+/−/重置`，点击节点弹出详情浮层（完整文本/来源/复制），悬停高亮节点与连线；
  - 数据全部**动态获取**（每次加载实时拉取真实模型组装快照，非写死）；支持**轮次时间轴**（◀ 轮次 k/N ▶ 最新）：host 保留最近 20 轮真实组装快照，可回看每轮对话产生的提示词如何构造与演化（工具段/上下文/变量随会话变化）。静态的仅归属与 order 标注表。

- **对话历史侧栏（幕布右侧）**：按 session 分类列出本次运行期间真实组装过的轮次（工作区 cwd + 会话 + 轮次数 + 时间）；点击 session 展开轮次列表，选中一条即动态渲染该轮幕布；默认展示最近 session 的最新一轮；3 秒轮询自动更新列表，当前会话在看最新轮时新轮次自动跟随。仅覆盖本次运行期间的组装（组装过程是运行时数据，无法从持久化历史重建）。

- **用户输入实体（消息链）**：用户输入是主链实体节点（顶部消息链「用户输入 → 消息聚合」，与系统链汇聚到「最终发送的请求」），数据来自 agent/pre-step 事件实时捕获（不读持久化历史）；实体始终显示（无用户消息的轮次显示占位）；右侧轮次列表显示每轮用户输入预览。

- **完整请求终点**：画布最右「最终发送的请求」节点展示完整模型请求构成（system 系统提示词 + messages 用户输入/上下文快照 + tools 工具 schema），点击查看全文；系统渲染节点（renderPrompt 结果）为中间环节，用户输入/上下文/工具以虚线汇入最终请求。

- **hover 实体解释**：悬停幕布实体节点显示该实体的作用/原理说明（解释 hash 表，能解释的尽量解释，未收录的不显示）。
- **翻译（待办收尾）**：翻译功能根因已定位（`credentials.resolve()` 需取 `.value`），修复 + UI 按钮 + 持久化验证记入待办。

- **收纳组画布展开（折中方案）**：收纳矩形左侧中轴 ⭕+（矩形外）一键展开为该 tag 的 N 个实体节点；展开后每个成员右侧中轴 ⭕−，点任意一个收起整组；收纳面板内亦有「在画布中展开」按钮；切换轮次时重置。
