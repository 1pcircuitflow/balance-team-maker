import React, { createContext, useContext } from 'react';
import { Player, Tier, Position } from '../types';
import { usePlayerActions } from '../hooks/usePlayerActions';
import { usePlayerContext } from './PlayerContext';
import { useNavigationContext } from './NavigationContext';

interface PlayerActionsContextValue {
  newName: string;
  setNewName: (v: string) => void;
  newTier: Tier;
  setNewTier: (v: Tier) => void;
  newP1s: Position[];
  setNewP1s: (v: Position[]) => void;
  newP2s: Position[];
  setNewP2s: (v: Position[]) => void;
  newP3s: Position[];
  setNewP3s: (v: Position[]) => void;
  newForbidden: Position[];
  setNewForbidden: (v: Position[]) => void;
  showNewPlayerFormation: boolean;
  setShowNewPlayerFormation: (v: boolean) => void;
  editingPlayerId: string | null;
  setEditingPlayerId: (v: string | null) => void;
  toastState: { isVisible: boolean; player: Player | null };
  setToastState: (v: { isVisible: boolean; player: Player | null }) => void;
  addPlayer: (e: React.FormEvent) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayerFromSystem: (e: React.MouseEvent, id: string) => void;
  toggleParticipation: (id: string) => void;
}

const PlayerActionsContext = createContext<PlayerActionsContextValue>(null!);

export const usePlayerActionsContext = () => useContext(PlayerActionsContext);

export const PlayerActionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { players, setPlayers } = usePlayerContext();
  const { activeTab } = useNavigationContext();

  const actions = usePlayerActions({ players, setPlayers, activeTab });

  return (
    <PlayerActionsContext.Provider value={actions}>
      {children}
    </PlayerActionsContext.Provider>
  );
};
