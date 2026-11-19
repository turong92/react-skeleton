import { BaseSequencer, type TestSpecification } from 'vitest/node'

/**
 * e2e 파일을 **이름 순**으로 돌린다 - 파일들이 같은 백엔드 · 같은 시드 계정을 나눠 쓰므로 순서가 달라지면 앞 파일이 남긴 상태가 달라진다.
 * 기본 정렬은 앞선 실행의 결과 캐시(실패한 파일 먼저 · 오래 걸린 파일 먼저)를 따라 로컬(캐시 있음)과 CI(캐시 없음)의 순서가 달라서, 「로컬은 통과 · CI 만 실패」가 반복됐다.
 */
export default class NameSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId))
  }
}
