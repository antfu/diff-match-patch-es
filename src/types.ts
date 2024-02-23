export interface DiffMatchPathOptions {
  /**
   * Number of seconds to map a diff before giving up (0 for infinity).
   * @default 1.0
   */
  diffTimeout?: number
  /**
   * Cost of an empty edit operation in terms of edit characters.
   * @default 4
   */
  diffEditCost?: number
  /**
   * At what point is no match declared (0.0 = perfection, 1.0 = very loose).
   * @default 0.5
   */
  matchThreshold?: number
  /**
   * How far to search for a match (0 = exact location, 1000+ = broad match).
   * @default 1000
   */
  matchDistance?: number
  /**
   * When deleting a large block of text (over ~64 characters), how close do
   * the contents have to be to match the expected contents.
   * (0.0 = perfection, 1.0 = very loose).
   * @default 0.5
   */
  patchDeleteThreshold?: number
  /**
   * Chunk size for context length.
   * @default 4
   */
  patchMargin?: number
  /**
   * The number of bits in an int.
   * @default 32
   */
  matchMaxBits?: number
}

export type ResolvedOptions = Required<DiffMatchPathOptions>

/**
 * DIFF_DELETE: -1
 *
 * DIFF_INSERT: 1
 *
 * DIFF_EQUAL: 0
 */
export type DiffOperation = -1 | 0 | 1

/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
export type Diff = [DiffOperation, string]

export interface Patch {
  diffs: Diff[]
  start1: number
  start2: number
  length1: number
  length2: number
}
