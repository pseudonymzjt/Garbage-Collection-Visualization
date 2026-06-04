// src/levels/LevelData.js
// 六大 Java 内存泄漏关卡配置 + 沙盒模式 (Level 0)

const levels = [
  // ===== Level 0: 沙盒模式 =====
  {
    id: 0,
    name: '🛝 沙盒模式',
    description: '自由编辑模式，不受关卡限制',
    goal: '自由探索 GC 算法工作原理，随意添加 / 删除节点和引用',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'Root', type: 'root', x: 100, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'node_a', name: 'Obj_A', type: 'object', x: 260, y: 250, size: 30, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-a', from: 'root', to: 'node_a' },
    ],
    javaCode: [],
    checkWin: () => false, // 沙盒模式无通关条件
  },

  // ===== Level 1: 静态集合膨胀 =====
  {
    id: 1,
    name: '静态集合膨胀',
    description: 'static List 属于 GC Root，临时数据被 add 后无法被 JVM 回收',
    goal: '断开 staticCache → tempData 的连线，运行 Mark-Sweep GC 回收 tempData',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 80, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'staticCache', name: 'staticCache', type: 'object', x: 220, y: 250, size: 2, state: 'idle', refCount: 1 },
      { id: 'tempData', name: 'tempData', type: 'object', x: 380, y: 250, size: 100, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-cache', from: 'root', to: 'staticCache' },
      { id: 'e-cache-temp', from: 'staticCache', to: 'tempData' },
    ],
    javaCode: [
      { text: 'public class CacheManager {', alwaysNormal: true },
      { text: '    // static 变量属于 GC Root', alwaysNormal: true },
      { text: '    private static List<Object> cache = new ArrayList<>();', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void process() {', alwaysNormal: true },
      { text: '        // 创建 100MB 临时数据', alwaysNormal: true },
      { text: '        Object tempData = new byte[100 * 1024 * 1024];', alwaysNormal: true },
      { text: '        // 连线存在时 ⇒ 泄漏（高亮）', alwaysNormal: true },
      { text: '        cache.add(tempData);', activeEdge: 'e-cache-temp', commentText: '        // cache.add(tempData); // ✅ 已解绑' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: (nodes) => !nodes.some(n => n.id === 'tempData'),
  },

  // ===== Level 2: 循环引用的孤岛 =====
  {
    id: 2,
    name: '循环引用的孤岛',
    description: '两个孤立对象互相持有引用（b ⇄ c），引用计数无法归零',
    goal: '限制：只能用引用计数 GC。剪断环路使引用计数降为 0',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 80, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'node_b', name: 'Obj_B', type: 'object', x: 300, y: 170, size: 30, state: 'idle', refCount: 1 },
      { id: 'node_c', name: 'Obj_C', type: 'object', x: 300, y: 330, size: 30, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-b-c', from: 'node_b', to: 'node_c' },
      { id: 'e-c-b', from: 'node_c', to: 'node_b' },
    ],
    javaCode: [
      { text: 'class Node { Node next; }', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: 'Node b = new Node();', alwaysNormal: true },
      { text: 'Node c = new Node();', alwaysNormal: true },
      { text: 'b.next = c;', alwaysNormal: true },
      { text: 'c.next = b; // 👈 剪断此线使引用计数归零', activeEdge: 'e-c-b', commentText: '        // c.next = b; // ✅ 已解绑' },
      { text: '', alwaysNormal: true },
      { text: '// 引用计数面对循环引用时的局限性：', alwaysNormal: true },
      { text: '// 即使 Root 不再引用，b 和 c 互相持有', alwaysNormal: true },
      { text: '// 导致引用计数永远不会归零', alwaysNormal: true },
    ],
    checkWin: (nodes) => !nodes.some(n => n.id === 'node_b' || n.id === 'node_c'),
  },

  // ===== Level 3: 堆内存强引用解耦 =====
  {
    id: 3,
    name: '堆内存强引用解耦',
    description: '存在多条冗余强引用指向大 byte[] 缓冲区，内存无法释放',
    goal: '删除冗余边，使活动内存降至 10MB 以下',
    memoryLimit: 10,
    initialNodes: [
      { id: 'root', name: 'Root', type: 'root', x: 60, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 200, y: 190, size: 8, state: 'idle', refCount: 1 },
      { id: 'bigBuffer', name: 'bigBuffer', type: 'object', x: 360, y: 250, size: 150, state: 'idle', refCount: 2 },
    ],
    initialEdges: [
      { id: 'e-root-comp', from: 'root', to: 'heavyComp' },
      { id: 'e-comp-buf', from: 'heavyComp', to: 'bigBuffer' },
      { id: 'e-root-buf', from: 'root', to: 'bigBuffer' },
    ],
    javaCode: [
      { text: 'public class DataHandler {', alwaysNormal: true },
      { text: '    private byte[] bigBuffer = new byte[150 * 1024 * 1024];', alwaysNormal: true },
      { text: '    private HeavyComponent comp;', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void clear() {', alwaysNormal: true },
      { text: '        // 切断冗余强引用链路', alwaysNormal: true },
      { text: '        this.bigBuffer = null; // ✅ 释放强引用', activeEdge: 'e-root-buf', commentText: '        // this.bigBuffer = null; // 仍需断开冗余链路' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: (nodes) => {
      const activeMemory = nodes.reduce((sum, n) => sum + (n.size || 0), 0);
      return activeMemory <= 10;
    },
  },

  // ===== Level 4: 监听器未注销 =====
  {
    id: 4,
    name: '监听器未注销',
    description: '全局 EventPublisher 保留对短生命周期组件的监听器引用',
    goal: '斩断 EventPublisher → Listener 的连线，运行 GC 清除',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 50, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'publisher', name: 'EventPublisher', type: 'dom', x: 200, y: 180, size: 5, state: 'idle', refCount: 1 },
      { id: 'listener', name: 'Listener', type: 'purple', x: 200, y: 320, size: 2, state: 'idle', refCount: 1 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 370, y: 250, size: 80, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-pub', from: 'root', to: 'publisher' },
      { id: 'e-pub-listener', from: 'publisher', to: 'listener' },
      { id: 'e-listener-comp', from: 'listener', to: 'heavyComp' },
    ],
    javaCode: [
      { text: 'public class HeavyComponent implements Listener {', alwaysNormal: true },
      { text: '    private byte[] data = new byte[80 * 1024 * 1024];', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void onDestroy() {', alwaysNormal: true },
      { text: '        // 从全局事件源注销监听器', alwaysNormal: true },
      { text: '        EventPublisher.unregister(this); // ✅ 切断连线', activeEdge: 'e-pub-listener', commentText: '        // EventPublisher.unregister(this);' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: (nodes) => !nodes.some(n => n.id === 'heavyComp'),
  },

  // ===== Level 5: ThreadLocal 遗留 =====
  {
    id: 5,
    name: 'ThreadLocal 遗留',
    description: '线程池复用线程但未调用 ThreadLocal.remove()，大对象残留',
    goal: '切断 ThreadLocalMap → UserContext 的边，清理 ThreadLocal',
    memoryLimit: null,
    initialNodes: [
      { id: 'thread', name: 'Thread', type: 'root', x: 70, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'tlMap', name: 'ThreadLocalMap', type: 'purple', x: 240, y: 250, size: 5, state: 'idle', refCount: 1 },
      { id: 'userCtx', name: 'UserContext', type: 'object', x: 410, y: 250, size: 80, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-thread-tl', from: 'thread', to: 'tlMap' },
      { id: 'e-tl-ctx', from: 'tlMap', to: 'userCtx' },
    ],
    javaCode: [
      { text: 'public class WebFilter {', alwaysNormal: true },
      { text: '    private static ThreadLocal<Context> holder = new ThreadLocal<>();', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void doFilter() {', alwaysNormal: true },
      { text: '        try {', alwaysNormal: true },
      { text: '            holder.set(new Context());', alwaysNormal: true },
      { text: '        } finally {', alwaysNormal: true },
      { text: '            // 必须在 finally 中清理', alwaysNormal: true },
      { text: '            holder.remove(); // ✅ 清理 ThreadLocal', activeEdge: 'e-tl-ctx', commentText: '            // holder.remove();' },
      { text: '        }', alwaysNormal: true },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: (nodes) => !nodes.some(n => n.id === 'userCtx'),
  },

  // ===== Level 6: 未取消的后台 Timer =====
  {
    id: 6,
    name: '未取消的后台 Timer',
    description: 'java.util.Timer 线程未调用 cancel()，持有外部类无法被 GC',
    goal: '清除 Timer 紫色节点与 JVM_Roots 的连接，运行 GC',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 60, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'timer', name: 'java.util.Timer', type: 'purple', x: 220, y: 200, size: 5, state: 'idle', refCount: 1 },
      { id: 'task', name: 'TimerTask', type: 'object', x: 220, y: 330, size: 10, state: 'idle', refCount: 1 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 380, y: 280, size: 60, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-timer', from: 'root', to: 'timer' },
      { id: 'e-timer-task', from: 'timer', to: 'task' },
      { id: 'e-task-comp', from: 'task', to: 'heavyComp' },
    ],
    javaCode: [
      { text: 'public class Service {', alwaysNormal: true },
      { text: '    private Timer timer = new Timer();', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void stopService() {', alwaysNormal: true },
      { text: '        // 停止后台线程', alwaysNormal: true },
      { text: '        timer.cancel(); // ✅ 取消 Timer 释放整条链', activeEdge: 'e-root-timer', commentText: '        // timer.cancel();' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: (nodes) => !nodes.some(n => n.id === 'heavyComp'),
  },
];

export default levels;
