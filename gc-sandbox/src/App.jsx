// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// 延时辅助函数：有了它，我们就可以用 async/await 编写带“暂停动画”的算法
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function App() {
  // --- 1. 图结构核心状态（含第一阶段静态假数据） ---
  const [nodes, setNodes] = useState([
    { id: 'root', name: 'Root', x: 100, y: 250, isRoot: true, state: 'idle', refCount: 0 },
    { id: 'node_a', name: 'Obj_A', x: 260, y: 250, isRoot: false, state: 'idle', refCount: 1 },
  ]);
  const [edges, setEdges] = useState([
    { id: 'e-root-a', from: 'root', to: 'node_a' },
  ]);

  // --- 2. 交互与编辑状态 ---
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [linkingMode, setLinkingMode] = useState(false);      // 连线模式开关
  const [linkingSourceId, setLinkingSourceId] = useState(null); // 用于连线：记录第一个点击的节点
  const [isDeleteEdgeMode, setIsDeleteEdgeMode] = useState(false); // 删除连线模式
  const [deleteEdgeFromId, setDeleteEdgeFromId] = useState(null);  // 删除连线：第一个选中节点
  const [isSimulating, setIsSimulating] = useState(false);      // 模拟运行时锁定界面按钮
    const canvasRef = useRef(null);
  const dragOccurred = useRef(false);    // 区分"点击"和"拖拽"：拖拽时不触发连线逻辑
  const nodeCounter = useRef(nodes.length); // 用于生成递增的节点名称

  // --- 3. 辅助图算法（基于当前数据实时计算，不污染 State） ---
  // 获取当前节点指向的所有邻居（出度）
  const getNeighbors = (nodeId, currentEdges = edges) => {
    return currentEdges.filter(e => e.from === nodeId).map(e => e.to);
  };

  // 监听并动态更新每个节点的引用计数 (Reference Count)
  useEffect(() => {
    setNodes(prevNodes => 
      prevNodes.map(node => {
        if (node.isRoot) return node;
        // 计算有多少条边指向该节点（入度）
        const incoming = edges.filter(e => e.to === node.id).length;
        return { ...node, refCount: incoming };
      })
    );
  }, [edges]);

  // --- 4. 节点拖拽定位逻辑 ---
  const handleMouseDown = (nodeId, e) => {
    if (isSimulating) return;
    e.stopPropagation();
    dragOccurred.current = false; // 重置拖拽标记
    setDraggedNodeId(nodeId);
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeId || isSimulating) return;
    dragOccurred.current = true; // 鼠标移动了，说明是拖拽而非点击
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 限制拖拽不出画布边界
    const boundedX = Math.max(30, Math.min(rect.width - 30, x));
    const boundedY = Math.max(30, Math.min(rect.height - 30, y));

    setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: boundedX, y: boundedY } : n));
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
    dragOccurred.current = false;
  };

  const handleMouseLeave = () => {
    setDraggedNodeId(null);
    dragOccurred.current = false;
  };

  // --- 5. 节点与引用关系的手动编辑 ---
    const addNode = () => {
    const id = 'obj_' + Date.now();
    nodeCounter.current += 1;
    const newNode = {
      id,
      name: `Obj_${nodeCounter.current}`,
      isRoot: false,
      x: 150 + Math.random() * 200,
      y: 150 + Math.random() * 200,
      state: 'idle', // 'idle' | 'marked' | 'sweeping'
      refCount: 0
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleNodeClick = (nodeId) => {
    if (isSimulating) return;
    // 如果刚刚拖拽过节点，则忽略此次点击
    if (dragOccurred.current) {
      dragOccurred.current = false;
      return;
    }

    // 删除连线模式：依次点击两个节点，删除它们之间的边
    if (isDeleteEdgeMode) {
      if (deleteEdgeFromId === null) {
        setDeleteEdgeFromId(nodeId); // 选中第一个节点
      } else if (deleteEdgeFromId === nodeId) {
        setDeleteEdgeFromId(null);   // 点击同一个节点，取消选中
      } else {
        // 删除从 deleteEdgeFromId 指向 nodeId 的边
        setEdges(prev => prev.filter(e => !(e.from === deleteEdgeFromId && e.to === nodeId)));
        setDeleteEdgeFromId(null);
        setIsDeleteEdgeMode(false);  // 删除成功后自动退出模式
      }
      return;
    }

    // 连线模式（需先点击按钮开启链接模式）：点击第一个节点，再点击第二个节点，建立单向引用
    if (linkingMode) {
      if (linkingSourceId === null) {
        setLinkingSourceId(nodeId); // 标记为连线起点
      } else if (linkingSourceId === nodeId) {
        setLinkingSourceId(null);   // 点击同一个节点，取消选中
      } else {
        const edgeId = `e-${linkingSourceId}-${nodeId}`;
        // 防止重复连线
        if (!edges.some(e => e.id === edgeId)) {
          setEdges(prev => [...prev, { id: edgeId, from: linkingSourceId, to: nodeId }]);
        }
        setLinkingSourceId(null); // 连线完成，结束连线状态
      }
    }
  };

  // --- 6. 核心垃圾回收算法实现 ---

  // 【算法一：标记-清除算法】
  const runMarkSweep = async () => {
    setIsSimulating(true);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);

    // 重置所有节点状态
    setNodes(prev => prev.map(n => ({ ...n, state: 'idle' })));
    await sleep(300);

    // 1. 标记阶段 (DFS 遍历)
    let visited = new Set();
    let queue = [];
    
    // 找到所有 Root 节点作为起点
    const roots = nodes.filter(n => n.isRoot);
    roots.forEach(r => queue.push(r.id));

    while (queue.length > 0) {
      let currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      // 动画高亮：将当前扫描节点设为 'marked'
      setNodes(prev => prev.map(n => n.id === currId ? { ...n, state: 'marked' } : n));
      await sleep(600); // 停顿 600ms 以展示指针扫描过程

      // 寻找子节点入队
      let neighbors = getNeighbors(currId);
      queue.push(...neighbors);
    }

    // 2. 清扫阶段前置动画 (Sweep)
    // 找出没被标记（没被 visited 收集到）的死亡对象，将其设为 'sweeping' 以触发 CSS 淡出
    setNodes(prev => prev.map(n => {
      if (!visited.has(n.id)) {
        return { ...n, state: 'sweeping' };
      }
      return n;
    }));
    await sleep(800); // 等待 CSS 淡出动画（.node.sweeping-node）执行完毕

    // 3. 物理删除：从内存状态中清除
    setNodes(prev => prev.filter(n => visited.has(n.id)));
    setEdges(prev => prev.filter(e => visited.has(e.from) && visited.has(e.to)));

    setIsSimulating(false);
  };

  // 【算法二：引用计数级联回收算法】
  const runReferenceCounting = async () => {
    setIsSimulating(true);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);

    let activeNodes = [...nodes];
    let activeEdges = [...edges];
    let hasDeleted = true;

    // 级联扫描循环
    while (hasDeleted) {
      hasDeleted = false;

      // 找出所有引用计数为 0 的非 Root 节点
      const toDelete = activeNodes.filter(n => {
        if (n.isRoot) return false;
        const incoming = activeEdges.filter(e => e.to === n.id).length;
        return incoming === 0;
      });

      if (toDelete.length > 0) {
        hasDeleted = true;
        const deleteIds = toDelete.map(n => n.id);

        // 1. 播放销毁动画
        setNodes(prev => prev.map(n => deleteIds.includes(n.id) ? { ...n, state: 'sweeping' } : n));
        await sleep(800);

        // 2. 更新临时变量，断开这些死亡节点引出的一切连接（可能会引起下一轮其他节点归零）
        activeNodes = activeNodes.filter(n => !deleteIds.includes(n.id));
        activeEdges = activeEdges.filter(e => !deleteIds.includes(e.from) && !deleteIds.includes(e.to));

        // 同步渲染到 React UI
        setNodes(activeNodes);
        setEdges(activeEdges);
      }
    }

    setIsSimulating(false);
  };

  // --- 7. 预设经典演示场景 ---
  const loadCircularPreset = () => {
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
    // 一键加载“循环引用”场景：Root 指向 A，而存在独立的 B 和 C 互相引用
    const presetNodes = [
      { id: 'root', name: 'Root', x: 100, y: 250, isRoot: true, state: 'idle' },
      { id: 'node_a', name: 'Obj_A', x: 260, y: 250, isRoot: false, state: 'idle' },
      { id: 'node_b', name: 'Obj_B', x: 450, y: 150, isRoot: false, state: 'idle' },
      { id: 'node_c', name: 'Obj_C', x: 450, y: 350, isRoot: false, state: 'idle' },
    ];
    const presetEdges = [
      { id: 'e-r-a', from: 'root', to: 'node_a' },
      { id: 'e-b-c', from: 'node_b', to: 'node_c' },
      { id: 'e-c-b', from: 'node_c', to: 'node_b' },
    ];
    setNodes(presetNodes);
    setEdges(presetEdges);
  };

  const clearCanvas = () => {
    setNodes([{ id: 'root', name: 'Root', x: 100, y: 250, isRoot: true, state: 'idle' }]);
    setEdges([]);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
  };

  return (
    <div className="app-container">
      {/* 左侧控制台 */}
      <div className="control-panel">
        <h2 className="panel-title">GC Sandbox 控制台</h2>
        
        <div className="btn-group">
          <h3>1. 画布编辑</h3>
          <button disabled={isSimulating} onClick={addNode}>+ 新增内存对象</button>
          <button 
            disabled={isSimulating} 
            onClick={() => {
              setLinkingMode(prev => !prev);
              setLinkingSourceId(null);
              if (isDeleteEdgeMode) {
                setIsDeleteEdgeMode(false);
                setDeleteEdgeFromId(null);
              }
            }}
            style={{ backgroundColor: linkingMode ? '#ef4444' : '' }}
          >
            {linkingMode ? '❌ 退出连线模式' : '🔗 连线模式'}
          </button>
                    <button 
            disabled={isSimulating} 
            onClick={() => {
              setIsDeleteEdgeMode(!isDeleteEdgeMode);
              setDeleteEdgeFromId(null);
              setLinkingMode(false);
              setLinkingSourceId(null);
            }}
            style={{ backgroundColor: isDeleteEdgeMode ? '#ef4444' : '' }}
          >
            {isDeleteEdgeMode ? '❌ 退出删除连线' : '🗑️ 删除连线'}
          </button>
          <button disabled={isSimulating} onClick={clearCanvas}>🧹 清空画布</button>
        </div>

        <div className="btn-group">
          <h3>2. 运行垃圾回收</h3>
          <button disabled={isSimulating} onClick={runMarkSweep} style={{ backgroundColor: '#eab308' }}>
            ⚡ 运行：标记-清除 (Mark-Sweep)
          </button>
          <button disabled={isSimulating} onClick={runReferenceCounting} style={{ backgroundColor: '#f97316' }}>
            🔄 运行：引用计数 (Reference Counting)
          </button>
        </div>

        <div className="btn-group">
          <h3>3. 预设场景一键演示</h3>
          <button disabled={isSimulating} onClick={loadCircularPreset} style={{ backgroundColor: '#8b5cf6' }}>
            🌀 加载：循环引用缺陷场景
          </button>
        </div>

                {/* 当前模式指示器 */}
        <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
          backgroundColor: linkingMode ? '#3b82f6' : isDeleteEdgeMode ? '#ef4444' : isSimulating ? '#f97316' : '#1e293b',
          color: '#fff', border: '1px solid ' + (linkingMode || isDeleteEdgeMode || isSimulating ? 'transparent' : '#334155'),
          textAlign: 'center' }}>
          {isSimulating ? '⏳ 模拟运行中...' : 
           linkingMode ? '🔗 连线模式 — 点击两个节点建立引用' : 
           isDeleteEdgeMode ? '🗑️ 删除连线模式 — 点击两个节点删除引用' : 
           '🖱️ 默认模式 — 拖拽节点或选择操作'}
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          提示：
          <ol style={{ paddingLeft: '15px' }}>
            <li>点击"连线模式"按钮进入连线状态，然后依次点击两个节点建立引用。</li>
            <li>右键点击节点可快速删除节点及所有关联边。</li>
            <li>点击"删除连线"，再依次点击两个节点可删除边。</li>
            <li>你可以用鼠标自由拖拽节点排版。</li>
            <li>加载"循环引用"可以直观对比出两种垃圾回收算法的区别。</li>
          </ol>
        </div>
      </div>

      {/* 右侧画布 */}
      <div 
        className="canvas-container" 
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* 背景 SVG 负责画引用关系箭头 */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            {/* 定义箭头标，refX/refY 用于调节箭头相对节点中心的偏移（避免被圆圈遮挡） */}
            <marker id="arrow" viewBox="0 0 10 10" refX="60" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
            <marker id="arrow-highlight" viewBox="0 0 10 10" refX="60" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#eab308" />
            </marker>
          </defs>

          {edges.map(edge => {
            const source = nodes.find(n => n.id === edge.from);
            const target = nodes.find(n => n.id === edge.to);
            if (!source || !target) return null;

            // 如果源节点被标记高亮，则连线也高亮黄色
            const isHighlighted = source.state === 'marked';

            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? '#eab308' : '#334155'}
                strokeWidth={isHighlighted ? '3' : '2'}
                markerEnd={isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow)'}
              />
            );
          })}
        </svg>

        {/* 渲染内存对象 */}
        {nodes.map(node => (
          <div
            key={node.id}
            className={`node ${node.isRoot ? 'root-node' : ''} ${node.state === 'marked' ? 'marked-node' : ''} ${node.state === 'sweeping' ? 'sweeping-node' : ''} ${linkingSourceId === node.id ? 'linking-source' : ''} ${deleteEdgeFromId === node.id ? 'delete-target' : ''}`}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            onClick={() => handleNodeClick(node.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (isSimulating) return;
              // 右键删除该节点及所有关联边
              setNodes(prev => prev.filter(n => n.id !== node.id));
              setEdges(prev => prev.filter(e => e.from !== node.id && e.to !== node.id));
              if (linkingSourceId === node.id) setLinkingSourceId(null);
              if (deleteEdgeFromId === node.id) setDeleteEdgeFromId(null);
            }}
          >
            {/* 显示对象名称 */}
            <span>{node.name}</span>
            {/* 引用计数角标 */}
            {!node.isRoot && (
              <span className="ref-count-badge">rc: {node.refCount || 0}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;