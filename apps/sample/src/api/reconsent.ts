import { createReconsentController, type LegalApi } from '@skeleton/legal'

/*
 * 약관 재동의 — API 클라이언트가 403 `LEGAL.RECONSENT_REQUIRED` 를 이 컨트롤러에 넘기고(`recoverForbidden`), `<ReconsentGate>`(main.tsx)가 동의 화면을 그린다.
 * 컨트롤러는 클라이언트보다 먼저 있어야 하고 법적 문서 API 는 클라이언트 뒤에 만들어지므로 `bindLegalApi` 로 이어 준다(`api/legal.ts`).
 * 백엔드에 legal 모듈이 없으면 이 403 이 오지 않아 아무 일도 일어나지 않는다.
 */
let bound: LegalApi | undefined
export const bindLegalApi = (api: LegalApi) => {
  bound = api
}
export const reconsent = createReconsentController({
  api: () => {
    if (!bound) throw new Error('legal api is not bound (import ./legal)')
    return bound
  },
})
