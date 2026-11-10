import test from 'node:test'
import assert from 'node:assert/strict'
import { findGaps, normalize } from '../src/lib/intervals.js'

test('mirrors the backend ledger', () => {
  assert.deepEqual(normalize([[5, 10], [0, 6], [20, 30], [-5, 3]], 25), [[0, 10], [20, 25]])
  assert.deepEqual(findGaps([[0, 1000], [1100, 5000]], 5000), [])
  assert.deepEqual(findGaps([[1000, 4000]], 6000), [[0, 1000], [4000, 6000]])
  assert.deepEqual(findGaps([[1000, 2500]], 5000), [[0, 5000]])
  assert.deepEqual(findGaps([], 4000), [[0, 4000]])
  assert.deepEqual(findGaps([[0, 1000], [2000, 3000], [4000, 9000]], 9000), [[1000, 4000]])
})
