import {
  defaultOptions,
  resolveOptions,
} from './options'
import {
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
  createDiff,
  diffCleanupEfficiency,
  diffCleanupSemantic,
  diffCleanupSemanticLossless,
  diffLevenshtein,
  diffMain,
  diffText1,
  diffText2,
  diffXIndex,
} from './diff'
import type {
  Diff,
  DiffMatchPathOptions,
  Patch,
} from './types'
import {
  matchMain,
} from './match'

/**
 * Increase the context until it is unique,
 * but don't let the pattern expand beyond matchMaxBits.
 * @param {!diff_match_patch.patch_obj} patch The patch to grow.
 * @param {string} text Source text.
 * @private
 */
export function patchAddContext(patch: Patch, text: string, options: DiffMatchPathOptions) {
  if (text.length === 0)
    return

  if (patch.start2 === null)
    throw new Error('patch not initialized')

  const {
    matchMaxBits = defaultOptions.matchMaxBits,
    patchMargin = defaultOptions.patchMargin,
  } = options

  let pattern = text.substring(patch.start2, patch.start2 + patch.length1)
  let padding = 0

  // Look for the first and last matches of pattern in text.  If two different
  // matches are found, increase the pattern length.
  while (text.indexOf(pattern) !== text.lastIndexOf(pattern)
    && pattern.length < matchMaxBits - patchMargin - patchMargin) {
    padding += patchMargin
    pattern = text.substring(patch.start2 - padding, patch.start2 + patch.length1 + padding)
  }
  // Add one chunk for good luck.
  padding += patchMargin

  // Add the prefix.
  const prefix = text.substring(patch.start2 - padding, patch.start2)
  if (prefix)
    patch.diffs.unshift(createDiff(DIFF_EQUAL, prefix))

  // Add the suffix.
  const suffix = text.substring(patch.start2 + patch.length1, patch.start2 + patch.length1 + padding)
  if (suffix)
    patch.diffs.push(createDiff(DIFF_EQUAL, suffix))

  // Roll back the start points.
  patch.start1 -= prefix.length
  patch.start2 -= prefix.length
  // Extend the lengths.
  patch.length1 += prefix.length + suffix.length
  patch.length2 += prefix.length + suffix.length
}

/**
 * Compute a list of patches to turn text1 into text2.
 * Use diffs if provided, otherwise compute it ourselves.
 * There are four ways to call this function, depending on what data is
 * available to the caller:
 * Method 1:
 * a = text1, b = text2
 * Method 2:
 * a = diffs
 * Method 3 (optimal):
 * a = text1, b = diffs
 * Method 4 (deprecated, use method 3):
 * a = text1, b = text2, c = diffs
 *
 * @param {string|Diff[]} a text1 (methods 1,3,4) or
 * Array of diff tuples for text1 to text2 (method 2).
 * @param {string|Diff[]=} opt_b text2 (methods 1,4) or
 * Array of diff tuples for text1 to text2 (method 3) or undefined (method 2).
 * @param {string|Diff[]=} opt_c Array of diff tuples
 * for text1 to text2 (method 4) or undefined (methods 1,2,3).
 * @return {Patch[]} Array of Patch objects.
 */
export function patchMake(a: string | Diff[], opt_b?: string | Diff[], opt_c?: string | Diff[], options: DiffMatchPathOptions = {}) {
  const resolved = {
    ...defaultOptions,
    ...options,
  }

  let text1, diffs
  if (typeof a == 'string' && typeof opt_b == 'string'
    && typeof opt_c == 'undefined') {
    // Method 1: text1, text2
    // Compute diffs from text1 and text2.
    text1 = a
    diffs = diffMain(text1, opt_b, resolved, true)
    if (diffs.length > 2) {
      diffCleanupSemantic(diffs)
      diffCleanupEfficiency(diffs)
    }
  }
  else if (a && typeof a == 'object' && typeof opt_b == 'undefined'
    && typeof opt_c == 'undefined') {
    // Method 2: diffs
    // Compute text1 from diffs.
    diffs = /** @type {Diff[]} */(a)
    text1 = diffText1(diffs)
  }
  else if (typeof a == 'string' && opt_b && typeof opt_b == 'object'
    && typeof opt_c == 'undefined') {
    // Method 3: text1, diffs
    text1 = /** @type {string} */(a)
    diffs = /** @type {Diff[]} */(opt_b)
  }
  else if (typeof a == 'string' && typeof opt_b == 'string'
    && opt_c && typeof opt_c == 'object') {
    // Method 4: text1, text2, diffs
    // text2 is not used.
    text1 = /** @type {string} */(a)
    diffs = /** @type {Diff[]} */(opt_c)
  }
  else {
    throw new Error('Unknown call format to patch_make.')
  }

  if (diffs.length === 0)
    return [] // Get rid of the null case.

  const patches = []
  let patch = createPatch()
  let patchDiffLength = 0 // Keeping our own length var is faster in JS.
  let char_count1 = 0 // Number of characters into the text1 string.
  let char_count2 = 0 // Number of characters into the text2 string.
  // Start with text1 (prepatch_text) and apply the diffs until we arrive at
  // text2 (postpatch_text).  We recreate the patches one by one to determine
  // context info.
  let prepatch_text = text1
  let postpatch_text = text1
  for (let x = 0; x < diffs.length; x++) {
    const diff_type = diffs[x][0]
    const diff_text = diffs[x][1]

    if (!patchDiffLength && diff_type !== DIFF_EQUAL) {
      // A new patch starts here.
      patch.start1 = char_count1
      patch.start2 = char_count2
    }

    switch (diff_type) {
      case DIFF_INSERT:
        patch.diffs[patchDiffLength++] = diffs[x]
        patch.length2 += diff_text.length
        postpatch_text = postpatch_text.substring(0, char_count2) + diff_text
        + postpatch_text.substring(char_count2)
        break
      case DIFF_DELETE:
        patch.length1 += diff_text.length
        patch.diffs[patchDiffLength++] = diffs[x]
        postpatch_text = postpatch_text.substring(0, char_count2)
        + postpatch_text.substring(char_count2
        + diff_text.length)
        break
      case DIFF_EQUAL:
        if (diff_text.length <= 2 * resolved.patchMargin
          && patchDiffLength && diffs.length !== x + 1) {
          // Small equality inside a patch.
          patch.diffs[patchDiffLength++] = diffs[x]
          patch.length1 += diff_text.length
          patch.length2 += diff_text.length
        }
        else if (diff_text.length >= 2 * resolved.patchMargin) {
          // Time for a new patch.
          if (patchDiffLength) {
            patchAddContext(patch, prepatch_text, resolved)
            patches.push(patch)
            patch = createPatch()
            patchDiffLength = 0
            // Unlike Unidiff, our patch lists have a rolling context.
            // https://github.com/google/diff-match-patch/wiki/Unidiff
            // Update prepatch text & pos to reflect the application of the
            // just completed patch.
            prepatch_text = postpatch_text
            char_count1 = char_count2
          }
        }
        break
    }

    // Update the current character count.
    if (diff_type !== DIFF_INSERT)
      char_count1 += diff_text.length

    if (diff_type !== DIFF_DELETE)
      char_count2 += diff_text.length
  }
  // Pick up the leftover patch if not empty.
  if (patchDiffLength) {
    patchAddContext(patch, prepatch_text, resolved)
    patches.push(patch)
  }

  return patches
}

/**
 * Given an array of patches, return another array that is identical.
 * @param {Patch[]} patches Array of Patch objects.
 * @return {Patch[]} Array of Patch objects.
 */
export function patchDeepCopy(patches: Patch[]) {
  // Making deep copies is hard in JavaScript.
  const patchesCopy = []
  for (let x = 0; x < patches.length; x++) {
    const patch = patches[x]
    const patchCopy = createPatch()
    patchCopy.diffs = []
    for (let y = 0; y < patch.diffs.length; y++) {
      patchCopy.diffs[y]
        = createDiff(patch.diffs[y][0], patch.diffs[y][1])
    }
    patchCopy.start1 = patch.start1
    patchCopy.start2 = patch.start2
    patchCopy.length1 = patch.length1
    patchCopy.length2 = patch.length2
    patchesCopy[x] = patchCopy
  }
  return patchesCopy
}

/**
 * Merge a set of patches onto the text.  Return a patched text, as well
 * as a list of true/false values indicating which patches were applied.
 * @param {Patch[]} patches Array of Patch objects.
 * @param {string} text Old text.
 * @return {!Array.<string|!Array.<boolean>>} Two element Array, containing the
 *      new text and an array of boolean values.
 */
export function patchApply(patches: Patch[], text: string, options?: DiffMatchPathOptions) {
  if (patches.length === 0)
    return [text, []]

  // Deep copy the patches so that no changes are made to originals.
  patches = patchDeepCopy(patches)

  const resolved = resolveOptions(options)
  const nullPadding = patchAddPadding(patches, resolved)
  text = nullPadding + text + nullPadding

  patchSplitMax(patches, resolved)
  // delta keeps track of the offset between the expected and actual location
  // of the previous patch.  If there are patches expected at positions 10 and
  // 20, but the first patch was found at 12, delta is 2 and the second patch
  // has an effective expected position of 22.
  let delta = 0
  const results = []
  for (let x = 0; x < patches.length; x++) {
    const expected_loc = patches[x].start2 + delta
    const text1 = diffText1(patches[x].diffs)
    let start_loc
    let end_loc = -1
    if (text1.length > resolved.matchMaxBits) {
      // patch_splitMax will only provide an oversized pattern in the case of
      // a monster delete.
      start_loc = matchMain(
        text,
        text1.substring(0, resolved.matchMaxBits),
        expected_loc,
        options,
      )
      if (start_loc !== -1) {
        end_loc = matchMain(
          text,
          text1.substring(text1.length - resolved.matchMaxBits),
          expected_loc + text1.length - resolved.matchMaxBits,
          options,
        )
        if (end_loc === -1 || start_loc >= end_loc) {
          // Can't find valid trailing context.  Drop this patch.
          start_loc = -1
        }
      }
    }
    else {
      start_loc = matchMain(text, text1, expected_loc, options)
    }
    if (start_loc === -1) {
      // No match found.  :(
      results[x] = false
      // Subtract the delta for this failed patch from subsequent patches.
      delta -= patches[x].length2 - patches[x].length1
    }
    else {
      // Found a match.  :)
      results[x] = true
      delta = start_loc - expected_loc
      let text2
      if (end_loc === -1)
        text2 = text.substring(start_loc, start_loc + text1.length)
      else
        text2 = text.substring(start_loc, end_loc + resolved.matchMaxBits)

      if (text1 === text2) {
        // Perfect match, just shove the replacement text in.
        text = text.substring(0, start_loc)
        + diffText2(patches[x].diffs)
        + text.substring(start_loc + text1.length)
      }
      else {
        // Imperfect match.  Run a diff to get a framework of equivalent
        // indices.
        const diffs = diffMain(text1, text2, options, false)
        if (text1.length > resolved.matchMaxBits
          && diffLevenshtein(diffs) / text1.length
          > resolved.patchDeleteThreshold) {
          // The end points match, but the content is unacceptably bad.
          results[x] = false
        }
        else {
          diffCleanupSemanticLossless(diffs)
          let index1 = 0
          let index2 = 0
          for (let y = 0; y < patches[x].diffs.length; y++) {
            const mod = patches[x].diffs[y]
            if (mod[0] !== DIFF_EQUAL)
              index2 = diffXIndex(diffs, index1)
            if (mod[0] === DIFF_INSERT) { // Insertion
              text = text.substring(0, start_loc + index2) + mod[1]
              + text.substring(start_loc + index2)
            }
            else if (mod[0] === DIFF_DELETE) { // Deletion
              text = text.substring(0, start_loc + index2)
              + text.substring(start_loc + diffXIndex(diffs, index1 + mod[1].length))
            }
            if (mod[0] !== DIFF_DELETE)
              index1 += mod[1].length
          }
        }
      }
    }
  }
  // Strip the padding off.
  text = text.substring(nullPadding.length, text.length - nullPadding.length)
  return [text, results]
}

/**
 * Add some padding on text start and end so that edges can match something.
 * Intended to be called only from within patch_apply.
 * @param {Patch[]} patches Array of Patch objects.
 * @return {string} The padding string added to each side.
 */
export function patchAddPadding(patches: Patch[], options: DiffMatchPathOptions = {}) {
  const {
    patchMargin: paddingLength = defaultOptions.patchMargin,
  } = options
  let nullPadding = ''
  for (let x = 1; x <= paddingLength; x++)
    nullPadding += String.fromCharCode(x)

  // Bump all the patches forward.
  for (let x = 0; x < patches.length; x++) {
    patches[x].start1 += paddingLength
    patches[x].start2 += paddingLength
  }

  // Add some padding on start of first diff.
  let patch = patches[0]
  let diffs = patch.diffs
  if (diffs.length === 0 || diffs[0][0] !== DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.unshift(createDiff(DIFF_EQUAL, nullPadding))
    patch.start1 -= paddingLength // Should be 0.
    patch.start2 -= paddingLength // Should be 0.
    patch.length1 += paddingLength
    patch.length2 += paddingLength
  }
  else if (paddingLength > diffs[0][1].length) {
    // Grow first equality.
    const extraLength = paddingLength - diffs[0][1].length
    diffs[0][1] = nullPadding.substring(diffs[0][1].length) + diffs[0][1]
    patch.start1 -= extraLength
    patch.start2 -= extraLength
    patch.length1 += extraLength
    patch.length2 += extraLength
  }

  // Add some padding on end of last diff.
  patch = patches[patches.length - 1]
  diffs = patch.diffs
  if (diffs.length === 0 || diffs[diffs.length - 1][0] !== DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.push(createDiff(DIFF_EQUAL, nullPadding))
    patch.length1 += paddingLength
    patch.length2 += paddingLength
  }
  else if (paddingLength > diffs[diffs.length - 1][1].length) {
    // Grow last equality.
    const extraLength = paddingLength - diffs[diffs.length - 1][1].length
    diffs[diffs.length - 1][1] += nullPadding.substring(0, extraLength)
    patch.length1 += extraLength
    patch.length2 += extraLength
  }

  return nullPadding
}

/**
 * Look through the patches and break up any which are longer than the maximum
 * limit of the match algorithm.
 * Intended to be called only from within patch_apply.
 * @param {Patch[]} patches Array of Patch objects.
 */
export function patchSplitMax(patches: Patch[], options?: DiffMatchPathOptions) {
  const resolved = resolveOptions(options)
  for (let x = 0; x < patches.length; x++) {
    if (patches[x].length1 <= resolved.matchMaxBits)
      continue

    const bigpatch = patches[x]
    // Remove the big old patch.
    patches.splice(x--, 1)
    let start1 = bigpatch.start1
    let start2 = bigpatch.start2
    let precontext = ''
    while (bigpatch.diffs.length !== 0) {
      // Create one of several smaller patches.
      const patch = createPatch()
      let empty = true
      patch.start1 = start1 - precontext.length
      patch.start2 = start2 - precontext.length
      if (precontext !== '') {
        patch.length1 = patch.length2 = precontext.length
        patch.diffs.push(createDiff(DIFF_EQUAL, precontext))
      }
      while (bigpatch.diffs.length !== 0
        && patch.length1 < resolved.matchMaxBits - resolved.patchMargin) {
        const diff_type = bigpatch.diffs[0][0]
        let diff_text = bigpatch.diffs[0][1]
        if (diff_type === DIFF_INSERT) {
          // Insertions are harmless.
          patch.length2 += diff_text.length
          start2 += diff_text.length
          patch.diffs.push(bigpatch.diffs.shift()!)
          empty = false
        }
        else if (diff_type === DIFF_DELETE && patch.diffs.length === 1
          && patch.diffs[0][0] === DIFF_EQUAL
          && diff_text.length > 2 * resolved.matchMaxBits) {
          // This is a large deletion.  Let it pass in one chunk.
          patch.length1 += diff_text.length
          start1 += diff_text.length
          empty = false
          patch.diffs.push(createDiff(diff_type, diff_text))
          bigpatch.diffs.shift()
        }
        else {
          // Deletion or equality.  Only take as much as we can stomach.
          diff_text = diff_text.substring(0, resolved.matchMaxBits - patch.length1 - resolved.patchMargin)
          patch.length1 += diff_text.length
          start1 += diff_text.length
          if (diff_type === DIFF_EQUAL) {
            patch.length2 += diff_text.length
            start2 += diff_text.length
          }
          else {
            empty = false
          }
          patch.diffs.push(createDiff(diff_type, diff_text))
          if (diff_text === bigpatch.diffs[0][1]) {
            bigpatch.diffs.shift()
          }
          else {
            bigpatch.diffs[0][1]
              = bigpatch.diffs[0][1].substring(diff_text.length)
          }
        }
      }
      // Compute the head context for the next patch.
      precontext = diffText2(patch.diffs)
      precontext = precontext.substring(precontext.length - resolved.patchMargin)
      // Append the end context for this patch.
      const postcontext = diffText1(bigpatch.diffs).substring(0, resolved.patchMargin)
      if (postcontext !== '') {
        patch.length1 += postcontext.length
        patch.length2 += postcontext.length
        if (patch.diffs.length !== 0
          && patch.diffs[patch.diffs.length - 1][0] === DIFF_EQUAL)
          patch.diffs[patch.diffs.length - 1][1] += postcontext
        else
          patch.diffs.push(createDiff(DIFF_EQUAL, postcontext))
      }
      if (!empty)
        patches.splice(++x, 0, patch)
    }
  }
}

/**
 * Take a list of patches and return a textual representation.
 * @param {Patch[]} patches Array of Patch objects.
 * @return {string} Text representation of patches.
 */
export function patchToText(patches: Patch[]) {
  const text = []
  for (let x = 0; x < patches.length; x++)
    text[x] = patches[x]
  return text.join('')
}

/**
 * Parse a textual representation of patches and return a list of Patch objects.
 * @param {string} textline Text representation of patches.
 * @return {Patch[]} Array of Patch objects.
 * @throws {!Error} If invalid input.
 */
export function patchFromText(textline: string) {
  const patches: Patch[] = []
  if (!textline)
    return patches

  const text = textline.split('\n')
  let textPointer = 0
  const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/
  while (textPointer < text.length) {
    const m = text[textPointer].match(patchHeader)
    if (!m)
      throw new Error(`Invalid patch string: ${text[textPointer]}`)

    const patch = createPatch()
    patches.push(patch)
    patch.start1 = Number.parseInt(m[1], 10)
    if (m[2] === '') {
      patch.start1--
      patch.length1 = 1
    }
    else if (m[2] === '0') {
      patch.length1 = 0
    }
    else {
      patch.start1--
      patch.length1 = Number.parseInt(m[2], 10)
    }

    patch.start2 = Number.parseInt(m[3], 10)
    if (m[4] === '') {
      patch.start2--
      patch.length2 = 1
    }
    else if (m[4] === '0') {
      patch.length2 = 0
    }
    else {
      patch.start2--
      patch.length2 = Number.parseInt(m[4], 10)
    }
    textPointer++

    while (textPointer < text.length) {
      const sign = text[textPointer].charAt(0)
      let line = ''
      try {
        line = decodeURI(text[textPointer].substring(1))
      }
      catch (ex) {
        // Malformed URI sequence.
        throw new Error(`Illegal escape in patch_fromText: ${line}`)
      }
      if (sign === '-') {
        // Deletion.
        patch.diffs.push(createDiff(DIFF_DELETE, line))
      }
      else if (sign === '+') {
        // Insertion.
        patch.diffs.push(createDiff(DIFF_INSERT, line))
      }
      else if (sign === ' ') {
        // Minor equality.
        patch.diffs.push(createDiff(DIFF_EQUAL, line))
      }
      else if (sign === '@') {
        // Start of next patch.
        break
      }
      else if (sign === '') {
        // Blank line?  Whatever.
      }
      else {
        // WTF?
        throw new Error(`Invalid patch mode "${sign}" in: ${line}`)
      }
      textPointer++
    }
  }
  return patches
}

/**
 * Class representing one patch operation.
 */
export function createPatch(): Patch {
  const patch: Patch = {
    diffs: [],
    start1: null!,
    start2: null!,
    length1: 0,
    length2: 0,
  }

  /**
   * Emulate GNU diff's format.
   * Header: @@ -382,8 +481,9 @@
   * Indices are printed as 1-based, not 0-based.
   * @return {string} The GNU diff string.
   */
  patch.toString = function () {
    let coords1, coords2
    if (this.length1 === 0)
      coords1 = `${this.start1},0`
    else if (this.length1 === 1)
      coords1 = this.start1 + 1
    else
      coords1 = `${this.start1 + 1},${this.length1}`

    if (this.length2 === 0)
      coords2 = `${this.start2},0`
    else if (this.length2 === 1)
      coords2 = this.start2 + 1
    else
      coords2 = `${this.start2 + 1},${this.length2}`

    const text = [`@@ -${coords1} +${coords2} @@\n`]
    let op
    // Escape the body of the patch with %xx notation.
    for (let x = 0; x < this.diffs.length; x++) {
      switch (this.diffs[x][0]) {
        case DIFF_INSERT:
          op = '+'
          break
        case DIFF_DELETE:
          op = '-'
          break
        case DIFF_EQUAL:
          op = ' '
          break
      }
      text[x + 1] = `${op + encodeURI(this.diffs[x][1])}\n`
    }
    return text.join('').replace(/%20/g, ' ')
  }

  return patch
}
