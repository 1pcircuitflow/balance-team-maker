
export enum Tier {
  S = 5,
  A = 4,
  B = 3,
  C = 2,
  D = 1
}

export enum SportType {
  GENERAL = 'GENERAL',
  SOCCER = 'SOCCER',
  FUTSAL = 'FUTSAL',
  BASKETBALL = 'BASKETBALL'
}

export type SoccerPosition = 'FW' | 'LW' | 'RW' | 'MF' | 'DF' | 'LB' | 'RB' | 'GK' | 'NONE';
export type FutsalPosition = 'PIV' | 'ALA' | 'FIX' | 'GK' | 'NONE';
export type BasketballPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'NONE';
export type Position = SoccerPosition | FutsalPosition | BasketballPosition;

export interface Player {
  id: string;
  name: string;
  tier: Tier;
  isActive: boolean;
  sportType: SportType;
  primaryPosition?: Position;
  secondaryPosition?: Position;
  tertiaryPosition?: Position;
  forbiddenPositions?: Position[];
  // New Array-based fields for multi-selection support
  primaryPositions?: Position[];
  secondaryPositions?: Position[];
  tertiaryPositions?: Position[];
  assignedPosition?: Position;
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
  totalSkill: number;
  color?: string;
  colorName?: string;
}

export type ConstraintType = 'MATCH' | 'SPLIT';

export interface TeamConstraint {
  id: string;
  playerIds: string[];
  type: ConstraintType;
}

export interface BalanceResult {
  teams: Team[];
  standardDeviation: number;
  imbalanceScore?: number;
  hash?: string;
  maxDiff?: number;
  isValid?: boolean;
  isConstraintViolated?: boolean;
  isQuotaViolated?: boolean;
}
