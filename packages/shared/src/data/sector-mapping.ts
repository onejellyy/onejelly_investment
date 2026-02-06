/**
 * Peer Group 매핑 (점수 계산용)
 *
 * - KRX 업종은 "표시용"으로만 사용
 * - 점수 계산은 Peer Group 기준으로 수행
 * - 자동 매핑 기본, 수동 오버라이드 허용
 * - 룰 기반 (AI 사용 금지)
 */

// ============================================
// Peer Group 정의
// ============================================

export const PEER_GROUPS = {
  SEMI: { code: 'SEMI', name: '반도체', description: '반도체 설계, 제조, 장비' },
  IT_SW: { code: 'IT_SW', name: 'IT/소프트웨어', description: '소프트웨어, 인터넷, 플랫폼' },
  BIO: { code: 'BIO', name: '바이오/헬스케어', description: '제약, 바이오, 의료기기' },
  AUTO: { code: 'AUTO', name: '자동차/부품', description: '완성차, 자동차 부품' },
  CHEM: { code: 'CHEM', name: '화학/에너지', description: '화학, 정유, 2차전지' },
  SHIP: { code: 'SHIP', name: '조선/해운', description: '조선, 해운, 중공업' },
  STEEL: { code: 'STEEL', name: '철강/금속', description: '철강, 비철금속' },
  CONST: { code: 'CONST', name: '건설/건자재', description: '건설, 시멘트, 건자재' },
  BANK: { code: 'BANK', name: '은행/보험', description: '은행, 보험, 카드' },
  SEC: { code: 'SEC', name: '증권/금융', description: '증권, 자산운용' },
  RETAIL: { code: 'RETAIL', name: '유통/소매', description: '백화점, 마트, 이커머스' },
  FOOD: { code: 'FOOD', name: '음식료', description: '식품, 음료' },
  TELCO: { code: 'TELCO', name: '통신', description: '이동통신, 유선통신' },
  UTIL: { code: 'UTIL', name: '전력/가스', description: '전력, 가스, 유틸리티' },
  MEDIA: { code: 'MEDIA', name: '미디어/엔터', description: '방송, 게임, 엔터테인먼트' },
  TRANS: { code: 'TRANS', name: '운송/물류', description: '항공, 육운, 물류' },
  MACH: { code: 'MACH', name: '기계/장비', description: '산업기계, 전기장비' },
  OTHER: { code: 'OTHER', name: '기타', description: '분류 미정' },
} as const;

export type PeerGroupCode = keyof typeof PEER_GROUPS;

// ============================================
// 기본 Peer Group 매핑 (MVP용)
// ============================================

export interface PeerMapping {
  peer_code: PeerGroupCode;
  peer_name: string;
}

export const STOCK_PEER_MAPPING: Record<string, PeerMapping> = {
  // 반도체
  '005930': { peer_code: 'SEMI', peer_name: '반도체' }, // 삼성전자
  '000660': { peer_code: 'SEMI', peer_name: '반도체' }, // SK하이닉스

  // IT/소프트웨어
  '035720': { peer_code: 'IT_SW', peer_name: 'IT/소프트웨어' }, // 카카오
  '035420': { peer_code: 'IT_SW', peer_name: 'IT/소프트웨어' }, // NAVER
  '263750': { peer_code: 'IT_SW', peer_name: 'IT/소프트웨어' }, // 펄어비스
  '112040': { peer_code: 'IT_SW', peer_name: 'IT/소프트웨어' }, // 위메이드

  // 바이오/헬스케어
  '068270': { peer_code: 'BIO', peer_name: '바이오/헬스케어' }, // 셀트리온
  '207940': { peer_code: 'BIO', peer_name: '바이오/헬스케어' }, // 삼성바이오로직스
  '091990': { peer_code: 'BIO', peer_name: '바이오/헬스케어' }, // 셀트리온헬스케어
  '326030': { peer_code: 'BIO', peer_name: '바이오/헬스케어' }, // SK바이오팜

  // 자동차/부품
  '005380': { peer_code: 'AUTO', peer_name: '자동차/부품' }, // 현대차
  '000270': { peer_code: 'AUTO', peer_name: '자동차/부품' }, // 기아
  '012330': { peer_code: 'AUTO', peer_name: '자동차/부품' }, // 현대모비스

  // 화학/에너지
  '051910': { peer_code: 'CHEM', peer_name: '화학/에너지' }, // LG화학
  '096770': { peer_code: 'CHEM', peer_name: '화학/에너지' }, // SK이노베이션
  '006400': { peer_code: 'CHEM', peer_name: '화학/에너지' }, // 삼성SDI
  '373220': { peer_code: 'CHEM', peer_name: '화학/에너지' }, // LG에너지솔루션

  // 조선/해운
  '009540': { peer_code: 'SHIP', peer_name: '조선/해운' }, // 한국조선해양
  '010140': { peer_code: 'SHIP', peer_name: '조선/해운' }, // 삼성중공업
  '042660': { peer_code: 'SHIP', peer_name: '조선/해운' }, // 대우조선해양
  '011200': { peer_code: 'SHIP', peer_name: '조선/해운' }, // HMM

  // 철강/금속
  '005490': { peer_code: 'STEEL', peer_name: '철강/금속' }, // POSCO홀딩스

  // 건설
  '000720': { peer_code: 'CONST', peer_name: '건설/건자재' }, // 현대건설
  '028260': { peer_code: 'CONST', peer_name: '건설/건자재' }, // 삼성물산

  // 은행/보험
  '105560': { peer_code: 'BANK', peer_name: '은행/보험' }, // KB금융
  '055550': { peer_code: 'BANK', peer_name: '은행/보험' }, // 신한지주
  '086790': { peer_code: 'BANK', peer_name: '은행/보험' }, // 하나금융지주
  '316140': { peer_code: 'BANK', peer_name: '은행/보험' }, // 우리금융지주

  // 증권/금융
  '033780': { peer_code: 'SEC', peer_name: '증권/금융' }, // KT&G
  '032830': { peer_code: 'SEC', peer_name: '증권/금융' }, // 삼성생명

  // 유통/소매
  '004990': { peer_code: 'RETAIL', peer_name: '유통/소매' }, // 롯데지주
  '139480': { peer_code: 'RETAIL', peer_name: '유통/소매' }, // 이마트

  // 음식료
  '097950': { peer_code: 'FOOD', peer_name: '음식료' }, // CJ제일제당
  '271560': { peer_code: 'FOOD', peer_name: '음식료' }, // 오리온

  // 통신
  '017670': { peer_code: 'TELCO', peer_name: '통신' }, // SK텔레콤
  '030200': { peer_code: 'TELCO', peer_name: '통신' }, // KT
  '032640': { peer_code: 'TELCO', peer_name: '통신' }, // LG유플러스

  // 전력/가스
  '015760': { peer_code: 'UTIL', peer_name: '전력/가스' }, // 한국전력

  // 미디어/엔터
  '352820': { peer_code: 'MEDIA', peer_name: '미디어/엔터' }, // 하이브
  '041510': { peer_code: 'MEDIA', peer_name: '미디어/엔터' }, // SM
  '035900': { peer_code: 'MEDIA', peer_name: '미디어/엔터' }, // JYP Ent.
  '122870': { peer_code: 'MEDIA', peer_name: '미디어/엔터' }, // YG Ent.
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 종목코드로 Peer Group 조회
 */
export function getPeerForStock(stockCode: string): PeerMapping {
  return STOCK_PEER_MAPPING[stockCode] || { peer_code: 'OTHER', peer_name: '기타' };
}

/**
 * Peer Group 내 모든 종목 조회
 */
export function getStocksInPeerGroup(peerCode: PeerGroupCode): string[] {
  return Object.entries(STOCK_PEER_MAPPING)
    .filter(([_, info]) => info.peer_code === peerCode)
    .map(([stockCode]) => stockCode);
}

/**
 * Peer Group 정보 조회
 */
export function getPeerGroupInfo(peerCode: PeerGroupCode): (typeof PEER_GROUPS)[PeerGroupCode] {
  return PEER_GROUPS[peerCode] || PEER_GROUPS.OTHER;
}

/**
 * 모든 Peer Group 목록
 */
export function getAllPeerGroups(): (typeof PEER_GROUPS)[PeerGroupCode][] {
  return Object.values(PEER_GROUPS);
}

// ============================================
// 업종 → Peer Group 자동 매핑 룰
// ============================================

export const INDUSTRY_TO_PEER_RULES: Record<string, PeerGroupCode> = {
  // KRX 업종코드 → Peer Group
  G25: 'SEMI', // 반도체
  G26: 'SEMI', // 전자부품
  G27: 'IT_SW', // 정보기기
  G28: 'IT_SW', // 소프트웨어
  G29: 'IT_SW', // 인터넷
  G31: 'BIO', // 제약
  G32: 'BIO', // 바이오
  G35: 'AUTO', // 자동차
  G36: 'AUTO', // 자동차부품
  G41: 'CHEM', // 화학
  G42: 'CHEM', // 정유
  G45: 'STEEL', // 철강
  G51: 'CONST', // 건설
  G61: 'BANK', // 은행
  G62: 'SEC', // 증권
  G63: 'BANK', // 보험
  G71: 'RETAIL', // 유통
  G72: 'FOOD', // 음식료
  G81: 'TELCO', // 통신
  G82: 'MEDIA', // 미디어
};

/**
 * 업종코드로 Peer Group 자동 매핑
 */
export function mapIndustryToPeer(industryCode: string): PeerGroupCode {
  return INDUSTRY_TO_PEER_RULES[industryCode] || 'OTHER';
}
