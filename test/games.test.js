/**
 * games.test.js — unit tests for games (shell + snake + quiz + puzzle + ludo)
 */
import { strict as assert } from 'node:assert';
import { createSandbox, loadScriptsInOrder } from './setup.js';

const { dom, window, sandbox } = createSandbox();

loadScriptsInOrder(sandbox, ['games.js', 'g-tebak.js', 'g-quiz.js', 'g-puzzle.js', 'g-ludo.js', 'g-tic.js']);

const Games = sandbox.window.Games;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('\n=== games.test.js ===\n');

// vm-realm arrays fail strict deepEqual — compare via JSON
function eq(a, b, msg) {
  assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
}

// --- shell ---
console.log('shell:');
test('registry has 5 games', () => {
  assert.ok(Games._impl.tebak, 'tebak');
  assert.ok(Games._impl.quiz, 'quiz');
  assert.ok(Games._impl.puzzle, 'puzzle');
  assert.ok(Games._impl.ludo, 'ludo');
  assert.ok(Games._impl.tic, 'tic');
});
test('openGames shows modal + menu', () => {
  sandbox.openGames();
  assert.ok(sandbox.document.getElementById('mgames').classList.contains('show'));
  assert.notEqual(sandbox.document.getElementById('gmenu').style.display, 'none');
  sandbox.closeGames();
});
test('closeGames hides modal', () => {
  sandbox.openGames();
  sandbox.closeGames();
  assert.ok(!sandbox.document.getElementById('mgames').classList.contains('show'));
});
test('best labels render', () => {
  sandbox.openGames();
  assert.ok(sandbox.document.getElementById('gb-tebak').textContent.includes('Belum main'));
  sandbox.localStorage.setItem('g-tebak-best', '120');
  sandbox.openGames();
  const el = sandbox.document.getElementById('gb-tebak');
  assert.ok(el.textContent.includes('120'));
  assert.ok(el.classList.contains('has'), 'gold class');
  sandbox.localStorage.removeItem('g-tebak-best');
  sandbox.closeGames();
});

// --- tebak kata ---
console.log('\ntebak kata:');
test('registry tebak', () => {
  assert.ok(Games._impl.tebak, 'tebak registered');
});
test('norm strips case/punct', () => {
  assert.equal(Games.TEBAK.norm('  Beru-Ang! '), 'beruang');
});
test('match exact + fuzzy', () => {
  assert.ok(Games.TEBAK.match('BERUANG', ['beruang']));
  assert.ok(Games.TEBAK.match('jawabnya beruang kali', ['beruang']));
  assert.ok(!Games.TEBAK.match('kucing', ['beruang']));
  assert.ok(!Games.TEBAK.match('', ['beruang']));
});
test('mask reveals progressively', () => {
  assert.equal(Games.TEBAK.mask('beruang', 0), '_ _ _ _ _ _ _  (7 huruf)');
  assert.equal(Games.TEBAK.mask('beruang', 2), 'b e _ _ _ _ _  (7 huruf)');
});
test('bank has 20 valid riddles', () => {
  const b = Games.TEBAK.BANK;
  assert.equal(b.length, 20);
  b.forEach((r, i) => {
    assert.ok(r.q && r.q.length > 5, 'q' + i);
    assert.ok(r.a && r.a.length > 0, 'a' + i);
  });
});

// --- quiz ---
console.log('\nquiz:');
test('bank has 15 valid questions', () => {
  const b = Games.QUIZ.BANK;
  assert.equal(b.length, 15);
  b.forEach((q, i) => {
    assert.equal(q.opts.length, 4, `q${i} opts`);
    assert.ok(q.a >= 0 && q.a < 4, `q${i} answer range`);
  });
});
test('grade thresholds', () => {
  assert.ok(Games.QUIZ.grade(90, 100).startsWith('S'));
  assert.ok(Games.QUIZ.grade(75, 100).startsWith('A'));
  assert.ok(Games.QUIZ.grade(55, 100).startsWith('B'));
  assert.ok(Games.QUIZ.grade(35, 100).startsWith('C'));
  assert.ok(Games.QUIZ.grade(10, 100).startsWith('D'));
});

// --- puzzle ---
console.log('\npuzzle:');
test('solved detection', () => {
  assert.ok(Games.PUZZLE.isSolved(Games.PUZZLE.solved()));
  assert.ok(!Games.PUZZLE.isSolved([1, 2, 3, 4, 5, 6, 7, 0, 8]));
});
test('canMove adjacency', () => {
  const t = [1, 2, 3, 4, 5, 6, 7, 0, 8]; // hole idx 7
  assert.ok(Games.PUZZLE.canMove(t, 6), 'left neighbor');
  assert.ok(Games.PUZZLE.canMove(t, 8), 'right neighbor');
  assert.ok(Games.PUZZLE.canMove(t, 4), 'top neighbor');
  assert.ok(!Games.PUZZLE.canMove(t, 0), 'far tile');
  assert.ok(!Games.PUZZLE.canMove(t, 7), 'hole itself');
});

// --- ludo ---
console.log('\nludo:');
test('PATH has 52 cells', () => {
  assert.equal(Games.LUDO.PATH.length, 52);
});
test('cellFor base + start', () => {
  eq(Games.LUDO.cellFor('G', -1, 0), [2, 11]);
  eq(Games.LUDO.cellFor('R', 0, 0), [6, 1]);
  eq(Games.LUDO.cellFor('G', 0, 0), [1, 8]);
});
test('no exit without 6', () => {
  const st = Games.LUDO.newState();
  eq(Games.LUDO.legalMoves(st, 'G', 3), []);
});
test('all exit on 6', () => {
  const st = Games.LUDO.newState();
  const mv = Games.LUDO.legalMoves(st, 'G', 6);
  assert.equal(mv.length, 4);
  assert.ok(mv.every((m) => m.to === 0));
});
test('exact roll to finish', () => {
  const st = Games.LUDO.newState();
  st.toks.G = [54, 56, 56, 56];
  const ok = Games.LUDO.legalMoves(st, 'G', 2);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].to, 56);
  const no = Games.LUDO.legalMoves(st, 'G', 3);
  assert.equal(no.length, 0);
});
test('capture on non-safe cell', () => {
  const st = Games.LUDO.newState();
  // R token at ring steps 0 -> cell [6,1] (safe!). use G steps to land [6,2]?
  // simpler: R at steps 1 -> [6,2] non-safe; G from base needs 6 then moves... craft:
  // put R token pos 1 ([6,2]); G token pos 0 is [1,8]... use direct applyMove:
  // G steps such that lands [6,2]: G start 13, need (13+s)%52 == 1 -> s = 40. G pos 39 + dice 1.
  st.toks.R = [1, -1, -1, -1]; // [6,2]
  st.toks.G = [39, -1, -1, -1]; // (13+39)%52=0 -> [6,1]
  const res = Games.LUDO.applyMove(st, 'G', { i: 0, to: 40 }); // (13+40)%52=1 -> [6,2]
  assert.ok(res.captured, 'should capture');
  assert.equal(st.toks.R[0], -1, 'R sent home');
});
test('no capture on safe cell', () => {
  const st = Games.LUDO.newState();
  st.toks.R = [0, -1, -1, -1]; // [6,1] safe
  // G land [6,1]: (13+s)%52==0 -> s=39. G pos 38 + 1.
  st.toks.G = [38, -1, -1, -1];
  const res = Games.LUDO.applyMove(st, 'G', { i: 0, to: 39 });
  assert.ok(!res.captured, 'safe, no capture');
  assert.equal(st.toks.R[0], 0, 'R stays');
});

// --- tictactoe ---
console.log('\ntictactoe:');
test('winner detects rows/cols/diags', () => {
  assert.equal(Games.TIC.winner(['X','X','X','','','','','','']).p, 'X');
  assert.equal(Games.TIC.winner(['','','','O','O','O','','','']).p, 'O');
  assert.equal(Games.TIC.winner(['X','','','X','','','X','','']).p, 'X');
  assert.equal(Games.TIC.winner(['','','O','','O','','O','','']).p, 'O');
  assert.equal(Games.TIC.winner(['X','O','X','X','O','O','O','X','X']), 'D');
  assert.equal(Games.TIC.winner(['X','','','','','','','','']), null);
});
test('cpu takes winning move', () => {
  assert.equal(Games.TIC.cpuMove(['O','O','','X','','','','','']), 2);
});
test('cpu blocks opponent', () => {
  assert.equal(Games.TIC.cpuMove(['X','X','','O','','','','','']), 2);
});
test('cpu prefers center on empty', () => {
  assert.equal(Games.TIC.cpuMove(['','','','','','','','','']), 4);
});
test('decisive detects immediate win', () => {
  assert.equal(Games.TIC.decisive(['O','O','','X','','','','',''], 2, 'O'), true);
  assert.equal(Games.TIC.decisive(['O','','','X','','','','',''], 2, 'O'), false);
});

Games.stop();
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
