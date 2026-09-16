export interface SelectionHistoryItem {
  id: string
  name: string
}

export interface PreviousSelectionTarget {
  item: SelectionHistoryItem
  index: number
}

export interface SelectionHistoryState {
  history: SelectionHistoryItem[]
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

export const appendSelectionHistoryAt = (
  history: SelectionHistoryItem[],
  index: number,
  item: SelectionHistoryItem,
  limit: number = 50
): SelectionHistoryState => {
  const current = history[index]
  if (current && current.id === item.id) return { history, index }

  const nextHistory = history.slice(0, index + 1).concat(item).slice(-Math.max(1, limit))
  return { history: nextHistory, index: nextHistory.length - 1 }
}

export const previousSelectionTarget = (
  history: SelectionHistoryItem[],
  currentIndex: number,
  exists: (id: string) => boolean
): PreviousSelectionTarget | undefined => {
  let index = Math.min(currentIndex - 1, history.length - 1)
  for (; index >= 0; index -= 1) {
    if (exists(history[index].id)) return { item: history[index], index }
  }
  return undefined
}

export const nextSelectionTarget = (
  history: SelectionHistoryItem[],
  currentIndex: number,
  exists: (id: string) => boolean
): PreviousSelectionTarget | undefined => {
  for (let index = Math.max(-1, currentIndex) + 1; index < history.length; index += 1) {
    if (exists(history[index].id)) return { item: history[index], index }
  }
  return undefined
}
