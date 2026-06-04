// src/App.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';
import levels from './levels/LevelData.js';

// 延时辅助函数：有了它，我们就可以用 async/await 编写带“暂停动画”的算法
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function App() {
  // --- 1. 关卡状态管理 ---
  const [currentLevel, setCurrentLevel] = useState(0); // 0: 沙盒, 1~6: 游戏关卡
  const [levelCompleted, setLevelCompleted] = useState(false);

  // 获取当前关卡数据
  const levelData = levels[currentLevel] || levels[0];

  // --- 2. 图结构核心状态 ---
  const [nodes, setNodes] = useState(() => levels[0].initialNodes.map(n => ({ ...n })));
  const [edges, setEdges] = useState(() => levels[0].initialEdges.map(e => ({ ...e })));

  // --- 3. 交互与编辑状态 ---
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [linkingMode, setLinkingMode] = useState(false);      // 连线模式开关
  const [linkingSourceId, setLinkingSourceId] = useState(null); // 用于连线：记录第一个点击的节点
  const [isDeleteEdgeMode, setIsDeleteEdgeMode] = useState(false); // 删除连线模式
  const [deleteEdgeFromId, setDeleteEdgeFromId] = useState(null);  // 删除连线：第一个选中节点
  const [isSimulating, setIsSimulating] = useState(false);      // 模拟运行时锁定界面按钮
    const canvasRef = useRef(null);
  const dragOccurred = useRef(false);    // 区分"点击"和"拖拽"：拖拽时不触发连线逻辑
  const nodeCounter = useRef(nodes.length); // 用于生成递增的节点名称

  // --- 4. 辅助图算法 ---
  // 获取当前节点指向的所有邻居（出度）
  const getNeighbors = (nodeId, currentEdges = edges) => {
    return currentEdges.filter(e => e.from === nodeId).map(e => e.to);
  };

    // 监听并动态更新每个节点的引用计数 (Reference Count)
  useEffect(() => {
    setNodes(prevNodes => 
      prevNodes.map(node => {
        if (node.isRoot) return node;
        const incoming = edges.filter(e => e.to === node.id).length;
        return { ...node, refCount: incoming };
      })
    );
  }, [edges]);

  // 计算当前活动内存总量
  const activeMemory = useMemo(() => {
    return nodes.reduce((sum, n) => sum + (n.size || 0), 0);
  }, [nodes]);

  // --- 5. 关卡切换逻辑 ---
  const handleLevelChange = (e) => {
    const newLevel = parseInt(e.target.value, 10);
    setCurrentLevel(newLevel);
    const level = levels[newLevel];
    setNodes(level.initialNodes.map(n => ({ ...n, state: 'idle', refCount: 0 })));
    setEdges(level.initialEdges.map(edge => ({ ...edge })));
    setLevelCompleted(false);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
    nodeCounter.current = level.initialNodes.length;
  };

  // 重置当前关卡
  const resetLevel = () => {
    const level = levels[currentLevel];
    setNodes(level.initialNodes.map(n => ({ ...n, state: 'idle', refCount: 0 })));
    setEdges(level.initialEdges.map(edge => ({ ...edge })));
    setLevelCompleted(false);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
  };

  // --- 6. 通关检测 ---
  const checkWinCondition = () => {
    if (currentLevel === 0) return;
    if (levelCompleted) return;
    const won = levelData.checkWin(nodes, edges);
    if (won) {
      setLevelCompleted(true);
    }
  };

  // 在 GC 运行完后检查通关条件
  useEffect(() => {
    if (!isSimulating && !levelCompleted) {
      const timer = setTimeout(checkWinCondition, 100);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, nodes.length]);

  // --- 7. 节点拖拽定位逻辑 ---
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

  // --- 8. 节点与引用关系的手动编辑 ---
      const addNode = () => {
    const id = 'obj_' + Date.now();
    nodeCounter.current += 1;
    const newNode = {
      id,
      name: `Obj_${nodeCounter.current}`,
      type: 'object',
      isRoot: false,
      x: 150 + Math.random() * 200,
      y: 150 + Math.random() * 200,
      size: 20 + Math.floor(Math.random() * 60),
      state: 'idle',
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

  // --- 9. 核心垃圾回收算法实现 ---

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

  // --- 10. 预设经典演示场景 ---
  const loadCircularPreset = () => {
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
    // 一键加载“循环引用”场景：Root 指向 A，而存在独立的 B 和 C 互相引用
        const presetNodes = [
      { id: 'root', name: 'Root', type: 'root', x: 100, y: 250, size: 0, isRoot: true, state: 'idle', refCount: 0 },
      { id: 'node_a', name: 'Obj_A', type: 'object', x: 260, y: 250, size: 30, isRoot: false, state: 'idle', refCount: 0 },
      { id: 'node_b', name: 'Obj_B', type: 'object', x: 450, y: 150, size: 30, isRoot: false, state: 'idle', refCount: 0 },
      { id: 'node_c', name: 'Obj_C', type: 'object', x: 450, y: 350, size: 30, isRoot: false, state: 'idle', refCount: 0 },
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
    setNodes([{ id: 'root', name: 'Root', type: 'root', x: 100, y: 250, size: 0, isRoot: true, state: 'idle', refCount: 0 }]);
    setEdges([]);
    setLinkingMode(false);
    setLinkingSourceId(null);
    setIsDeleteEdgeMode(false);
    setDeleteEdgeFromId(null);
  };

  // --- 8. 计算 Java 代码行状态 ---
  const getCodeLineClass = (line) => {
    if (line.alwaysNormal) return 'normal';
    if (line.activeEdge) {
      const edgeExists = edges.some(e => e.id === line.activeEdge);
      if (edgeExists) return 'active';
      return 'comment';
    }
    return 'normal';
  };

  const getCodeLineText = (line, lineClass) => {
    if (lineClass === 'comment' && line.commentText) {
      return line.commentText;
    }
    return line.text;
  };

  // 获取节点类型对应的 CSS 类名
  const getNodeTypeClass = (node) => {
    if (node.isRoot) return 'root-node';
    switch (node.type) {
      case 'dom': return 'dom-node';
      case 'purple': return 'purple-node';
      case 'root': return 'root-node';
      default: return 'object-node';
    }
  };

  const isGameLevel = currentLevel > 0;

    return (
    <div className="app-container">
      {/* ===== 左侧控制台 ===== */}
      <div className="control-panel">
        <h2 className="panel-title">GC Sandbox</h2>
        
        {/* 关卡选择器 */}
        <div className="level-selector">
          <label htmlFor="level-select">🎯 关卡选择</label>
          <select 
            id="level-select"
            value={currentLevel} 
            onChange={handleLevelChange}
            disabled={isSimulating}
          >
            {levels.map(level => (
              <option key={level.id} value={level.id}>
                {level.id === 0 ? level.name : `L${level.id}: ${level.name}`}
              </option>
            ))}
          </select>
        </div>

        {/* 关卡信息（非沙盒模式） */}
        {isGameLevel && (
          <div className="level-info">
            <h3>📌 {levelData.name}</h3>
            <p className="level-description">{levelData.description}</p>
            <p className="level-goal">🎯 目标：{levelData.goal}</p>
            {levelData.memoryLimit && (
              <p className="level-memory">💾 限制：活动内存 ≤ {levelData.memoryLimit} MB</p>
            )}
            <div className="memory-indicator" style={{ marginTop: '8px' }}>
              <span>当前内存</span>
              <span>
                <span className={`memory-value ${levelData.memoryLimit && activeMemory <= levelData.memoryLimit ? 'within-limit' : ''}`}>
                  {activeMemory} MB
                </span>
                {levelData.memoryLimit && (
                  <span className="memory-limit"> / {levelData.memoryLimit} MB</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* 通关徽章 */}
        {levelCompleted && (
          <div className="level-completed-badge">
            🏆 通关成功！内存泄漏已修复！
          </div>
        )}

        {/* 重置关卡 */}
        {isGameLevel && (
          <button 
            disabled={isSimulating} 
            onClick={resetLevel}
            style={{ backgroundColor: '#6b7280' }}
          >
            🔄 重置本关卡
          </button>
        )}

        {/* 画布编辑工具 */}
        <div className="btn-group">
          <h3>✏️ 画布编辑</h3>
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

        {/* GC 运行按钮 */}
        <div className="btn-group">
          <h3>⚡ 垃圾回收</h3>
          <button disabled={isSimulating} onClick={runMarkSweep} style={{ backgroundColor: '#eab308' }}>
            ⚡ 标记-清除 (Mark-Sweep)
          </button>
          <button disabled={isSimulating} onClick={runReferenceCounting} style={{ backgroundColor: '#f97316' }}>
            🔄 引用计数 (Reference Counting)
          </button>
          <button disabled={isSimulating} onClick={loadCircularPreset} style={{ backgroundColor: '#8b5cf6' }}>
            🌀 加载：循环引用缺陷场景
          </button>
        </div>

        {/* 模式指示器 */}
        <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold',
          backgroundColor: linkingMode ? '#3b82f6' : isDeleteEdgeMode ? '#ef4444' : isSimulating ? '#f97316' : '#1e293b',
          color: '#fff', border: '1px solid ' + (linkingMode || isDeleteEdgeMode || isSimulating ? 'transparent' : '#334155'),
          textAlign: 'center' }}>
          {isSimulating ? '⏳ 模拟运行中...' : 
           linkingMode ? '🔗 连线模式 — 点击两个节点建立引用' : 
           isDeleteEdgeMode ? '🗑️ 删除连线模式 — 依次点击两节点' : 
           isGameLevel ? `🎮 ${levelData.name} — 按目标操作` :
           '🖱️ 沙盒模式 — 自由编辑'}
        </div>

        {/* 提示 */}
        {!isGameLevel && (
          <div className="sandbox-hint">
            沙盒模式 — 自由编辑画布，运行 GC 算法观察效果
          </div>
        )}
        {isGameLevel && (
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            💡 提示：右键点击节点可快速删除（含关联边）
          </div>
        )}
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
            className={`node ${getNodeTypeClass(node)} ${node.state === 'marked' ? 'marked-node' : ''} ${node.state === 'sweeping' ? 'sweeping-node' : ''} ${linkingSourceId === node.id ? 'linking-source' : ''} ${deleteEdgeFromId === node.id ? 'delete-target' : ''}`}
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
            {/* 内存大小圆标 */}
            {node.size > 0 && (
              <span className="size-badge">{node.size}MB</span>
            )}
          </div>
        ))}
              {/* 画布水印 — 关卡模式提示 */}
        {isGameLevel && !levelCompleted && (
          <div style={{
            position: 'absolute', bottom: '16px', right: '16px',
            color: '#1f2937', fontSize: '12px', fontFamily: 'monospace',
            letterSpacing: '1px', userSelect: 'none', pointerEvents: 'none',
            opacity: 0.5
          }}>
            L{currentLevel}: {levelData.name}
          </div>
        )}
      </div>

      {/* ===== 右侧 Java 代码对照面板 ===== */}
      <div className="code-panel">
        <h3>
          📜 Java 代码对照
          <span className="code-lang-badge">JVM</span>
        </h3>
        
        {levelData.javaCode.length > 0 ? (
          <pre>
            <code>
              {levelData.javaCode.map((line, index) => {
                const lineClass = getCodeLineClass(line);
                const displayText = getCodeLineText(line, lineClass);
                return (
                  <span 
                    key={index}
                    className={`code-line ${lineClass}`}
                  >
                    <span className="code-line-number">{index + 1}</span>
                    {displayText}
                  </span>
                );
              })}
            </code>
          </pre>
        ) : (
          <div style={{ 
            color: '#4b5563', fontSize: '13px', textAlign: 'center', 
            padding: '40px 20px', border: '1px dashed #1f2937', borderRadius: '8px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '24px' }}>🛝</p>
            <p style={{ margin: '0' }}>沙盒模式 — 暂无 Java 代码对照</p>
            <p style={{ margin: '6px 0 0 0', fontSize: '11px' }}>选择一个关卡查看对应的泄漏场景源码</p>
          </div>
        )}

        {/* 图例说明 */}
        <div style={{ fontSize: '11px', color: '#4b5563', borderTop: '1px solid #1f2937', paddingTop: '10px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span><span style={{ color: '#fbbf24' }}>🟡 高亮</span> = 泄漏代码（连线未断）</span>
            <span><span style={{ color: '#4b5563', textDecoration: 'line-through' }}>⚪ 注释</span> = 已修复（连线已断）</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span><span style={{ color: '#10b981' }}>🟢 绿色</span> = GC Root</span>
            <span><span style={{ color: '#f97316' }}>🟠 橙色</span> = 事件源</span>
            <span><span style={{ color: '#8b5cf6' }}>🟣 紫色</span> = JVM 内部</span>
            <span><span style={{ color: '#475569' }}>⚫ 灰色</span> = 普通对象</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;