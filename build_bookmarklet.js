#!/usr/bin/env node
// C&F — turn grab.js into the one-line javascript: url the app hands out.
// Run after editing grab.js:  node build_bookmarklet.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/grab.js', 'utf8');
new Function(src);                       // fail loudly on a syntax error
const url = 'javascript:' + encodeURIComponent(src);
fs.writeFileSync(__dirname + '/bookmarklet.js',
  '/* Generated from grab.js — do not edit by hand.\n   Rebuild: node build_bookmarklet.js */\n' +
  'window.CF_GRAB=' + JSON.stringify(url) + ';\n');
console.error(`bookmarklet.js written (${url.length} chars)`);
