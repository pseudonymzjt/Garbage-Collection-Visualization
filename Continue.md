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

## 🎯 后续工作

### ⏳ 可选优化方向（当前 MVP 已完整，以下为未来升级建议）

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
