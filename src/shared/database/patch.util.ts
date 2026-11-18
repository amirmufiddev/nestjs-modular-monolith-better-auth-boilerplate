export function applyPatch<T extends object>(
  input: Partial<T>,
  allowedKeys: (keyof T)[],
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of allowedKeys) {
    if (input[key] !== undefined) {
      result[key] = input[key];
    }
  }

  return result;
}
