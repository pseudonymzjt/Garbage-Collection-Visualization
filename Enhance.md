使用 **Java** 作为代码对照区的语言，能够与垃圾回收（Garbage Collection）的主题达到更好的契合。因为 Java 虚拟机（JVM）正是现代工业级垃圾回收器的代表，而 Java 开发中因为 **`static` 集合、未解绑的监听器（Observer）、未清理的 `ThreadLocal` 以及未关闭的 `Timer`** 导致内存泄漏，也是高校面向对象程序设计（OOP）和系统级开发课程中非常核心且经典的考点。

以下是为您量身定制的 **Java 语言驱动版“内存泄漏解谜挑战”完整分阶段升级 Coding Plan**。

---

## 🎨 游戏核心：6 大 Java 内存泄漏关卡设计

| 关卡 | 关卡名称 | JVM 真实泄漏场景 (Java) | 核心难点与解谜方式 | 代码对照区变化 |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **静态集合膨胀** | `static List` 属于 GC Root 常驻内存，临时数据被 `add` 进去后导致无法被 JVM 回收。 | 玩家需断开 `staticList` 到临时对象的连线，并运行 **Mark-Sweep GC**。 | 连线存在时高亮 `cache.add(data)`，断开后该行代码变为置灰注释：`// cache.add(data); // 👈 已修复`。 |
| **L2** | **循环引用的孤岛** | 两个孤立对象互相持有对方的引用（`b.next = c; c.next = b;`）。 | **限制：只能用引用计数 GC**。玩家必须断开环路，使它们的 `rc` 降为 0。 | 切断边时，代码区中的 `b.next = c;` 变灰，展现引用计数在面对循环引用时的局限性。 |
| **L3** | **堆内存冗余强引用** | 强引用（Strong Reference）指向了巨大的 `byte[]` 缓冲区，且存在多条多余的强引用链路。 | 玩家分析拓扑图，删掉不必要的冗余边，使活动内存降至目标值（$\le 10\text{MB}$）。 | 切断不必要连接时，代码区中对应的对象关联行变为手动置空逻辑：`this.heavyBuffer = null;`。 |
| **L4** | **监听器未注销** | 事件源（如全局 `EventPublisher`）保留了对短生命周期组件的监听器引用，导致组件无法释放。 | 玩家卸载组件后，发现组件未被释放。必须**斩断全局发布者到监听器的连线**。 | 切断连线后，代码区自动补上 `EventPublisher.unregister(this)`。 |
| **L5** | **ThreadLocal 遗留** | 线程池中的线程复用，但未调用 `ThreadLocal.remove()`，导致大对象随线程一直留存。 | 玩家发现工作线程已结束，但内存依然被占用。必须**切断 ThreadLocal 到大对象的边**。 | 代码区从隐式保留状态变为显式执行清理：`threadLocal.remove();`。 |
| **L6** | **未取消的后台 Timer** | 启动了后台的 `java.util.Timer` 线程，由于未调用 `cancel()`，导致持有的外部类无法被 GC。 | 玩家必须**清除代表 Timer 的紫色节点与全局运行环境的连接**。 | 代码区从运行状态变为：`timer.cancel();`。 |

---

## 🛠️ 三栏式界面布局与 Java 代码对照区设计

在网页上，我们通过三栏式布局来展示整个解谜过程，右侧面板通过纯 HTML/CSS 模拟 IDE 的高亮效果：

```css
/* src/App.css */
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

/* 右侧 Java 源码对照区 */
.code-panel {
  width: 380px;
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
  white-space: pre-wrap;
}

/* 橙色代表 Java 关键字，黄色代表高亮活动行，灰色代表注释 */
.code-keyword { color: #f43f5e; font-weight: bold; }
.code-type { color: #3b82f6; }

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

## 📅 5 天分阶段升级实施计划

### 📅 第一阶段：游戏引擎框架与 Java 静态代码渲染（第 1 天）
**目标**：重构项目骨架，引入关卡状态机（Level State Machine）与右侧代码区面板。

1.  **全局状态设计**：
    在 `App.jsx` 中新增控制游戏关卡和代码同步的状态：
    ```javascript
    const [currentLevel, setCurrentLevel] = useState(0); // 0: 沙盒, 1~6: 游戏关卡
    const [levelCompleted, setLevelCompleted] = useState(false);
    ```
2.  **三栏式界面重构**：
    *   **左侧控制台**：关卡选择列表（Level 1~6），展示关卡描述和目标。
    *   **中间画布**：负责拖拽、连线、画线和 GC 运行。
    *   **右侧源码对照面板**：根据当前关卡，渲染对应的 Java 代码。

---

### 📅 第二阶段：关卡 1、2、3：JVM 基础 GC 与内存优化（第 2 天）
**目标**：编写 L1、L2、L3 的拓扑数据配置，实现最基础的 GC 解谜和 Java 代码高亮/注释切换。

#### 2.1 Level 1：静态集合膨胀（Static Collection Leak）
*   **画布配置**：🟢 `JVM_Roots` ──> 🔘 `staticCache` (List) ──> 🔘 `tempData` (100MB)。
*   **解谜方式**：玩家切断从 `staticCache` 指向 `tempData` 的连线。
*   **Java 代码区展现**：
    ```java
    public class CacheManager {
        // static 变量属于 GC Root
        private static List<Object> cache = new ArrayList<>(); 
        
        public void process() {
            Object tempData = new byte[100 * 1024 * 1024];
            // 连线存在时高亮此行：
            cache.add(tempData); 
            // 连线被切断时动态更新为：
            // cache.add(tempData); // 👈 已解绑！
        }
    }
    ```

#### 2.2 Level 2：循环引用的孤岛（Reference Cycle）
*   **画布配置**：两个孤立对象 `b` 和 `c` 相互引用成环。**限制只能使用“引用计数 GC”**。
*   **解谜方式**：剪断其中一根连线，让它们的引用计数成功归零。
*   **Java 代码区展现**：
    ```java
    class Node { Node next; }
    // 环路引用：
    Node b = new Node();
    Node c = new Node();
    b.next = c;
    c.next = b; // 👈 剪断此线，变为注释以通过引用计数 GC
    ```

#### 2.3 Level 3：堆内存强引用解耦（Strong Reference Decoupling）
*   **画布配置**：`Root` (2KB) ──> `HeavyComponent` ──> `bigBuffer` (150MB)。另外 `Root` 也有一条冗余链路直接指着 `bigBuffer`。
*   **解谜方式**：清除冗余连接，让活动内存降至 $10\text{MB}$ 以下。
*   **Java 代码区展现**：
    ```java
    public class DataHandler {
        private byte[] bigBuffer = new byte[150 * 1024 * 1024];
        
        public void clear() {
            // 连线切断后高亮此行，代表释放了强引用：
            this.bigBuffer = null; 
        }
    }
    ```

---

### 📅 第三阶段：关卡 4、5、6：Java 开发真实痛点攻坚（第 3-4 天）
**目标**：结合不同颜色和类型的节点（DOM/事件源节点、Timer 节点等），模拟真实的 Java 内存泄漏事故。

#### 3.1 Level 4：监听器未注销（Observer Pattern Leak）
*   **画布配置**：
    *   🟢 `JVM_Roots`
    *   🔵 `EventPublisher` (全局事件发布者)
    *   🟣 `Listener` (事件监听器，紫色)
    *   🔘 `HeavyComponent` (大型业务组件，灰色，80MB)
*   **模拟泄漏**：点击“销毁组件”，`HeavyComponent` 本该消失，但因为没有从 `EventPublisher` 中注销监听，整个对象依然残留。
*   **解谜方式**：切断 `EventPublisher ──> Listener` 的连线。
*   **Java 代码区展现**：
    ```java
    public class HeavyComponent implements Listener {
        public void onDestroy() {
            // 切断后高亮此行，代表从全局事件源注销：
            EventPublisher.unregister(this); 
        }
    }
    ```

#### 3.2 Level 5：ThreadLocal 遗留（ThreadLocal Leak）
*   **画布配置**：🟢 `Thread` (线程池中的工作线程) ──> 🟣 `ThreadLocalMap` ──> 🔘 `UserContext` (大对象)。
*   **模拟泄漏**：线程处理完请求后回到线程池复用，但没有清理 ThreadLocal，导致 `UserContext` 仍驻留在线程中。
*   **解谜方式**：切断 `ThreadLocalMap ──> UserContext` 的边。
*   **Java 代码区展现**：
    ```java
    public class WebFilter {
        private static ThreadLocal<Context> holder = new ThreadLocal<>();
        
        public void doFilter() {
            try {
                holder.set(new Context());
            } finally {
                // 必须在 finally 中清理，切断后高亮此行：
                holder.remove(); 
            }
        }
    }
    ```

#### 3.3 Level 6：未取消的后台 Timer（Timer Thread Leak）
*   **画布配置**：🟢 `JVM_Roots` ──> 🟣 `java.util.Timer` (后台线程) ──> 🔘 `Task` ──> 🔘 `HeavyComponent`。
*   **模拟泄漏**：后台 Timer 线程在持续运行，只要不取消，它就会一直持有组件的引用，导致整条链无法被 GC。
*   **解谜方式**：切断代表 Timer 线程的紫色节点与全局运行环境的连接。
*   **Java 代码区展现**：
    ```java
    public class Service {
        private Timer timer = new Timer();
        
        public void stopService() {
            // 停止后台线程，切断连线后高亮此行：
            timer.cancel(); 
        }
    }
    ```

---

### 📅 第四阶段：通关结算机制与游戏化 UI（第 4-5 天）
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
    *   💾 堆内存释放：XX MB
    *   📝 Java 源码重构成功！
    *   [进入下一关] 按钮。

---

### 📅 第五阶段：综合联调、演示文档编写与答辩准备（第 5 天）
**目标**：确保所有关卡切换顺畅，在 README 中加入通关攻略。

1.  **一键重置与快速通关调试**：
    测试在任意关卡中，点击“清空/重置”按钮能否完美还原该关卡的初始节点分布、连线和代码状态。
2.  **编写 README 中的游戏攻略**：
    在 `README.md` 中增加 **“Game Guide（玩家通关白皮书）”**。为评委和老师写明这 6 个关卡的设立初衷（涵盖了 Java 最经典的 6 种泄露场景）和通关的操作步骤。

---

### 💡 升级后的答辩优势（针对 Java 课程）

如果老师在审阅你的大作业时：
1.  看到你用前端最简单的 React 技术，把底层硬核的 **JVM GC 工作机制** 给做成了可视化。
2.  并且结合了 Java 中最容易考、最容易写出 Bug 的 **`static` 变量、`ThreadLocal.remove()` 以及事件注销（Observer 模式）**。
3.  通过**切断指针 ──> 右侧 Java 源码动态改变（重写为清除逻辑） ──> 运行 GC 验证** 这一套连贯的过程。

这不仅是一项优秀的前端作品，更是一次极具学术价值的 **“软件工程与底层原理教学案例”**，能够充分展现出你扎实的编程基本功。