import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'menu/index.html',
  'venue-hire/index.html',
  'story/index.html',
  'visit/index.html',
  'book/index.html',
  'design.css',
  'site.js',
  'menu-data.js',
  'menu-page.js',
  'venue-planner.js',
];

await Promise.all(requiredFiles.map((file) => access(file)));

const menuSource = await readFile('menu-data.js', 'utf8');
if (!menuSource.includes('window.WILD_SUN_MENU')) {
  throw new Error('menu-data.js does not expose the café menu.');
}

console.log('Verified Home, Menu, Venue Hire, Our Story, Visit and Book pages.');
