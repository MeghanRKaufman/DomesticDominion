import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const TalentTree = ({ currentUser, onTalentSelected }) => {
  const [talentTree, setTalentTree] = useState(null);
  const [userTalents, setUserTalents] = useState(null);
  const [selectedSpec, setSelectedSpec] = useState('self_care');
  const [hoveredTalent, setHoveredTalent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomSelectionModal, setRoomSelectionModal] = useState(null);

  useEffect(() => {
    loadTalentData();
  }, [currentUser]);

  const loadTalentData = async () => {
    try {
      setLoading(true);
      
      // Fetch talent tree structure
      const treeResponse = await axios.get(`${API}/talents/tree`);
      setTalentTree(treeResponse.data);
      
      // Fetch user's talents
      if (currentUser?.userId) {
        const userResponse = await axios.get(`${API}/talents/user/${currentUser.userId}`);
        setUserTalents(userResponse.data);
      }
    } catch (error) {
      console.error('Error loading talent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTalentClick = async (talent, specKey) => {
    if (!canSelectTalent(talent, specKey)) {
      return;
    }

    // Check if room selection is needed
    if (talent.effect_type === 'room_preference' && !currentUser.chosenRoom) {
      setRoomSelectionModal({ talent, specKey });
      return;
    }

    await selectTalent(talent.id, specKey);
  };

  const selectTalent = async (talentId, specKey, chosenRoom = null) => {
    try {
      const response = await axios.post(`${API}/talents/select`, {
        userId: currentUser.userId,
        talentId: talentId,
        chosenRoom: chosenRoom
      });

      if (response.data.success) {
        // Reload talent data
        await loadTalentData();
        
        // Notify parent component
        if (onTalentSelected) {
          onTalentSelected(response.data);
        }
        
        alert(`✅ ${response.data.message}`);
      }
    } catch (error) {
      console.error('Error selecting talent:', error);
      alert(`❌ ${error.response?.data?.detail || 'Failed to select talent'}`);
    }
  };

  const handleRespec = async () => {
    if (!window.confirm('Reset all talents for 10,000 XP?')) {
      return;
    }

    try {
      const response = await axios.post(`${API}/talents/respec`, {
        userId: currentUser.userId
      });

      if (response.data.success) {
        await loadTalentData();
        alert('✅ Talents reset successfully!');
      }
    } catch (error) {
      console.error('Error respeccing:', error);
      alert(`❌ ${error.response?.data?.detail || 'Failed to reset talents'}`);
    }
  };

  const canSelectTalent = (talent, specKey) => {
    if (!userTalents) return false;

    // Check if already selected
    if (userTalents.selectedTalents?.includes(talent.id)) {
      return false;
    }

    // Check if enough points
    if (userTalents.talentPointsAvailable < (talent.cost || 1)) {
      return false;
    }

    // Check level requirement
    if (specKey !== 'hybrid' && talentTree) {
      const spec = talentTree.talents[specKey];
      for (const [tierNum, tierData] of Object.entries(spec.tiers)) {
        const talentInTier = tierData.talents.find(t => t.id === talent.id);
        if (talentInTier && currentUser.level < tierData.level_required) {
          return false;
        }
      }
    }

    // Check capstone exclusivity
    if (talent.is_capstone && userTalents.capstone) {
      return false;
    }

    return true;
  };

  const getTalentState = (talent) => {
    if (!userTalents) return 'locked';
    
    if (userTalents.selectedTalents?.includes(talent.id)) {
      return 'selected';
    }
    
    if (canSelectTalent(talent, selectedSpec)) {
      return 'available';
    }
    
    return 'locked';
  };

  const getTalentColor = (state) => {
    switch (state) {
      case 'selected':
        return 'bg-gradient-to-br from-yellow-400 to-orange-500 border-yellow-600 shadow-lg';
      case 'available':
        return 'bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 border-green-700 cursor-pointer';
      case 'locked':
        return 'bg-gray-400 border-gray-500 opacity-50 cursor-not-allowed';
      default:
        return 'bg-gray-300 border-gray-400';
    }
  };

  const RoomSelectionModal = () => {
    const rooms = ['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Laundry Room', 'Garage', 'Office'];
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Choose Your Specialization Room</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Select the room you want to specialize in for the "{roomSelectionModal.talent.name}" talent:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {rooms.map(room => (
                <Button
                  key={room}
                  variant="outline"
                  className="h-16"
                  onClick={async () => {
                    await selectTalent(roomSelectionModal.talent.id, roomSelectionModal.specKey, room);
                    setRoomSelectionModal(null);
                  }}
                >
                  {room}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => setRoomSelectionModal(null)}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading || !talentTree || !userTalents) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">🌳</div>
          <p className="text-gray-600">Loading talent tree...</p>
        </div>
      </div>
    );
  }

  const specs = ['self_care', 'housework', 'teamwork'];
  const currentSpec = talentTree.talents[selectedSpec];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-purple-900 to-slate-900 p-4">
      {roomSelectionModal && <RoomSelectionModal />}
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gradient-to-r from-purple-900/80 to-blue-900/80 rounded-xl border-2 border-purple-500 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🌳 Talent Tree</h1>
              <p className="text-purple-200">Customize your household expertise</p>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-yellow-400">
                ⭐ {userTalents.talentPointsAvailable} Points Available
              </div>
              <div className="text-sm text-purple-200 mt-1">
                Level {userTalents.level} • {userTalents.talentPointsSpent}/{userTalents.talentPointsTotal} Spent
              </div>
              {userTalents.capstone && (
                <div className="text-xs text-yellow-300 mt-1">
                  🏆 Capstone: {userTalents.capstone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spec Selector */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-3 gap-4">
          {specs.map(specKey => {
            const spec = talentTree.talents[specKey];
            const isSelected = selectedSpec === specKey;
            
            return (
              <button
                key={specKey}
                onClick={() => setSelectedSpec(specKey)}
                className={`p-6 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 border-yellow-400 shadow-lg scale-105'
                    : 'bg-gray-800/50 border-gray-600 hover:border-purple-400'
                }`}
              >
                <div className="text-5xl mb-3">{spec.icon}</div>
                <div className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                  {spec.name}
                </div>
                <div className={`text-sm mt-2 ${isSelected ? 'text-purple-100' : 'text-gray-400'}`}>
                  {spec.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Talent Tree Display */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900/50 rounded-xl border-2 border-purple-500 p-6">
          {/* Tiers */}
          <div className="space-y-8">
            {Object.entries(currentSpec.tiers).map(([tierNum, tierData]) => {
              const isLocked = currentUser.level < tierData.level_required;
              
              return (
                <div key={tierNum} className="relative">
                  {/* Tier Header */}
                  <div className={`flex items-center gap-4 mb-4 ${isLocked ? 'opacity-50' : ''}`}>
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg px-4 py-2 border-2 border-purple-400">
                      <div className="text-white font-bold">Tier {tierNum}</div>
                      <div className="text-xs text-purple-200">{tierData.name}</div>
                    </div>
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></div>
                    <div className={`text-sm ${isLocked ? 'text-red-400' : 'text-green-400'}`}>
                      {isLocked ? `🔒 Level ${tierData.level_required} Required` : '✓ Unlocked'}
                    </div>
                  </div>

                  {/* Talents in this tier */}
                  <div className="grid grid-cols-2 gap-4">
                    {tierData.talents.map(talent => {
                      const state = getTalentState(talent);
                      const colorClass = getTalentColor(state);
                      
                      return (
                        <div
                          key={talent.id}
                          className="relative"
                          onMouseEnter={() => setHoveredTalent(talent)}
                          onMouseLeave={() => setHoveredTalent(null)}
                        >
                          <button
                            onClick={() => handleTalentClick(talent, selectedSpec)}
                            disabled={state === 'locked' || state === 'selected'}
                            className={`w-full p-4 rounded-xl border-2 transition-all ${colorClass}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-lg font-bold text-white text-left">
                                {talent.name}
                              </div>
                              <div className="text-2xl">
                                {state === 'selected' ? '✓' : talent.cost === 2 ? '🏆' : '⭐'}
                              </div>
                            </div>
                            <div className="text-sm text-white/90 text-left line-clamp-2">
                              {talent.description}
                            </div>
                            <div className="text-xs text-white/70 mt-2 text-right">
                              Cost: {talent.cost} {talent.cost === 1 ? 'point' : 'points'}
                            </div>
                          </button>

                          {/* Hover Tooltip */}
                          {hoveredTalent?.id === talent.id && (
                            <div className="absolute z-10 left-full ml-4 top-0 w-80 bg-gray-900 border-2 border-purple-400 rounded-lg p-4 shadow-2xl">
                              <div className="text-xl font-bold text-yellow-400 mb-2">
                                {talent.name}
                              </div>
                              <div className="text-sm text-gray-300 mb-3">
                                {talent.description}
                              </div>
                              <div className="border-t border-gray-700 pt-2 space-y-1 text-xs">
                                <div className="text-purple-300">
                                  <span className="font-semibold">Cost:</span> {talent.cost} talent {talent.cost === 1 ? 'point' : 'points'}
                                </div>
                                <div className="text-blue-300">
                                  <span className="font-semibold">Effect:</span> {talent.effect_type.replace(/_/g, ' ')}
                                </div>
                                {talent.is_capstone && (
                                  <div className="text-yellow-300 font-semibold">
                                    🏆 CAPSTONE TALENT (Exclusive)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hybrid Talents Section */}
          {selectedSpec === 'self_care' && talentTree.talents.hybrid && (
            <div className="mt-8 pt-8 border-t-2 border-purple-500">
              <div className="mb-4">
                <div className="text-2xl font-bold text-white mb-2">
                  🌈 Hybrid Talents
                </div>
                <div className="text-sm text-purple-300">
                  Unlock after reaching Tier 3 in two different specs
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {talentTree.talents.hybrid.talents.map(talent => {
                  const state = getTalentState(talent);
                  const colorClass = getTalentColor(state);
                  
                  return (
                    <button
                      key={talent.id}
                      onClick={() => handleTalentClick(talent, 'hybrid')}
                      disabled={state === 'locked' || state === 'selected'}
                      className={`p-4 rounded-xl border-2 transition-all ${colorClass}`}
                    >
                      <div className="text-lg font-bold text-white mb-2">
                        {talent.name}
                      </div>
                      <div className="text-xs text-white/80 mb-2">
                        {talent.description}
                      </div>
                      <div className="text-xs text-white/60">
                        Requires: {talent.requires_specs.map(s => s.replace('_', ' ')).join(' + ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Respec Button */}
      <div className="max-w-7xl mx-auto mt-6">
        <Button
          onClick={handleRespec}
          disabled={userTalents.talentPointsSpent === 0}
          variant="outline"
          className="w-full h-16 text-lg border-red-500 hover:bg-red-900/20"
        >
          🔄 Reset Talents (10,000 XP)
        </Button>
      </div>
    </div>
  );
};

export default TalentTree;
