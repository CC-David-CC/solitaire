import { describe, it } from './test-shim.ts';
import assert from 'node:assert/strict';
import { computeLayout } from '../src/view/run.ts';

describe('Solitaire dynamic layout metrics', () => {
  it('computes compact metrics for phone viewport (< 768px)', () => {
    const layout = computeLayout(375, 667, 3);
    assert.strictEqual(layout.tier, 'phone');
    assert.ok(layout.cardW >= 38, 'card width should be at least minimum');
    assert.ok(layout.cardH > layout.cardW, 'card height > card width');
    assert.ok(layout.tableauY > layout.topY, 'tableau below top row');
    assert.ok(layout.cardW * 7 <= 375, 'tableau columns fit mobile screen');
  });

  it('computes standard metrics for 1080p desktop', () => {
    const layout = computeLayout(1024, 768, 1);
    assert.strictEqual(layout.tier, 'desktop');
    assert.ok(layout.cardW >= 80, 'desktop cards should be comfortable size');
    assert.ok(layout.margin >= 12, 'standard margins');
    assert.ok(layout.cardRadius >= 5, 'smooth card borders');
  });

  it('computes spacious HiDPI metrics for 4K UHD viewport (>= 2560px)', () => {
    const layout = computeLayout(3840, 2160, 2);
    assert.strictEqual(layout.tier, '4k');
    assert.ok(layout.cardW >= 200, '4K cards should be ultra-crisp and large');
    assert.ok(layout.margin >= 20, 'generous 4K margins');
    assert.ok(layout.statusY > layout.tableauY, 'status bar in footer');
  });
});
