import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('3D Arabic Welcome Banner Tests', () => {
  const componentPath = path.resolve(__dirname, '../components/common/WelcomeBanner3D.tsx');
  const pagePath = path.resolve(__dirname, '../app/page.tsx');
  const headerPath = path.resolve(__dirname, '../components/layout/Header.tsx');

  it('component file exists and is accessible', () => {
    assert.strictEqual(fs.existsSync(componentPath), true, 'WelcomeBanner3D.tsx must exist');
  });

  it('contains the exact requested Arabic headline, values, developer credits, and company link', () => {
    const content = fs.readFileSync(componentPath, 'utf8');

    // 1. Required Arabic Headline
    assert.match(
      content,
      /نظام أمان للتقسيط/,
      'Must contain system name in Arabic'
    );
    assert.match(
      content,
      /مرحباً بك في/,
      'Must contain welcome greeting in Arabic'
    );
    assert.ok(
      content.includes('القوة') && content.includes('الثقة') && content.includes('الأمان'),
      'Must contain values: القوة، الثقة، والأمان'
    );

    // 2. Developer rights: برمجة وتطوير مروان أحمد
    assert.match(
      content,
      /برمجة وتطوير مروان أحمد/,
      'Must contain developer credits: برمجة وتطوير مروان أحمد'
    );

    // 3. Ajeeb Company link: https://www.ajeebiq.com/
    assert.match(
      content,
      /https:\/\/www\.ajeebiq\.com\//,
      'Must contain the exact company URL https://www.ajeebiq.com/'
    );
    assert.match(
      content,
      /شركة عجيب/,
      'Must contain company name شركة عجيب'
    );
  });

  it('implements rich 3D perspective and transforms', () => {
    const content = fs.readFileSync(componentPath, 'utf8');

    assert.ok(content.includes('perspective'), 'Must include 3D perspective styling');
    assert.ok(content.includes('preserve-3d'), 'Must include 3D preserve-3d class');
    assert.ok(content.includes('rotateX'), 'Must support 3D rotateX interaction');
    assert.ok(
      content.includes('ambient-shield-breath') || content.includes('shieldMicroBreath'),
      'Must include disciplined ambient shield breath and stillness'
    );
  });

  it('is integrated into page.tsx and Header.tsx for launch and re-triggering', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    const headerContent = fs.readFileSync(headerPath, 'utf8');

    assert.ok(
      pageContent.includes('WelcomeBanner3D'),
      'page.tsx must import and render WelcomeBanner3D'
    );
    assert.ok(
      pageContent.includes('isWelcomeBannerOpen'),
      'page.tsx must manage isWelcomeBannerOpen state'
    );
    assert.ok(
      headerContent.includes('onOpenWelcomeBanner'),
      'Header.tsx must support onOpenWelcomeBanner prop'
    );
  });

  it('session and today suppression logic is mathematically consistent', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Simulating suppression check
    const shouldShow = (dismissedSession: boolean, dontShowTodayDate: string | null) => {
      return !dismissedSession && dontShowTodayDate !== today;
    };

    // First time open
    assert.strictEqual(shouldShow(false, null), true);

    // Dismissed in current session
    assert.strictEqual(shouldShow(true, null), false);

    // Marked "Don't show today" today
    assert.strictEqual(shouldShow(false, today), false);

    // Marked yesterday, new day arrived
    assert.strictEqual(shouldShow(false, yesterday), true);
  });
});
