import test from 'node:test';
import assert from 'node:assert/strict';
import { linkifyHtml, autolinkMarkdownHtml } from '../dist/links.js';

test('linkifyHtml returns empty string for empty input', () => {
  assert.equal(linkifyHtml(''), '');
  assert.equal(linkifyHtml(undefined), '');
});

test('linkifyHtml escapes HTML and leaves non-URL text unchanged', () => {
  assert.equal(linkifyHtml('Hello & welcome <world>!'), 'Hello &amp; welcome &lt;world&gt;!');
});

test('linkifyHtml linkifies standard URLs', () => {
  const input = 'Imported from Facebook: https://www.facebook.com/share/1BpVYvKNk3/';
  const expected = 'Imported from Facebook: <a href="https://www.facebook.com/share/1BpVYvKNk3/" target="_blank" rel="noopener noreferrer">https://www.facebook.com/share/1BpVYvKNk3/</a>';
  assert.equal(linkifyHtml(input), expected);
});

test('linkifyHtml strips trailing punctuation from URLs', () => {
  const input = 'Check https://example.com/test. And https://example.com/another! Also https://example.com/three, yes.';
  const expected = 'Check <a href="https://example.com/test" target="_blank" rel="noopener noreferrer">https://example.com/test</a>. And <a href="https://example.com/another" target="_blank" rel="noopener noreferrer">https://example.com/another</a>! Also <a href="https://example.com/three" target="_blank" rel="noopener noreferrer">https://example.com/three</a>, yes.';
  assert.equal(linkifyHtml(input), expected);
});

test('linkifyHtml handles parentheses properly', () => {
  assert.equal(
    linkifyHtml('(https://example.com/path)'),
    '(<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">https://example.com/path</a>)'
  );
  assert.equal(
    linkifyHtml('https://en.wikipedia.org/wiki/Sample_(disambiguation)'),
    '<a href="https://en.wikipedia.org/wiki/Sample_(disambiguation)" target="_blank" rel="noopener noreferrer">https://en.wikipedia.org/wiki/Sample_(disambiguation)</a>'
  );
});

test('linkifyHtml escapes HTML and quotes in URLs', () => {
  const input = '<script> https://example.com?a=1&b=2"hack';
  const out = linkifyHtml(input);
  assert.match(out, /&lt;script&gt;/);
  assert.ok(out.includes('href="https://example.com?a=1&amp;b=2"'));
  assert.ok(out.includes('"hack'));
});

test('autolinkMarkdownHtml does not double-link existing <a> tags', () => {
  const input = 'Check <a href="https://google.com">Google</a> and also https://bing.com for info.';
  const expected = 'Check <a href="https://google.com">Google</a> and also <a href="https://bing.com" target="_blank" rel="noopener noreferrer">https://bing.com</a> for info.';
  assert.equal(autolinkMarkdownHtml(input), expected);
});
