import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_DIVIDEND_RATE,
  DEFAULT_PROMOTION_RATE,
  getDefaultDividendFund,
  getDefaultPromotionFund,
  resetFundRates,
  resolveDividendFund,
  resolvePromotionFund,
  setFundRates,
} from './productPricing.ts'

test('default fund amounts use the configured default rates', () => {
  assert.equal(DEFAULT_PROMOTION_RATE, 0.2)
  assert.equal(DEFAULT_DIVIDEND_RATE, 0.26)
  assert.equal(getDefaultPromotionFund(100), 20)
  assert.equal(getDefaultDividendFund(100), 26)
})

test('missing fund amounts fall back to the minimum SKU price', () => {
  for (const value of [null, undefined, '']) {
    assert.equal(resolvePromotionFund(value, 100), 20)
    assert.equal(resolveDividendFund(value, 100), 26)
  }
})

test('explicit zero and positive manual fund amounts are preserved', () => {
  for (const value of [0, '0', 12.345]) {
    assert.equal(resolvePromotionFund(value, 100), value === 0 || value === '0' ? 0 : 12.35)
    assert.equal(resolveDividendFund(value, 100), value === 0 || value === '0' ? 0 : 12.35)
  }
})

test('invalid negative and non-numeric fund amounts use defaults', () => {
  for (const value of [-1, '-1', 'not-a-number']) {
    assert.equal(resolvePromotionFund(value, 100), 20)
    assert.equal(resolveDividendFund(value, 100), 26)
  }
})

test('configured fund rates override the defaults', () => {
  try {
    setFundRates({ promotionRate: 0.3, dividendRate: 0.4 })
    assert.equal(getDefaultPromotionFund(100), 30)
    assert.equal(getDefaultDividendFund(100), 40)
    assert.equal(resolvePromotionFund(undefined, 100), 30)
    assert.equal(resolveDividendFund(undefined, 100), 40)
  } finally {
    resetFundRates()
  }
})
