export interface SelectionHistoryItem {
  id: string
  name: string
}

export interface PreviousSelectionTarget {
  item: SelectionHistoryItem
  index: number
}

export const appendSelectionHistory = (
  history: SelectionHistoryItem[],
  item: SelectionHistoryItem,
  limit: number = 50
): SelectionHistoryItem[] => {
  const current = history[history.length - 1]
  if (current && current.id === item.id) return history
  return history.concat(item).slice(-Math.max(1, limit))
}

export const previousSelectionTarget = (
  history: SelectionHistoryItem[],
  currentID: string,
  exists: (id: string) => boolean
): PreviousSelectionTarget | undefined => {
  let index = history.length - 1
  if (index >= 0 && history[index].id === currentID) index -= 1
  for (; index >= 0; index -= 1) {
    if (exists(history[index].id)) return { item: history[index], index }
  }
  return undefined
}
