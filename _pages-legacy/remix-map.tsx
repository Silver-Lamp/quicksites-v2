'use client';
import ReactFlow, { Background, Controls } from 'reactflow';
import { json } from '@/lib/api/json';
import 'reactflow/dist/style.css';
import { useEffect, useState } from 'react';

export default function RemixMap() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    fetch('/api/remix-dag')
      .then((res) => res.json())
      .then(({ nodes, edges }) => {
        setNodes(nodes);
        setEdges(edges);
      });
  }, []);

  return (
    <div className="h-screen bg-zinc-900 text-white">
      <h1 className="text-2xl font-bold p-4">🌐 Remix DAG</h1>
      <div className="h-[90%]">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
