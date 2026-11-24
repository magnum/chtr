const LIMIT = 200

export function since(list, after) {
  if (!after) return list
  const index = list.findIndex((item) => item.id === after)
  if (index === -1) return list
  return list.slice(index + 1)
}

export async function push(store, bucket, item) {
  const current = (await store.getJSON(bucket)) ?? []
  const next = [...current, item].slice(-LIMIT)
  await store.setJSON(bucket, next)
  return item
}
