// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu()
  .removeRules(
    'regexp/no-super-linear-backtracking',
  )
