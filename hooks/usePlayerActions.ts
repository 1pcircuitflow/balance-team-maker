import React, { useState, useCallback } from 'react';
import { Player, Tier, Position, SportType } from '../types';
import { AnalyticsService } from '../services/analyticsService';

interface UsePlayerActionsOptions {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  activeTab: SportType;
}

export const usePlayerActions = ({ players, setPlayers, activeTab }: UsePlayerActionsOptions) => {
  // Player form state
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<Tier>(Tier.B);
  const [newP1s, setNewP1s] = useState<Position[]>([]);
  const [newP2s, setNewP2s] = useState<Position[]>([]);
  const [newP3s, setNewP3s] = useState<Position[]>([]);
  const [newForbidden, setNewForbidden] = useState<Position[]>([]);
  const [showNewPlayerFormation, setShowNewPlayerFormation] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Toast
  const [toastState, setToastState] = useState<{ isVisible: boolean; player: Player | null; action?: 'add' | 'delete' }>({ isVisible: false, player: null });

  const addPlayer = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const player: Player = {
      id: crypto.randomUUID(), name: newName.trim(), tier: newTier,
      isActive: false, sportType: activeTab,
      primaryPosition: newP1s[0] || 'NONE', secondaryPosition: newP2s[0] || 'NONE', tertiaryPosition: newP3s[0] || 'NONE',
      primaryPositions: newP1s, secondaryPositions: newP2s, tertiaryPositions: newP3s, forbiddenPositions: newForbidden,
    };
    setPlayers(prev => [player, ...prev]);
    setNewName(''); setNewP1s([]); setNewP2s([]); setNewP3s([]); setNewForbidden([]);
    setShowNewPlayerFormation(false);
    setToastState({ isVisible: true, player, action: 'add' });
    AnalyticsService.logEvent('add_player', { sport: activeTab, tier: newTier });
  }, [newName, newTier, newP1s, newP2s, newP3s, newForbidden, activeTab, setPlayers]);

  const updatePlayer = useCallback((id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [setPlayers]);

  const removePlayerFromSystem = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const deletedPlayer = players.find(p => p.id === id);
    setPlayers(prev => prev.filter(p => p.id !== id));
    if (deletedPlayer) {
      setToastState({ isVisible: true, player: deletedPlayer, action: 'delete' });
    }
  }, [setPlayers, players]);

  const toggleParticipation = useCallback((id: string) => {
    if (editingPlayerId) return;
    const player = players.find(p => p.id === id);
    if (!player) return;
    const nextIsActive = !player.isActive;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isActive: nextIsActive } : p));
  }, [editingPlayerId, players, setPlayers]);

  return {
    // Form state
    newName, setNewName, newTier, setNewTier,
    newP1s, setNewP1s, newP2s, setNewP2s, newP3s, setNewP3s,
    newForbidden, setNewForbidden,
    showNewPlayerFormation, setShowNewPlayerFormation,
    editingPlayerId, setEditingPlayerId,
    // Toast state
    toastState, setToastState,
    // Actions
    addPlayer, updatePlayer, removePlayerFromSystem, toggleParticipation,
  };
};
