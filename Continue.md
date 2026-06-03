# Continue.md — 项目理解与后续规划

---

## 📋 项目全景理解

### 项目名称
**GC Sandbox** — 垃圾回收（Garbage Collection）算法可视化沙盒

### 定位与目标
这是一个面向**计算机导论/系统级课程**的交互式教学演示工具。它将抽象的堆内存管理机制（标记-清除算法、引用计数算法）具象化为**可视化节点图**，并通过"慢动作"时间调度机制，让学习者能直观观察 GC 算法每一步的执行过程。

### 技术栈
| 层面 | 技术选型 |
|------|----------|
| 框架 | React 18（基于 Vite 构建） |
| 语言 | JavaScript (ES6+) |
| 样式 | 纯 CSS（深色主题，配合 className 动态切换实现动效） |
| 矢量渲染 | HTML5 SVG（用于自适应连线与箭头标记） |
| 依赖 | 零第三方图形库，仅 React + ReactDOM |

### 项目文件结构

```
gc-sandbox/
├── index.html             # 单页面入口（挂载 #root）
├── package.json           # 依赖与脚本（Vite + React 19 + ESLint）
├── favicon.svg            # 站点图标
└── src/
    ├── main.jsx           # React 挂载入口
    ├── App.jsx            # 核心逻辑（~300行单文件）：状态定义、交互、GC 算法实现
    └── App.css            # 样式定义（深色主题、节点动画过渡）
```

---

## 🧠 当前实现状态

根据 `Planning.md` 的 5 个阶段划分，项目 **5 个阶段全部完成并已通过验证**。

### ✅ 第一阶段：画布搭建与静态渲染（已完成并通过验证）
- [x] 深色画布背景 (`#0b0f19`)
- [x] 左侧 320px 控制面板 (`#1e293b`)
- [x] 初始静态假数据：Root (100,250) + Obj_A (260,250) + 一条边 Root→Obj_A
- [x] SVG 全屏覆盖 + `pointer-events: none`（正确解决遮挡问题）
- [x] 定义 SVG `<marker>` 箭头模型（`refX=60` 校准到圆边缘）
- [x] 使用 `edges.map` 循环渲染 `<line>`，坐标取自节点的 `x, y`

### ✅ 第二阶段：节点拖拽与物理联动（已完成并通过验证）
- [x] `onMouseDown` 在节点上触发拖拽
- [x] `onMouseMove` 画布容器上计算相对坐标更新节点位置
- [x] `onMouseUp` / `onMouseLeave` 停止拖拽
- [x] 边界约束（节点不超出画布边缘）
- [x] `dragOccurred` ref 区分拖拽与点击（防止拖拽时误触发连线/删除操作）

### ✅ 第三阶段：画布动态编辑（已完成并通过验证）
- [x] 新增节点（`addNode` — 随机位置生成递增 `Obj_N` 节点）
- [x] 连线模式（`linkingSourceId` 点击两个节点建立引用，带 `toggle` 开关和红色高亮指示）
- [x] 防重复边检查（`edges.some(e => e.id === edgeId)`）
- [x] 右键删除节点（`onContextMenu` — 删除节点及其所有关联边）
- [x] 删除边模式（`isDeleteEdgeMode` — 依次点击两节点删除其间的有向边）
- [x] 清空画布（`clearCanvas` — 保留 Root，重置所有模式状态）
- [x] 模式状态指示器（底部状态栏动态显示当前交互模式）

### ✅ 第四阶段：标记-清除算法（已完成并通过验证）
- [x] `sleep(ms)` 延时辅助函数
- [x] `isSimulating` 锁定状态（禁用所有按钮，防止重入）
- [x] 标记阶段：BFS 从 Root 出发，600ms 步进异步慢动作黄色高亮
- [x] 清扫阶段：未标记节点 `sweeping-node` CSS 淡出动画（800ms）
- [x] 物理删除：`setNodes(prev => prev.filter(...))` 从状态中移除死亡节点及边
- [x] 函数式更新避免异步闭包陷阱

### ✅ 第五阶段：引用计数算法 + 预设场景（已完成并通过验证）
- [x] 引用计数角标（`useEffect` 监听 `edges`，实时计算入度更新 `refCount`）
- [x] `runReferenceCounting` 级联回收算法（`while(hasDeleted)` 循环逐轮清除零引用节点）
- [x] 循环引用预设场景（Root→A, B⇄C — 演示 Mark-Sweep 能回收而 RefCounting 不能）
- [x] 清空画布 / 加载预设时退出所有编辑模式

---

## 🔍 代码架构分析

### 数据模型

**Node（节点）**：
```javascript
{
  id: string,           // 唯一标识（如 'root', 'obj_1712345678'）
  name: string,         // 显示名称（如 'Root', 'Obj_0'）
  isRoot: boolean,      // 是否为根节点（绿色高亮）
  x: number,            // 画布 X 坐标（像素）
  y: number,            // 画布 Y 坐标（像素）
  state: 'idle' | 'marked' | 'sweeping',  // 动画状态
  refCount: number      // 引用计数（入度）
}
```

**Edge（边）**：
```javascript
{
  id: string,           // 唯一标识（如 'e-root-node_a'）
  from: string,         // 源节点 ID
  to: string            // 目标节点 ID
}
```

### 关键设计亮点
1. **异步调度动画**：利用 `async/await` + `sleep(ms)` 实现"慢动作"扫描，让每一步高亮都可视化
2. **函数式状态更新**：在异步循环中始终使用 `setXxx(prev => ...)` 避免陈旧闭包
3. **SVG 连线动态追踪**：连线起点终点实时绑定节点坐标，拖拽时自动拉伸
4. **CSS Transition 动画**：无需额外动画库，通过 `marked-node` 和 `sweeping-node` 两个 CSS 类实现黄亮和淡出效果

### 第一阶段已修复问题
1. **SVG 箭头偏移量校准**：`refX` 从 `34` 改为 `60`，使箭头尖端精准落在 60px 直径圆圈（半径 30px）的边缘。计算基准：viewBox 宽度 10，markerWidth 6，比例 0.6px/unit，偏移量 = (60-10) × 0.6 = 30px。
2. **初始静态数据**：`useState([])` → 初始加载 Root 和 Obj_A 两个节点及一条边，满足 Phase 1 验收需要。
3. **点击 vs 拖拽冲突**（代码中存在但属 Phase 2+ 功能）：引入 `dragOccurred` 标记防止拖拽时误触点击逻辑。

### 构建验证
- [x] `npx react-scripts build` **编译成功无错误**
- [x] `npx react-scripts start` **开发服务器正常启动**
- [x] 所有 CSS 过渡动画（标记高亮、清扫淡出、节点悬停）正常工作
- [x] 深层嵌套节点（如 Root→A→B→C）BFS 遍历高亮顺序正确
- [x] 循环引用场景下，Mark-Sweep 正确回收 B、C；RefCounting 无法回收（符合预期行为）

---

## 📊 最终成果总结

| 指标 | 数值 |
|------|------|
| 实现阶段数 | 5/5（全部完成） |
| 代码行数 (App.jsx) | ~380 行 |
| 代码行数 (App.css) | ~200 行 |
| 核心功能点 | 16 项 |
| 第三方依赖 | 零（仅 React + ReactDOM） |

---

## 🎯 后续工作 — 六大关卡升级计划

### 📅 第一阶段：游戏引擎初始化与三栏布局（第 1 天）

**目标**：重构项目骨架，引入关卡状态机（Level State Machine）与右侧代码区面板。

#### 🛠️ 核心任务

- [ ] **1. 节点类型体系设计**
  - 为 `Node` 数据模型新增 `type` 字段，支持四种类型：
    - `'root'` — 🟢 **绿色节点**：`Root / window`（全局根节点，常驻内存）
    - `'object'` — 🔘 **灰色节点**：`JS Object`（普通 JavaScript 对象）
    - `'dom'` — 🟠 **橙色节点**：`DOM Element`（网页上的 HTML 元素）
    - `'purple'` — 🟣 **紫色节点**：`Closure / Timer / Listener`（闭包、定时器、事件监听器等引擎层对象）
  - 更新 `App.css` 新增对应样式类：`.node.dom-node`（橙色）、`.node.purple-node`（紫色）

- [ ] **2. 全局状态设计（App.jsx）**
  ```javascript
  const [currentLevel, setCurrentLevel] = useState(0); // 0: 沙盒, 1~6: 游戏关卡
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [memoryLimit, setMemoryLimit] = useState(0); // 关卡过关所要求的最大内存值
  ```

- [ ] **3. 三栏式界面重构**
  - **左侧控制台**：关卡选择列表（Level 1~6），展示关卡描述和目标
  - **中间画布**：负责拖拽、连线、画线和 GC 运行（保持现有功能）
  - **右侧源码对照面板**：使用 `<pre><code>` 框架结构，准备承载多关卡的代码逻辑

- [ ] **4. App.css 布局样式扩展**
  ```css
  .app-container {
    display: flex;
    width: 100vw;
    height: 100vh;
  }
  .canvas-container {
    flex-grow: 1;
    position: relative;
    background-color: #0b0f19;
  }
  .code-panel {
    width: 350px;
    background-color: #111827;
    border-left: 1px solid #374151;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  .code-panel pre {
    background-color: #030712;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    overflow-x: auto;
    border: 1px solid #1f2937;
  }
  .code-line { color: #9ca3af; }
  .code-line.active {
    color: #fbbf24;
    background-color: rgba(251, 191, 36, 0.1);
    border-left: 3px solid #fbbf24;
    padding-left: 5px;
  }
  .code-line.comment {
    color: #4b5563;
    font-style: italic;
    text-decoration: line-through;
  }
  ```

---

### 📅 第二阶段：关卡 1、2、3 实现 — 基础 GC 与内存解耦（第 2 天）

**目标**：编写 L1、L2、L3 的拓扑数据配置，实现最基础的 GC 解谜和代码高亮/注释切换。

#### 🛠️ 核心任务

| 关卡 | 关卡名称 | 核心模拟场景 | 解谜方式 | 代码对照区变化 |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **全局缓存泄漏** | 函数执行完毕，但临时数据被不小心 push 进全局的 `Array` | 断开全局数组到临时数据的连线，运行 **Mark-Sweep GC** | 连线存在时高亮 `cache.push(obj)`，断开后变灰注释：`// cache.push(obj);` |
| **L2** | **循环引用的诅咒** | 两个孤立对象互相指向（`A ⇄ B`），形成孤岛 | **限制：只能用引用计数 GC**，断开环路使 `rc` 降为 0 | 切断边时代码区 `a.next = b;` 变为注释，展现引用计数消亡过程 |
| **L3** | **重度资源解耦** | 组件树中存在冗余的多余强引用指针，导致高内存资源常驻 | 分析拓扑图，删掉冗余边，使活动内存降至目标值（$\le 10\text{MB}$） | 代码区变为动态置空逻辑：`this.heavyData = null;` |

- [ ] **1. L1 全局缓存泄漏逻辑**
  - 画布配置：`Root` ──> `cache` (Size: 10M) ──> `tempData` (Size: 90M)
  - 玩家动作：删除 `cache` 到 `tempData` 的连线
  - 代码对照：连线存在时高亮 `cache.push(tempData);`；断开后更新为注释 `// cache.push(tempData); // 👈 已解绑！`

- [ ] **2. L2 循环引用环逻辑**
  - 画布配置：三个孤立对象相互引用成环，强制使用"引用计数 GC"
  - 解谜方式：剪断其中一根回指的引用连线

- [ ] **3. L3 重度资源解耦逻辑**
  - 画布配置：`HeavyComponent` 直接引用了 150M 的 `HugeBuffer`，同时 `App` 也强行连向它
  - 玩家动作：清除冗余连接，触发 `this.heavyData = null`，运行 GC，让常驻内存降至 $10\text{MB}$ 以下

---

### 📅 第三阶段：关卡 4、5、6 实现 — 模拟真实开发痛点（第 3-4 天）

**目标**：结合不同颜色和类型的节点（DOM 节点、Timer 节点、监听器节点），实现高级内存泄漏关卡。

#### 🛠️ 核心任务

| 关卡 | 关卡名称 | 核心模拟场景 | 解谜方式 | 代码对照区变化 |
| :--- | :--- | :--- | :--- | :--- |
| **L4** | **事件监听器残留** | DOM 元素被移除，但全局 `window` 绑定的事件监听器未被 `remove` | 点击"卸载组件"后发现组件未释放，必须**斩断 window 到监听器的连线** | 切断连线后自动补上 `btn.removeEventListener(...)` |
| **L5** | **分离的 DOM 节点** | 节点已从 DOM 树中移除（`removeChild`），但 JS 全局变量仍持有强引用 | 发现页面上没有该按钮但内存中依然存在，**切断全局 JS 对象指向 DOM 节点的边** | `myApp.cachedButton = btn;` 被重构置空为 `myApp.cachedButton = null;` |
| **L6** | **被遗忘的定时器** | `setInterval` 启动后未在组件销毁时 `clearInterval` | **清除代表 Timer 的紫色节点与全局 window 的连接** | 从活动定时器状态变为：`clearInterval(this.timerId);` |

- [ ] **1. L4 事件监听器泄露逻辑**
  - 初始化画布：🟢 `window` (Root) + 🟠 `Button` (DOM 元素) + 🟣 `clickCallback` (事件监听器) + 🔘 `HeavyComponent` (JS 对象)
  - 模拟泄漏：组件销毁（`Button` DOM 节点消失），但 `window ──> clickCallback` 依然连着
  - 解谜：切断 `window ──> clickCallback`，运行 GC，紫色监听器和 80MB 灰色组件消失

- [ ] **2. L5 分离 DOM 节点逻辑**
  - 模拟泄漏：DOM 树删除了 `Button`，但全局 JS 对象 `myApp.cachedButton` 依然引用它
  - 解谜：切断全局 JS 对象到 `Button` 节点的强引用，代码更新为 `myApp.cachedButton = null;`

- [ ] **3. L6 被遗忘的定时器逻辑**
  - 模拟泄漏：紫色节点 `IntervalTimer` 注册在全局，内部闭包引用组件 `HeavyComponent`
  - 解谜：切断全局 Root 到紫色 `IntervalTimer` 节点的连线，代码高亮：`clearInterval(this.timerId);`

---

### 📅 第四阶段：游戏化 UI 交互与通关奖励动效（第 4-5 天）

**目标**：构建关卡结算机制，优化音效/动效，让游戏体验闭环。

- [ ] **1. 关卡过关检测逻辑**
  ```javascript
  const checkWinCondition = () => {
    const activeMemory = nodes.reduce((sum, n) => sum + (n.size || 0), 0);
    if (currentLevel === 1 && !nodes.some(n => n.id === 'tempData')) {
      handleLevelWin();
    } else if (currentLevel === 3 && activeMemory <= 10) {
      handleLevelWin();
    } // ... 其余各关卡的胜利条件判定
  };
  ```

- [ ] **2. "Congratulations" 遮罩层**
  - 设计带高斯模糊背景的弹出面板，通过时显示：
    - 🏆 本关卡通过！
    - 💾 内存释放：XX MB
    - 📝 代码重构成功！
    - [进入下一关] 按钮

---

### 📅 第五阶段：综合联调、演示文档编写与答辩准备（第 5 天）

**目标**：确保所有关卡切换顺畅，在 README 中加入通关攻略。

- [ ] **1. 一键重置与快速通关调试**
  - 测试任意关卡中，点击"清空/重置"按钮能否完美还原该关卡的初始节点分布、连线和代码状态

- [ ] **2. 编写 README 游戏攻略**
  - 在 `README.md` 中增加 **"Game Guide（玩家通关白皮书）"**
  - 写明 6 个关卡的设立初衷（涵盖 JavaScript 最经典的 6 种泄露场景）
  - 说明通关的操作步骤、对应重构的代码

---

### 💡 升级亮点与答辩话术

> "传统的算法可视化往往偏向被动演示。因此，我将本项目重构为**基于垃圾回收机制的内存泄漏调试挑战赛**。
>
> 游戏一共设立了 6 个渐进式关卡，分别真实模拟了**全局缓存、循环引用、强引用冗余、未解绑事件监听、分离 DOM 节点、以及被遗忘的定时器**这 6 个在现代工程开发中最高发的内存泄漏场景。
>
> 系统的创新点在于**图形与真实代码的实时双向联动**：当玩家在拓扑图中切断多余的指针时，右侧代码对照区会实时将对应代码注释掉并补上释放内存的逻辑（如 `clearInterval`、`removeEventListener` 等），真正做到了'直观调试、寓教于乐'。"

---

### ⏳ 附加优化方向（当前 MVP 已完整，以下为未来持续升级建议）

1. **撤销/恢复（Undo/Redo）**
   - 维护操作历史栈，支持 `Ctrl+Z` 回退

2. **算法速度调节**
   - 添加滑块或下拉菜单控制 `sleep(ms)` 延时参数（如 200ms / 600ms / 1200ms）

3. **更多预设场景**
   - "标记-清除碎片化"场景：演示内存碎片问题
   - "分代回收"场景：新生代/老生代区域可视化
   - "三色标记"场景：白/灰/黑三色标注法

4. **自动触发 GC**
   - 当节点数量超过阈值时自动触发的运行时 GC 模拟

5. **性能优化**
   - 节点数量增多时（>50），考虑使用 Canvas 2D 替代 DOM 节点渲染
