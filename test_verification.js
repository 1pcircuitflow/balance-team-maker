
const { generateBalancedTeams } = require('./services/balanceService.ts');
// TypeScript 파일을 직접 실행하기 위해 ts-node 필요하지만, 
// 여기서는 간단히 로직만 복사해서 테스트하거나, 
// 현재 환경이 TS 실행 가능한지 확인. 
// node로 실행하려면 컴파일이 필요하므로, 
// 아까 만든 시뮬레이션용 파일에 로직을 복사해서 테스트하는게 빠름.

// 하지만 balanceService.ts는 이미 서비스 코드이므로, 
// 이를 import해서 쓰는건 설정상 복잡할 수 있음.
// 따라서 balanceService.ts 내용을 복사한 임시 테스트 파일을 만들어 실행.

const fs = require('fs');

// Mock data
const players = Array.from({ length: 15 }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    tier: 5,
    sportType: 'BASKETBALL',
    isActive: true,
    primaryPositions: ['PG'], // 선호
    secondaryPositions: [],
    tertiaryPositions: [],
    primaryPosition: 'PG',
    secondaryPosition: 'NONE',
    tertiaryPosition: 'NONE'
}));

// P1은 PG 불가능으로 설정 (테스트)
players[0].primaryPositions = [];
players[0].primaryPosition = 'NONE';
// P1에게 'C'만 가능하게 설정
players[0].secondaryPositions = ['C'];
players[0].secondaryPosition = 'C';

// 실행
// generateBalancedTeams는 export const ... 형태라 cjs에서 바로 require 안될 수 있음
// 따라서 아래에 balanceService 내용을 붙여넣고 실행
