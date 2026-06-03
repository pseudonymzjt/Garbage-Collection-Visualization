
为了配合多关卡的设计，我们可以在视觉上为节点引入 **“类型（Type）”**，用不同颜色的圆圈来代表不同内存单元：
*   🟢 **绿色节点**：`Root / window`（全局根节点，常驻内存）
*   🔘 **灰色节点**：`JS Object`（普通 JavaScript 对象）
*   🟠 **橙色节点**：`DOM Element`（网页上的 HTML 元素）
*   🟣 **紫色节点**：`Closure / Timer / Listener`（闭包、定时器、事件监听器等引擎层对象）


---

## 🎮 游戏核心：6 大关卡设计矩阵

| 关卡 | 关卡名称 | 核心模拟场景 | 核心难点与解谜方式 | 代码对照区变化 |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **全局缓存泄漏** | 函数执行完毕，但临时数据被不小心 push 进了全局的 `Array`。 | 玩家需断开全局数组到临时数据的连线，并运行 **Mark-Sweep GC**。 | 连线存在时高亮 `cache.push(obj)`，断开后该行代码自动变灰并变为注释：`// cache.push(obj);`。 |
| **L2** | **循环引用的诅咒** | 两个孤立对象互相指向（`A ⇄ B`），形成孤岛。 | **限制：只能用引用计数 GC**。玩家必须断开环路，使它们的 `rc` 降为 0。 | 切断边时，代码区中的 `a.next = b;` 变为注释，展现引用计数的消亡过程。 |
| **L3** | **重度资源解耦** | 组件树中存在冗余的多余强引用指针，导致高内存资源常驻。 | 玩家分析拓扑图，删掉不必要的冗余边，使活动内存降至目标值（$\le 10\text{MB}$）。 | 代码区从强引用引入，变为动态按需置空逻辑：`this.heavyData = null;`。 |
| **L4** | **事件监听器残留** | DOM 元素被移除，但全局 `window` 绑定的事件监听器未被 `remove`，导致闭包和组件残留。 | 玩家点击“卸载组件”后，发现组件未被释放。必须**斩断 window 到监听器的连线**。 | 切断连线后，代码区自动补上 `btn.removeEventListener(...)`。 |
| **L5** | **分离的 DOM 节点** | 节点已从 DOM 树中移除（`removeChild`），但 JS 全局变量仍持有了该 DOM 的强引用，导致整个 DOM 子树无法释放。 | 玩家发现页面上没有这个按钮，但内存中依然存在。必须**切断全局 JS 对象指向该 DOM 节点的边**。 | 代码区中 `myApp.cachedButton = btn;` 被重构置空为 `myApp.cachedButton = null;`。 |
| **L6** | **被遗忘的定时器** | `setInterval` 启动后，未在组件销毁时执行 `clearInterval`，导致定时器闭包持续持有外部数据。 | 玩家必须**清除代表 Timer 的紫色节点与全局 window 的连接**。 | 代码区从活动定时器状态变为：`clearInterval(this.timerId);`。 |

---

## 🛠️ 技术架构调整与 App.css 样式扩充

为了支持 6 个关卡的视觉呈现，在 `src/App.css` 中增加以下类名，使不同类型的节点拥有极高的辨识度：

```css
/* 1. 节点类型样式拓展 */
.node.dom-node {
  background-color: #f97316; /* 橙色：DOM 元素 */
  border-color: #ea580c;
}

.node.purple-node {
  background-color: #a855f7; /* 紫色：Timer, Listener, Closure */
  border-color: #9333ea;
}

/* 2. 源码对照区布局 */
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.canvas-container {
  flex-grow: 1; /* 中间画布自适应 */
  position: relative;
  background-color: #0b0f19;
}

.code-panel {
  width: 350px; /* 右侧源码对照区 */
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

.code-line {
  color: #9ca3af;
}

.code-line.active {
  color: #fbbf24; /* 活跃代码：亮黄色 */
  background-color: rgba(251, 191, 36, 0.1);
  border-left: 3px solid #fbbf24;
  padding-left: 5px;
}

.code-line.comment {
  color: #4b5563; /* 置灰注释：灰色 */
  font-style: italic;
  text-decoration: line-through;
}
```

---

## 📅 5 天分阶段升级实施计划

### 📅 第一阶段：游戏引擎初始化与三栏布局（第 1 天）
**目标**：重构项目骨架，引入关卡状态机（Level State Machine）与右侧代码区面板。

1.  **全局状态设计**：
    在 `App.jsx` 中新增控制游戏和代码同步的状态：
    ```javascript
    const [currentLevel, setCurrentLevel] = useState(0); // 0: 沙盒, 1~6: 游戏关卡
    const [levelCompleted, setLevelCompleted] = useState(false);
    const [memoryLimit, setMemoryLimit] = useState(0); // 关卡过关所要求的最大内存值
    ```
2.  **三栏式界面重构**：
    *   **左侧控制台**：关卡选择列表（Level 1~6），展示关卡描述和目标。
    *   **中间画布**：负责拖拽、连线、画线和 GC 运行。
    *   **右侧源码对照面板**：使用 `<pre><code>` 框架结构，准备承载多关卡的代码逻辑。

---

### 📅 第二阶段：关卡 1、2、3 实现：基础 GC 与内存解耦（第 2 天）
**目标**：编写 L1、L2、L3 的拓扑数据配置，实现最基础的 GC 解谜和代码高亮/注释切换。

1.  **L1（全局缓存泄露）逻辑编写**：
    *   画布配置：`Root` ──> `cache` (Size: 10M) ──> `tempData` (Size: 90M)。
    *   玩家动作：删除 `cache` 到 `tempData` 的连线。
    *   代码对照：
        ```javascript
        // 连线存在时：
        cache.push(tempData);
        // 连线断开时动态更新为：
        // cache.push(tempData); // 👈 已解绑！
        ```
2.  **L2（循环引用环）逻辑编写**：
    *   画布配置：三个孤立对象相互引用成环。强制选择“引用计数 GC”。
    *   解谜方式：剪断其中一根回指的引用连线。
3.  **L3（重度资源解耦）逻辑编写**：
    *   画布配置：`HeavyComponent` 直接引用了 150M 的 `HugeBuffer`，同时 `App` 也强行连向它。
    *   玩家动作：清除冗余连接，在代码区触发 `this.heavyData = null` 动态逻辑，运行 GC，让常驻内存降至 $10\text{MB}$ 以下。

---

### 📅 第三阶段：关卡 4、5、6 实现：模拟真实开发痛点（第 3-4 天）
**目标**：结合不同颜色和类型的节点（DOM 节点、Timer 节点、监听器节点），实现高级内存泄漏关卡。

1.  **L4（事件监听器泄露）逻辑编写**：
    *   初始化画布：
        *   🟢 `window` (Root) 
        *   🟠 `Button` (DOM 元素)
        *   🟣 `clickCallback` (事件监听器，紫色)
        *   🔘 `HeavyComponent` (JS 对象，灰色)
    *   模拟泄漏：游戏开始时，组件销毁（`Button` DOM 节点从画布中消失），但由于忘记 `remove`，`window ──> clickCallback` 依然连着。
    *   解谜方式：切断 `window ──> clickCallback`，代表执行了解绑代码。再次运行 GC，紫色监听器和 80MB 的灰色组件成功消失。
2.  **L5（分离的 DOM 节点）逻辑编写**：
    *   模拟泄漏：DOM 树删除了 `Button` 节点，但全局 JS 对象 `myApp.cachedButton` 依然拉着它。
    *   解谜方式：切断全局 JS 对象到 `Button` 节点的强引用。右侧代码对应更新为：`myApp.cachedButton = null;`。
3.  **L6（被遗忘的定时器）逻辑编写**：
    *   模拟泄漏：紫色节点 `IntervalTimer` 注册在全局。它内部的闭包引用了组件 `HeavyComponent`。
    *   解谜方式：切断全局 Root 到紫色 `IntervalTimer` 节点的连线。右侧代码对照区高亮激活：`clearInterval(this.timerId);`。运行 GC 后，定时器和关联的重度组件被一并回收。

---

### 📅 第四阶段：游戏化 UI 交互与通关奖励动效（第 4-5 天）
**目标**：构建关卡结算机制，优化音效/动效，让游戏体验闭环。

1.  **编写关卡过关检测逻辑**：
    在运行 GC 结束的回调中增加检测：
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
2.  **“Congratulations” 遮罩层**：
    设计一个带高斯模糊背景的弹出面板。当玩家过关时弹出，显示：
    *   🏆 本关卡通过！
    *   💾 内存释放：XX MB
    *   📝 代码重构成功！
    *   [进入下一关] 按钮。

---

### 📅 第五阶段：综合联调、演示文档编写与答辩准备（第 5 天）
**目标**：确保所有关卡切换顺畅，在 README 中加入通关攻略。

1.  **一键重置与快速通关调试**：
    测试在任意关卡中，点击“清空/重置”按钮能否完美还原该关卡的初始节点分布、连线和代码状态。
2.  **编写 README 中的游戏攻略**：
    在 `README.md` 中增加 **“Game Guide（玩家通关白皮书）”**。为评委和老师写明这 6 个关卡的设立初衷（涵盖了 JavaScript 最经典的 6 种泄露场景）和通关的操作步骤、对应重构的代码。

---

### 💡 升级后的亮点与答辩话术

这个升级方案为你的项目带来了极强的说服力，你可以使用如下话术向评委老师展示：

> “传统的算法可视化往往偏向被动演示。因此，我将本项目重构为**基于垃圾回收机制的内存泄漏调试挑战赛**。
>
> 游戏一共设立了 6 个渐进式关卡，分别真实模拟了**全局缓存、循环引用、强引用冗余、未解绑事件监听、分离 DOM 节点、以及被遗忘的定时器**这 6 个在现代工程开发中最高发的内存泄漏场景。
>
> 系统的创新点在于**图形与真实代码的实时双向联动**：当玩家在拓扑图中切断多余的指针时，右侧代码对照区会实时将对应代码注释掉并补上释放内存的逻辑（如 `clearInterval`、`removeEventListener` 等），真正做到了‘直观调试、寓教于乐’。”