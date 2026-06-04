export function serializeDates<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
