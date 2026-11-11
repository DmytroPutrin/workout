import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatClock,
  formatDuration,
  formatNumber,
  formatSet,
  formatWeight,
  totalVolume,
} from '../../app/utils/format'

describe('formatNumber', () => {
  it('drops trailing zeros and float noise', () => {
    assert.equal(formatNumber(60), '60')
    assert.equal(formatNumber(62.5), '62.5')
    assert.equal(formatNumber(0.1 + 0.2), '0.3')
  })
})

describe('formatWeight / formatSet', () => {
  it('shows 0 kg as bodyweight', () => {
    assert.equal(formatWeight(0), 'BW')
    assert.equal(formatWeight(102.5), '102.5 kg')
    assert.equal(formatSet({ reps: 8, weightKg: 60 }), '60 kg × 8')
    assert.equal(formatSet({ reps: 20, weightKg: 0 }), 'BW × 20')
  })
})

describe('formatClock', () => {
  it('formats a stopwatch', () => {
    assert.equal(formatClock(0), '0:00')
    assert.equal(formatClock(65_000), '1:05')
    assert.equal(formatClock(42 * 60_000 + 13_000), '42:13')
    assert.equal(formatClock(3_723_000), '1:02:03')
  })

  it('never shows negative time (e.g. a clock slightly behind the server)', () => {
    assert.equal(formatClock(-5_000), '0:00')
  })
})

describe('formatDuration', () => {
  it('rounds to minutes and switches to hours past 60', () => {
    assert.equal(formatDuration(42 * 60_000 + 20_000), '42 min')
    assert.equal(formatDuration(65 * 60_000), '1 h 05 min')
    assert.equal(formatDuration(-1), '0 min')
  })
})

describe('totalVolume', () => {
  it('adds up reps × weight', () => {
    assert.equal(totalVolume([]), 0)
    assert.equal(totalVolume([{ reps: 5, weightKg: 100 }, { reps: 8, weightKg: 80 }, { reps: 20, weightKg: 0 }]), 1140)
  })
})
