/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Computes the difference between two texts to create a patch.
 * Applies the patch onto another text, allowing for errors.
 * @author fraser@google.com (Neil Fraser)
 *
 * Rewritten to TypeScript and ES Module by Anthony Fu (@antfu)
 */

export * from './types'

export {
  DIFF_DELETE,
  DIFF_INSERT,
  DIFF_EQUAL,
  diffCleanupEfficiency,
  diffCleanupMerge,
  diffCleanupSemantic,
  diffCleanupSemanticLossless,
  diffCommonPrefix,
  diffCommonSuffix,
  diffFromDelta,
  diffLevenshtein,
  diffMain,
  diffPrettyHtml,
  diffText1,
  diffText2,
  diffToDelta,
  diffXIndex,
} from './diff'

export {
  patchMake,
  patchDeepCopy,
  patchApply,
  patchAddPadding,
  patchSplitMax,
  patchFromText,
  patchToText,
} from './patch'

export {
  matchMain,
  matchBitap,
  matchAlphabet,
} from './match'

export {
  resolveOptions,
  defaultOptions,
} from './options'
