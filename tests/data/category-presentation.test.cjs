const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require(path.join(process.env.DOMAIN_BUILD_DIR, 'progression', 'index.js'));
const presentation = require(path.join(process.env.DATA_BUILD_DIR, '..', 'ui', 'category-presentation.js'));

test('Current category names resolve old records by immutable ID without rewriting the domain', () => {
  const original = JSON.stringify(api.JOURNEY_CATEGORIES);
  for (const category of api.JOURNEY_CATEGORIES) {
    const current = presentation.getCategoryPresentation(category);
    const restored = presentation.getCategoryPresentation({ ...category, name: 'A historical display name', iconId: 'historical_icon' });
    assert.equal(current, restored);
    assert.equal(current, presentation.getCategoryPresentation(category.id));
    assert.equal(current.id, category.id);
    assert.equal(current.iconId, category.id);
    assert.equal(current.version, 'ona_category_presentation_v3');
    assert.ok(current.name.length >= 3 && current.theme.length > 10);
    assert.ok(Object.isFrozen(current));
    assert.ok(Object.isFrozen(presentation.getCategoryIconPaths(category)));
  }
  assert.equal(JSON.stringify(api.JOURNEY_CATEGORIES), original);
  assert.equal(api.JOURNEY_CATEGORIES[2].name, 'Awakening Attention');
  // Sealed stages present their own (undiscovered) names, never the domain's historical ones.
  assert.notEqual(presentation.getCategoryPresentation('awakening_attention').name, '');
});

test('Starting and habit-building milestone presentation is correct across retained level versions', () => {
  assert.equal(presentation.getJourneyPresentationLabel(api.JOURNEY_PRELUDE), 'Level 0 · Monkey Mind');
  // Monkey Mind is both the starting point and Levels 1–5.
  for (let level = 0; level < 5; level++) assert.match(presentation.getJourneyPresentationLabel(api.HABIT_LEVELS[level]), new RegExp(`^Level ${level + 1} · Monkey Mind · ${level + 1} of 5$`));
  assert.equal(presentation.getLevelCategoryPresentation(api.JOURNEY_PRELUDE).name, 'Monkey Mind');
  assert.equal(presentation.getCategoryPresentation(api.JOURNEY_PRELUDE.category).name, 'Monkey Mind');
  assert.deepEqual(presentation.getCategoryIconPaths('monkey_mind', 0), presentation.getCategoryIconPaths('monkey_mind', 1));
  for (const levels of [api.LEGACY_JOURNEY_LEVELS, api.JOURNEY_LEVELS, api.HABIT_LEVELS]) {
    const habit = presentation.getCategoryPresentation('habit_established').name;
    assert.equal(presentation.getJourneyPresentationLabel(levels[99]), `Level 100 · ${habit} · 5 of 5`);
    assert.match(presentation.getJourneyPresentationLabel(levels[124]), /^Level 125 · .+ · 5 of 5$/);
  }
});

test('Unknown category identities fail explicitly instead of rendering an empty symbol', () => {
  assert.throws(() => presentation.getCategoryPresentation('future_missing_category'), /Unknown journey category/);
  assert.throws(() => presentation.getCategoryIconPaths('future_missing_category'), /Unknown journey category/);
  assert.equal(presentation.CATEGORY_ICON_STYLE.strokeWidth, 1.35);
  assert.equal(presentation.CATEGORY_ICON_STYLE.viewBox, '0 0 24 24');
  assert.ok(Object.isFrozen(presentation.CATEGORY_ICON_STYLE));
});
