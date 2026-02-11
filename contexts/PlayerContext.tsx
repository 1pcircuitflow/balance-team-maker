import React, { createContext, useContext, useState, useEffect } from 'react';
import { Player } from '../types';
import { STORAGE_KEY } from '../constants';
import { SAMPLE_PLAYERS_BY_LANG } from '../sampleData';
import { savePlayersToCloud, loadPlayersFromCloud } from '../services/firebaseService';
import { useAppContext } from './AppContext';
import { useAuthContext } from './AuthContext';

interface PlayerContextValue {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  isDataLoaded: boolean;
  setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>;
}

const PlayerContext = createContext<PlayerContextValue>(null!);

export const usePlayerContext = () => useContext(PlayerContext);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useAppContext();
  const { user } = useAuthContext();

  const [players, setPlayers] = useState<Player[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const SAMPLE_DATA_VERSION = 'v4';
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem('app_sample_version');

    const isSampleData = (playerList: Player[]) => {
      if (!playerList || playerList.length === 0) return true;
      const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
      return playerList.every(p => sampleIdPattern.test(p.id));
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.length > 0) {
          if (isSampleData(parsed)) {
            if (storedVersion !== SAMPLE_DATA_VERSION) {
              setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
              localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
            } else {
              setPlayers(parsed);
            }
          } else {
            setPlayers(parsed);
          }
        } else {
          setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
          localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
        }
      } catch (e) {
        setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      }
    } else {
      setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
      setIsDataLoaded(true);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players]);

  // Cloud sync (debounced)
  useEffect(() => {
    if (isDataLoaded && user?.id && players.length > 0) {
      const timer = setTimeout(() => {
        savePlayersToCloud(user.id, players);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [players, user, isDataLoaded]);

  // Load from cloud on mount if logged in
  useEffect(() => {
    if (user?.id) {
      loadPlayersFromCloud(user.id).then(cloudPlayers => {
        if (cloudPlayers && cloudPlayers.length > 0) {
          setPlayers(cloudPlayers);
        }
        setIsDataLoaded(true);
      }).catch(() => {
        setIsDataLoaded(true);
      });
    }
  }, []);

  return (
    <PlayerContext.Provider value={{ players, setPlayers, isDataLoaded, setIsDataLoaded }}>
      {children}
    </PlayerContext.Provider>
  );
};
