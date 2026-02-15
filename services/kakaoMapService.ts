
const KAKAO_REST_API_KEY = (import.meta as any).env?.VITE_KAKAO_REST_API_KEY || process.env.KAKAO_REST_API_KEY || '';

export interface KakaoPlace {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // lng
  y: string; // lat
  category_group_name: string;
}

interface KakaoSearchResponse {
  documents: KakaoPlace[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

/**
 * 카카오 키워드 장소 검색
 */
export const searchPlaces = async (keyword: string): Promise<KakaoPlace[]> => {
  if (!keyword.trim() || !KAKAO_REST_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      query: keyword,
      size: '5',
    });

    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword?${params}`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (!res.ok) {
      console.error('Kakao search error:', res.status);
      return [];
    }

    const data: KakaoSearchResponse = await res.json();
    return data.documents;
  } catch (e) {
    console.error('Kakao search failed:', e);
    return [];
  }
};
