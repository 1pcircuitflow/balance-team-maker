
export enum Tier {
  S = 5,
  A = 4,
  B = 3,
  C = 2,
  D = 1
}

export enum SportType {
  ALL = 'ALL',
  GENERAL = 'GENERAL',
  SOCCER = 'SOCCER',
  FUTSAL = 'FUTSAL',
  BASKETBALL = 'BASKETBALL'
}

export type SoccerPosition = 'ST' | 'LW' | 'RW' | 'MF' | 'DF' | 'LB' | 'RB' | 'GK' | 'NONE';
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
  positionSatisfaction?: number;
  hash?: string;
  maxDiff?: number;
  isValid?: boolean;
  isConstraintViolated?: boolean;
  isQuotaViolated?: boolean;
  positionWarning?: boolean;
  noneAssignedCount?: number;
  createdAt?: string;
}

export enum BottomTabType {
  HOME = 'HOME',
  MEMBERS = 'MEMBERS',
  SETTINGS = 'SETTINGS'
}

export enum AppPageType {
  HOME = 'HOME',
  DETAIL = 'DETAIL',
  EDIT_ROOM = 'EDIT_ROOM',
  BALANCE = 'BALANCE'
}

export enum DetailPageTab {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  TEAM_RESULT = 'TEAM_RESULT'
}

export interface VenueData {
  placeId: string;       // 카카오 장소 ID
  placeName: string;     // 장소 이름
  address: string;       // 주소
  lat: number;           // 위도
  lng: number;           // 경도
  photoUrl?: string;     // Firebase Storage URL
}

export interface UserSportProfile {
  tier: string;
  primaryPositions: string[];
  secondaryPositions: string[];
  tertiaryPositions: string[];
  forbiddenPositions: string[];
}

export interface UserProfile {
  sports: Partial<Record<SportType, UserSportProfile>>;
  onboardingComplete: boolean;
}
