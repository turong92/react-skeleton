/** 머리말 검색창이 보내는 주소 */
export const searchPath = (query: string) => `/search?q=${encodeURIComponent(query)}`
