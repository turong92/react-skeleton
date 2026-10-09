/**
 * 「결제사와 맞췄어요」(맞춘 뒤의 안내)가 지금 화면의 사유에 대한 말이 아니게 됐는가 - 맞춘 응답의 `reviewReason` 이 화면의 사유와 **달라졌다**.
 * 맞춘 뒤에 사유가 풀리거나 다른 사유로 바뀌면 그 안내는 낡았다. 부모가 이 순간에 `sync.reset()` 으로 **비운다** - 비우지 않으면 사유가 같은 종류로 다시 찍힐 때
 * (맞춤 → 풀림 → 같은 사유로 다시) 패널이 다시 같다고 보고 아무도 묻지 않은 「맞춰 봤지만 아직 어긋나 있어요」를 말한다. 한 번 갈라지면 되살아나지 않는다.
 */
export function syncNoteIsStale(
  synced: { reviewReason?: string | null } | undefined,
  current: string | null | undefined,
): boolean {
  return synced !== undefined && (synced.reviewReason ?? null) !== (current ?? null)
}
