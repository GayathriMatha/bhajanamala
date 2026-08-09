/**
 * Write scripts/manual-title-fixes.json with verified titles (unicode-safe).
 */
import fs from 'fs';

const fixes = [
  // p75 #74 — English song (OCR destroyed Devanagari/Latin mix)
  { page: 75, songNo: 74, title: 'WHY FEAR ? I AM HERE!' },
  // p156 #60 — skip raga line
  {
    page: 156,
    songNo: 60,
    title:
      '\u0c28\u0c40\u0c15\u0c47 \u0c1a\u0c46\u0c32\u0c4d\u0c2e\u0c41\u0c28\u0c2f\u0c3e \u0c30\u0c3e\u0c2e\u0c3e',
  },
  // p170 #89 — సీతమ్మ మాయమ్మ (not సీ తమ్�్మ మాయమ్మ (not సీ తమ్మ)
  {
    page: 170,
    songNo: 89,
    title: '\u0c38\u0c40\u0c24\u0c2e\u0c4d\u0c2e \u0c2e\u0c3e\u0c2f\u0c2e\u0c4d\u0c2e',
  },
  // p185 #24 — pallavi literally contains రాగం
  {
    page: 185,
    songNo: 24,
    title:
      '\u0c2a\u0c32\u0c3f\u0c15\u0c3f\u0c02\u0c2a\u0c35\u0c3e \u0c30\u0c3e\u0c17\u0c02 \u0c2a\u0c32\u0c3f\u0c15\u0c3f\u0c02\u0c2a\u0c35\u0c3e',
  },
  // p236 #155
  {
    page: 236,
    songNo: 155,
    title:
      '\u0c2c\u0c3e\u0c32\u0c2e\u0c41\u0c15\u0c41\u0c02\u0c26\u0c3e - \u0c1c\u0c48 \u0c28\u0c02\u0c26\u0c32\u0c3e\u0c32\u0c3e',
  },
  // p325 #29 — English + Sanskrit; use English opening
  { page: 325, songNo: 29, title: 'ARISE! AWAKE! STOP NOT TILL THE GOAL IS REACHED!' },
  // p329 #8 — opener, not previous song's last charanam
  {
    page: 329,
    songNo: 8,
    title:
      '\u0c2e\u0c28\u0c4d\u200c\u0c2e\u0c48\u0c32\u0c3e \u0c2c\u0c4c\u0c30\u0c4d\u200c \u0c24\u0c28\u0c4d\u200c\u0c15\u0c4b \u0c27\u0c4b\u0c2f\u0c47',
  },
  // p339 #37 — సీతారామ్ (do not strip as సీ)
  {
    page: 339,
    songNo: 37,
    title:
      '\u0c38\u0c40\u0c24\u0c3e\u0c30\u0c3e\u0c2e\u0c4d\u200c \u0c15\u0c39\u0c4b \u0c38\u0c40\u0c24\u0c3e\u0c30\u0c3e\u0c2e\u0c4d\u200c \u0c15\u0c39\u0c4b',
  },
  // p348 #57
  {
    page: 348,
    songNo: 57,
    title:
      '\u0c24\u0c47\u0c30\u0c47 \u0c26\u0c30\u0c4d\u200c\u0c15\u0c4b \u0c1b\u0c4b\u0c21\u0c4d\u200c\u0c15\u0c47',
  },
  // p355 #73 — OCR misread 73 as (1
  {
    page: 355,
    songNo: 73,
    title:
      '\u0c39\u0c30\u0c3f \u0c28\u0c3e\u0c2e\u0c4d\u200c \u0c15\u0c3e \u0c2a\u0c4d\u0c2f\u0c3e\u0c32\u0c3e',
  },
  // p355 #74 — OCR mangled साँझ सवेरे
  {
    page: 355,
    songNo: 74,
    title:
      '\u0c38\u0c3e\u0c02\u0c1d\u0c4d\u200c \u0c38\u0c35\u0c47\u0c30\u0c47 - \u0c05\u0c27\u0c30\u0c4b\u0c02\u0c2e\u0c47 \u0c2e\u0c47\u0c30\u0c47',
  },
  // p365 #1 mangalaharati
  {
    page: 365,
    songNo: 1,
    title:
      '\u0c13\u0c02 \u0c1c\u0c48 \u0c1c\u0c17\u0c26\u0c40\u0c36\u0c39\u0c30\u0c47 \u0c38\u0c4d\u0c35\u0c3e\u0c2e\u0c3f',
  },
  // p269 #1 — strip OCR bang
  {
    page: 269,
    songNo: 1,
    title:
      '\u0c36\u0c3e\u0c02\u0c24\u0c3e\u0c15\u0c3e\u0c30\u0c02 \u0c2d\u0c41\u0c1c\u0c17\u0c33\u0c2f\u0c28\u0c02 \u0c2a\u0c26\u0c4d\u0c2e\u0c28\u0c3e\u0c2d\u0c02 \u0c38\u0c41\u0c30\u0c47\u0c36\u0c02',
  },
  // p167 #83 — OCR జ్జ్జాన → జ్ఞాన
  {
    page: 167,
    songNo: 83,
    title:
      '\u0c1c\u0c4d\u0c1e\u0c3e\u0c28 \u0c2e\u0c4a\u0c38\u0c17 \u0c30\u0c3e\u0c26\u0c3e! \u0c17\u0c30\u0c41\u0c21 \u0c17\u0c2e\u0c28!',
  },
];

const dest = new URL('./manual-title-fixes.json', import.meta.url);
fs.writeFileSync(dest, JSON.stringify(fixes, null, 2), 'utf8');
console.log('wrote', fixes.length, 'manual fixes');
