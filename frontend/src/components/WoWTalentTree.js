import React, { useState } from 'react';
import { Button } from './ui/button';

// WoW-Style Talent Tree Component
const WoWTalentTree = ({ currentUser, talentNodes, onNodeUnlock }) => {
  const [selectedBranch, setSelectedBranch] = useState('Housekeeping');
  const [hoveredNode, setHoveredNode] = useState(null);

  const branches = {
    'Housekeeping': { icon: '🏡', color: 'green', name: 'Housekeeping Heroes' },
    'Coupling': { icon: '💕', color: 'pink', name: 'Team Connection' },
    'Growth': { icon: '🌱', color: 'blue', name: 'Personal Evolution' }
  };

  const unlockedNodes = currentUser?.talentBuild?.nodeIds || [];
  const availableTalentPoints = currentUser?.talentPoints || 0;

  // Safety check for talentNodes
  if (!talentNodes || typeof talentNodes !== 'object' || Object.keys(talentNodes).length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 rounded-2xl p-6 text-white min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-6xl mb-4">🌳</div>
            <h2 className="text-2xl font-bold mb-2">Loading Talent Tree...</h2>
            <p className="text-gray-400">Preparing your talents</p>
          </div>
        </div>
      </div>
    );
  }

  // Get nodes for current branch
  const getBranchNodes = (branch) => {
    try {
      const nodes = Object.values(talentNodes).filter(node => node && node.branch === branch);
      return nodes || [];
    } catch (e) {
      console.error('Error getting branch nodes:', e);
      return [];
    }
  };

  // Position nodes in WoW-style grid (4 tiers, 4 columns)
  const getNodePosition = (node) => {
    if (!node || !node.tier) return { left: '50%', top: '0px' };
    
    const tier = node.tier;
    const nodesInTier = getBranchNodes(selectedBranch).filter(n => n && n.tier === tier);
    const indexInTier = nodesInTier.indexOf(node);
    const totalInTier = nodesInTier.length;
    
    // Center nodes in their tier
    const columnSpacing = 100 / (totalInTier + 1);
    const left = columnSpacing * (indexInTier + 1);
    const top = (tier - 1) * 120 + 20;
    
    return { left: `${left}%`, top: `${top}px` };
  };

  const isNodeUnlocked = (nodeId) => unlockedNodes.includes(nodeId);
  
  const arePrereqsMet = (node) => {
    if (!node) return false;
    const prereqs = node.prereqs || node.prerequisites || [];
    if (prereqs.length === 0) return true;
    return prereqs.every(prereqId => isNodeUnlocked(prereqId));
  };
  
  const canUnlockNode = (node) => {
    if (!node || !node.cost) return false;
    return availableTalentPoints >= node.cost && 
           !isNodeUnlocked(node.id) && 
           arePrereqsMet(node);
  };

  const getNodeStyle = (node) => {
    const unlocked = isNodeUnlocked(node.id);
    const canUnlock = canUnlockNode(node);
    const prereqsMet = arePrereqsMet(node);
    
    if (unlocked) {
      return {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        border: '3px solid #34d399',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
        cursor: 'default'
      };
    }
    if (canUnlock) {
      return {
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        border: '3px solid #60a5fa',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)',
        cursor: 'pointer',
        animation: 'pulse 2s infinite'
      };
    }
    if (!prereqsMet) {
      return {
        background: '#1f2937',
        border: '2px solid #374151',
        opacity: 0.3,
        cursor: 'not-allowed'
      };
    }
    return {
      background: '#374151',
      border: '2px solid #4b5563',
      opacity: 0.6,
      cursor: 'not-allowed'
    };
  };

  // Draw connection lines between nodes
  const renderConnections = () => {
    const nodes = getBranchNodes(selectedBranch);
    const lines = [];
    
    try {
      nodes.forEach(node => {
        if (!node) return;
        
        const prereqs = node.prereqs || node.prerequisites || [];
        
        prereqs.forEach(prereqId => {
          const prereqNode = nodes.find(n => n && n.id === prereqId);
          if (prereqNode) {
            const nodePos = getNodePosition(node);
            const prereqPos = getNodePosition(prereqNode);
            
            // Convert percentages to pixels for SVG
            const x1 = prereqPos.left;
            const y1 = prereqPos.top;
            const x2 = nodePos.left;
            const y2 = nodePos.top;
            
            lines.push(
              <line
                key={`${prereqId}-${node.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isNodeUnlocked(prereqId) ? '#10b981' : '#4b5563'}
                strokeWidth="3"
                opacity={isNodeUnlocked(prereqId) ? 1 : 0.3}
              />
            );
          }
        });
      });
    } catch (e) {
      console.error('Error rendering connections:', e);
    }
    
    return lines;
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 rounded-2xl p-6 text-white min-h-screen">
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold">🌳 Talent Trees</h2>
        <div className="bg-black/40 px-6 py-3 rounded-lg border-2 border-yellow-400">
          <span className="text-yellow-400 text-2xl font-bold">💎 {availableTalentPoints}</span>
          <span className="text-sm ml-2">Talent Points</span>
        </div>
      </div>

      {/* Branch Tabs */}
      <div className="flex gap-4 mb-8">
        {Object.entries(branches).map(([key, branch]) => (
          <button
            key={key}
            onClick={() => setSelectedBranch(key)}
            className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
              selectedBranch === key
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg scale-105'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <div className="text-3xl mb-1">{branch.icon}</div>
            {branch.name}
          </button>
        ))}
      </div>

      {/* Talent Tree Canvas */}
      <div className="relative bg-black/30 rounded-xl p-8 min-h-[600px]">
        {/* Tier Labels */}
        <div className="absolute left-4 top-8 space-y-[110px]">
          <div className="text-yellow-400 font-bold text-sm">TIER 1</div>
          <div className="text-yellow-400 font-bold text-sm">TIER 2</div>
          <div className="text-yellow-400 font-bold text-sm">TIER 3</div>
          <div className="text-yellow-400 font-bold text-sm">CAPSTONE</div>
        </div>

        {/* Connection Lines - SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {renderConnections()}
        </svg>

        {/* Talent Nodes */}
        {getBranchNodes(selectedBranch).map(node => {
          if (!node || !node.id) return null;
          
          const position = getNodePosition(node);
          const style = getNodeStyle(node);
          const unlocked = isNodeUnlocked(node.id);
          const canUnlock = canUnlockNode(node);
          
          return (
            <div
              key={node.id}
              className="absolute transform -translate-x-1/2"
              style={position}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <div
                onClick={() => canUnlock && onNodeUnlock && onNodeUnlock(node.id)}
                className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl transition-all relative"
                style={style}
              >
                {unlocked && <span className="absolute -top-2 -right-2 text-2xl">✓</span>}
                <span>{node.icon || getTierIcon(node.tier || 1)}</span>
              </div>
              
              <div className="text-center mt-2">
                <div className="text-xs font-bold">{node.name || 'Unknown'}</div>
                <div className="text-xs text-yellow-400">💎 {node.cost || 0}</div>
              </div>
            </div>
          );
        })}

        {/* Tooltip */}
        {hoveredNode && (
          <div 
            className="fixed z-50 bg-black/95 border-2 border-purple-400 rounded-lg p-4 max-w-sm shadow-2xl"
            style={{ 
              left: '50%', 
              top: '50%', 
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          >
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              {getTierIcon(hoveredNode.tier)} {hoveredNode.name}
            </h3>
            <p className="text-sm text-gray-300 mb-3">{hoveredNode.description}</p>
            <div className="text-sm">
              <div className="text-purple-300">Effect: {hoveredNode.scope}</div>
              <div className="text-green-300">Value: {hoveredNode.value}</div>
              <div className="text-yellow-400 mt-2 font-bold">Cost: 💎 {hoveredNode.cost}</div>
            </div>
            {hoveredNode.prereqs.length > 0 && (
              <div className="mt-3 text-xs text-gray-400">
                Requires: {hoveredNode.prereqs.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-black/30 rounded-lg p-4">
        <h4 className="font-bold mb-3">🎯 Legend</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-green-600 to-green-700 border-2 border-green-400"></div>
            <span>Unlocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-purple-600 border-2 border-blue-400"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-700 border-2 border-gray-600 opacity-50"></div>
            <span>Locked</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const getTierIcon = (tier) => {
  const icons = { 1: '🥉', 2: '🥈', 3: '🥇', 4: '👑' };
  return icons[tier] || '⭐';
};

export default WoWTalentTree;
