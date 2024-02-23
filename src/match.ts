import type { ResolvedOptions } from './types'

/**
 * Locate the best instance of 'pattern' in 'text' near 'loc'.
 * @param {string} text The text to search.
 * @param {string} pattern The pattern to search for.
 * @param {number} loc The location to search around.
 * @return {number} Best match index or -1.
 */
export function matchMain(text: string, pattern: string, loc: number, options: ResolvedOptions) {
  // Check for null inputs.
  if (text == null || pattern == null || loc == null)
    throw new Error('Null input. (match_main)')

  loc = Math.max(0, Math.min(loc, text.length))
  if (text === pattern) {
    // Shortcut (potentially not guaranteed by the algorithm)
    return 0
  }
  else if (!text.length) {
    // Nothing to match.
    return -1
  }
  else if (text.substring(loc, loc + pattern.length) === pattern) {
    // Perfect match at the perfect spot!  (Includes case of null pattern)
    return loc
  }
  else {
    // Do a fuzzy compare.
    return matchBitap(text, pattern, loc, options)
  }
}

/**
 * Locate the best instance of 'pattern' in 'text' near 'loc' using the
 * Bitap algorithm.
 * @param {string} text The text to search.
 * @param {string} pattern The pattern to search for.
 * @param {number} loc The location to search around.
 * @return {number} Best match index or -1.
 * @private
 */
export function matchBitap(text: string, pattern: string, loc: number, options: ResolvedOptions) {
  if (pattern.length > options.matchMaxBits)
    throw new Error('Pattern too long for this browser.')

  // Initialise the alphabet.
  const s = matchAlphabet(pattern)

  // const dmp = this // 'this' becomes 'window' in a closure.

  /**
   * Compute and return the score for a match with e errors and x location.
   * Accesses loc and pattern through being a closure.
   * @param {number} e Number of errors in match.
   * @param {number} x Location of match.
   * @return {number} Overall score for match (0.0 = good, 1.0 = bad).
   * @private
   */
  function matchBitapScore(e: number, x: number): number {
    const accuracy = e / pattern.length
    const proximity = Math.abs(loc - x)
    if (!options.matchDistance) {
      // Dodge divide by zero error.
      return proximity ? 1.0 : accuracy
    }
    return accuracy + (proximity / options.matchDistance)
  }

  // Highest score beyond which we give up.
  let score_threshold = options.matchThreshold
  // Is there a nearby exact match? (speedup)
  let best_loc = text.indexOf(pattern, loc)
  if (best_loc !== -1) {
    score_threshold = Math.min(matchBitapScore(0, best_loc), score_threshold)
    // What about in the other direction? (speedup)
    best_loc = text.lastIndexOf(pattern, loc + pattern.length)
    if (best_loc !== -1)
      score_threshold = Math.min(matchBitapScore(0, best_loc), score_threshold)
  }

  // Initialise the bit arrays.
  const matchmask = 1 << (pattern.length - 1)
  best_loc = -1

  let bin_min, bin_mid
  let bin_max = pattern.length + text.length
  let last_rd: number[] = []
  for (let d = 0; d < pattern.length; d++) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from 'loc' we can stray at this
    // error level.
    bin_min = 0
    bin_mid = bin_max
    while (bin_min < bin_mid) {
      if (matchBitapScore(d, loc + bin_mid) <= score_threshold)
        bin_min = bin_mid
      else
        bin_max = bin_mid

      bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min)
    }
    // Use the result from this iteration as the maximum for the next.
    bin_max = bin_mid
    let start = Math.max(1, loc - bin_mid + 1)
    const finish = Math.min(loc + bin_mid, text.length) + pattern.length

    const rd: number[] = Array(finish + 2)
    rd[finish + 1] = (1 << d) - 1
    for (let j = finish; j >= start; j--) {
      // The alphabet (s) is a sparse hash, so the following line generates
      // warnings.
      const charMatch = s[text.charAt(j - 1)]
      if (d === 0) { // First pass: exact match.
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch
      }
      else { // Subsequent passes: fuzzy match.
        rd[j] = (((rd[j + 1] << 1) | 1) & charMatch)
        | (((last_rd[j + 1] | last_rd[j]) << 1) | 1)
        | last_rd[j + 1]
      }
      if (rd[j] & matchmask) {
        const score = matchBitapScore(d, j - 1)
        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (score <= score_threshold) {
          // Told you so.
          score_threshold = score
          best_loc = j - 1
          if (best_loc > loc) {
            // When passing loc, don't exceed our current distance from loc.
            start = Math.max(1, 2 * loc - best_loc)
          }
          else {
            // Already passed loc, downhill from here on in.
            break
          }
        }
      }
    }
    // No hope for a (better) match at greater error levels.
    if (matchBitapScore(d + 1, loc) > score_threshold)
      break

    last_rd = rd
  }
  return best_loc
}

/**
 * Initialise the alphabet for the Bitap algorithm.
 * @param {string} pattern The text to encode.
 * @return {!object} Hash of character locations.
 * @private
 */
export function matchAlphabet(pattern: string) {
  const s: Record<string, number> = {}
  for (let i = 0; i < pattern.length; i++)
    s[pattern.charAt(i)] = 0
  for (let i = 0; i < pattern.length; i++)
    s[pattern.charAt(i)] |= 1 << (pattern.length - i - 1)
  return s
}
