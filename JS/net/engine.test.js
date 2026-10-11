// Kiểm tra logic phòng chơi bằng Node (không cần Firebase, không cần trình duyệt).
// Chạy:  node JS/net/engine.test.js     (mất khoảng nửa phút vì có ván chạy thật với bot)
const assert = require('assert');
require(require('path').join(__dirname, 'boss-rules.js'));
const R = globalThis.BossRules;
globalThis.vocabData = Array.from({ length: 300 }, (_, i) => ({ word: 'w' + i, meaning: ['m' + i] }));
require(require('path').join(__dirname, 'boss-net.js'));
const { Engine, MemoryServer, memoryStore } = globalThis.BossNet;

// rút ngắn thời gian để test chạy nhanh
Object.assign(R, { FIRST_STAGE_DELAY_MS: 150, BREAK_MS: 150, GRACE_MS: 60, OFFLINE_GRACE_MS: 400, MIN_SECONDS: 1, MAX_SECONDS: 1.4, SECONDS_STEP: 0.2 });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 4000, label = '') { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout: ' + label); await sleep(15); } }
const results = []; const ok = n => { results.push(n); console.log('  ✓', n); };

(async () => {
  /* ---------- 1. luật thuần ---------- */
  R.TARGET_ACCURACY = 0.7;
  const saved = { MIN: R.MIN_SECONDS, MAX: R.MAX_SECONDS, STEP: R.SECONDS_STEP };
  Object.assign(R, { MIN_SECONDS: 40, MAX_SECONDS: 60, SECONDS_STEP: 5 });
  assert.deepStrictEqual([2, 5, 6, 10, 11, 30].map(R.stageCount), [3, 3, 4, 4, 5, 5]);
  assert.strictEqual(R.hpShare(), 7);
  assert.deepStrictEqual([3, 4, 5].map(s => R.maxHp(1, s)), [21, 28, 35]);
  assert.strictEqual(R.maxHp(4, 3), 84);
  assert.deepStrictEqual([1, 2, 3].map(n => R.stageSeconds(n, 3)), [40, 50, 60]);
  assert.deepStrictEqual([1, 2, 3, 4].map(n => R.stageSeconds(n, 4)), [40, 45, 55, 60]);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(n => R.stageSeconds(n, 5)), [40, 45, 50, 55, 60]);
  assert.strictEqual(R.hpLostOnLeave(3, 0, 0), 21);      // rời ngay từ đầu: bớt cả phần 21
  assert.strictEqual(R.hpLostOnLeave(3, 1, 0), 14);
  assert.strictEqual(R.hpLostOnLeave(3, 1, 4), 10);      // đã ghi 4 điểm ở giai đoạn dở dang
  assert.strictEqual(R.hpLostOnLeave(3, 2, 9), 0);       // ghi vượt phần của mình thì không bớt thêm
  const a = R.shuffleFor('p_a', 'q:1', [1, 2, 3, 4, 5, 6, 7, 8]), b = R.shuffleFor('p_a', 'q:1', [1, 2, 3, 4, 5, 6, 7, 8]), c = R.shuffleFor('p_b', 'q:1', [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a, c); assert.deepStrictEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  Object.assign(R, { MIN_SECONDS: saved.MIN, MAX_SECONDS: saved.MAX, SECONDS_STEP: saved.STEP });
  ok('luật: số giai đoạn, HP, thời gian, rời giữa ván, xáo riêng');

  /* ---------- dựng phòng 3 người ---------- */
  const server = new MemoryServer();
  const mk = (name, extra) => ({ eng: new Engine(server.connect(), Object.assign({ storage: memoryStore() }, extra)), name });
  const mkClient = () => server.connect();
  let hostC = mkClient(), bobC = mkClient(), caraC = mkClient();
  const host = new Engine(hostC, { storage: memoryStore() });
  const bob = new Engine(bobC, { storage: memoryStore() });
  const cara = new Engine(caraC, { storage: memoryStore() });

  const code = await host.createRoom('An');
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await assert.rejects(() => bob.joinRoom('ZZZZZZ', 'Bob'), e => e.code === 'ROOM_NOT_FOUND');
  await sleep(5);                                          // cách nhau vài ms để thứ tự vào phòng cố định
  await bob.joinRoom(code.toLowerCase(), 'Bob');
  await sleep(5);
  await cara.joinRoom(code, 'an');                        // trùng tên với chủ phòng
  await until(() => host.getPlayers().length === 3, 2000, 'lobby 3 người');
  const names = host.getPlayers().map(p => p.name);
  assert.deepStrictEqual(names, ['An', 'Bob', 'an (2)']);
  assert.ok(host.isHost() && !bob.isHost());
  ok('tạo phòng, vào bằng mã (không phân biệt hoa thường), tên trùng được đánh số');

  /* ---------- chọn chế độ chơi ở sảnh chờ ---------- */
  const modeSeen = []; bob.onModeChange(m => modeSeen.push(m));
  await until(() => modeSeen.length === 1, 2000, 'bob nhận trạng thái chế độ ban đầu');
  assert.strictEqual(modeSeen[0], null);                   // chưa chọn gì
  await assert.rejects(() => bob.setMode('bossBattle'), e => e.code === 'NOT_HOST');
  await assert.rejects(() => host.setMode('boss battle!'), e => e.code === 'BAD_MODE');
  await host.setMode('race');
  await until(() => bob.getMode() === 'race', 2000, 'bob thấy chế độ race');
  assert.strictEqual(modeSeen[modeSeen.length - 1], 'race');
  await assert.rejects(() => host.startGame(), e => e.code === 'MODE_UNAVAILABLE');   // chế độ chưa có thì không bắt đầu được
  await host.setMode('bossBattle');
  await until(() => modeSeen[modeSeen.length - 1] === 'bossBattle', 2000, 'bob thấy bossBattle');
  ok('chủ phòng chọn chế độ, cả phòng thấy; chế độ chưa có không bắt đầu được; người thường không chọn được');

  await assert.rejects(() => bob.startGame(), e => e.code === 'NOT_HOST');
  ok('người không phải host không được bắt đầu');

  /* ---------- 2. ván thắng ---------- */
  const ev = { stageStart: [], stageEnd: [], end: null, leave: [], scores: 0 };
  host.onStageStart(s => ev.stageStart.push(s)); host.onStageEnd(s => ev.stageEnd.push(s)); host.onGameEnd(e => ev.end = e); host.onPlayerLeave(p => ev.leave.push(p)); host.onScoresUpdate(() => ev.scores++);
  const bobStages = []; bob.onStageStart(s => bobStages.push(s));
  await host.startGame();
  await assert.rejects(() => host.startGame(), e => e.code === 'ALREADY_STARTED');
  await until(() => ev.stageStart.length === 1 && bobStages.length === 1, 2000, 'stage 1');
  const s1 = ev.stageStart[0];
  assert.strictEqual(s1.stageCount, 3); assert.strictEqual(s1.maxHp, 3 * 3 * 7); assert.strictEqual(s1.questions, 10);
  assert.strictEqual(s1.words.length, 10); assert.ok(s1.msUntilStart > 0 && s1.msUntilStart <= R.FIRST_STAGE_DELAY_MS);
  assert.deepStrictEqual(bobStages[0].words, s1.words);   // cả phòng cùng một bộ từ
  assert.ok([0, 1, 2, 3, 4].includes(s1.boss));
  ok('bắt đầu ván: 3 người -> 3 giai đoạn, HP 63, 10 từ dùng chung');

  const late = new Engine(mkClient(), { storage: memoryStore() });
  await assert.rejects(() => late.joinRoom(code, 'Muộn'), e => e.code === 'ROOM_STARTED');
  ok('vào phòng đã bắt đầu bị từ chối');

  // mỗi người đúng cả 10 câu -> mỗi giai đoạn 30 sát thương, HP 63 => thắng sau giai đoạn 3? 30+30=60<63, giai đoạn 3 => thắng
  const all = [host, bob, cara];
  async function playStage(n, perPlayer) {
    await until(() => host.room.current === n && Date.now() + 0 >= host.room.stages['s' + n].startAt, 3000, 'đến giờ stage ' + n);
    for (const [i, e] of all.entries()) { for (let k = 1; k <= perPlayer[i]; k++) await e.sendScore(n, k); await e.sendDone(n); }
  }
  await playStage(1, [10, 10, 10]);
  assert.strictEqual(await host.sendScore(1, 5), false);   // điểm không giảm
  await until(() => ev.stageEnd.length === 1, 2000, 'stageEnd 1');
  assert.strictEqual(ev.stageEnd[0].damage, 30); assert.strictEqual(ev.stageEnd[0].hp, 33);
  ok('mọi người xong sớm -> host chốt giai đoạn 1 ngay (không đợi hết giờ), boss còn 33 máu');

  await playStage(2, [10, 10, 10]);
  await until(() => ev.stageEnd.length === 2, 2000, 'stageEnd 2');
  assert.strictEqual(ev.stageEnd[1].hp, 3); assert.strictEqual(ev.end, null);
  await playStage(3, [10, 8, 3]);
  await until(() => ev.end, 2000, 'game end');
  assert.strictEqual(ev.end.outcome, 'win'); assert.strictEqual(ev.end.hp, 0);
  assert.strictEqual(ev.end.mvp.name, 'An'); assert.deepStrictEqual(ev.end.ranking.map(r => r.total), [30, 28, 23]);
  assert.strictEqual(ev.stageStart.length, 3); assert.ok(ev.scores > 3);
  const used = new Set(); ev.stageStart.forEach(s => s.words.forEach(w => used.add(w.word))); assert.strictEqual(used.size, 30);
  ok('ván thắng: boss về 0 ở giai đoạn 3, MVP đúng, 30 từ không trùng giữa các giai đoạn');
  host._teardown(); bob._teardown(); cara._teardown();

  /* ---------- 3. ván thua + hết giờ không ai bấm xong ---------- */
  const s2 = new MemoryServer();
  const e1 = new Engine(s2.connect(), { storage: memoryStore() }), e2 = new Engine(s2.connect(), { storage: memoryStore() });
  const c2 = await e1.createRoom('Lan'); await e2.joinRoom(c2, 'Minh');
  let end2 = null; e1.onGameEnd(e => end2 = e);
  const stEnds = []; e1.onStageEnd(s => stEnds.push(s));
  await e1.startGame();
  const t0 = Date.now();
  await until(() => e1.room.current === 1 && e1.serverNow() >= e1.room.stages.s1.startAt, 3000, 'start');
  await e1.sendScore(1, 2);                                   // chỉ 2 điểm, không ai gửi done
  await until(() => stEnds.length === 1, 4000, 'hết giờ stage 1');
  const dur1 = e1.room.stages.s1.durationSec * 1000;
  assert.ok(Date.now() - e1.room.stages.s1.startAt >= dur1, 'phải đợi hết giờ mới chốt');
  await until(() => end2, 8000, 'thua');
  assert.strictEqual(end2.outcome, 'lose'); assert.ok(end2.hp > 0); assert.strictEqual(end2.stageCount, 3);
  ok('ván thua: hết giai đoạn cuối mà boss còn máu; không ai báo xong thì đợi hết giờ');
  e1._teardown(); e2._teardown();

  /* ---------- 4. rời giữa ván + host rớt mạng ---------- */
  const s3 = new MemoryServer();
  const cl = [s3.connect(), s3.connect(), s3.connect()];
  const [h, p2, p3] = cl.map(c => new Engine(c, { storage: memoryStore() }));
  const c3 = await h.createRoom('Host'); await p2.joinRoom(c3, 'Hai'); await p3.joinRoom(c3, 'Ba');
  await until(() => h.getPlayers().length === 3, 2000, 'lobby');
  const leaves = []; h.onPlayerLeave(x => leaves.push(x)); p2.onPlayerLeave(() => { });
  await h.startGame();
  await until(() => h.room.current === 1 && h.serverNow() >= h.room.stages.s1.startAt, 3000, 'start');
  await p3.sendScore(1, 4);
  await until(() => (h.room.scores[p3.id] || {}).s1, 1000, 'điểm Ba');
  await p3.leaveRoom();                                        // Ba thoát chủ động giữa giai đoạn 1 (đã ghi 4 điểm)
  await until(() => leaves.length === 1, 3000, 'playerLeave');
  assert.strictEqual(leaves[0].name, 'Ba'); assert.strictEqual(leaves[0].reduction, 21 - 4 > 21 ? 0 : 21 - 4);   // 3 giai đoạn x 7 - min(7,4) = 17
  assert.strictEqual(h.getSummary().effectiveMaxHp, 63 - 17); assert.strictEqual(h.getSummary().totalDamage, 4);
  ok('người rời giữa giai đoạn: boss bớt 17 máu (21 - 4 điểm đã ghi), điểm đã ghi vẫn tính');

  // host rớt mạng -> người vào sớm nhất còn lại (Hai) nhận host sau thời gian chờ
  let tHost = Date.now();
  cl[0].disconnect(); h._teardown();
  await until(() => p2.isHost(), 4000, 'host mới');
  assert.ok(Date.now() - tHost >= R.OFFLINE_GRACE_MS - 50, 'phải chờ hết thời gian chờ mới đổi host');
  ok('host rớt mạng: chờ ' + R.OFFLINE_GRACE_MS + 'ms rồi người vào sớm nhất tự nhận host');

  // host mới chốt tiếp được ván
  let end3 = null; p2.onGameEnd(e => end3 = e);
  await until(() => p2.room.state === 'finished' || p2.room.current >= 2, 8000, 'host mới chốt giai đoạn');
  ok('host mới tiếp tục chốt giai đoạn, ván không bị kẹt');
  await until(() => end3, 10000, 'kết thúc ván 3');
  assert.strictEqual(end3.outcome, 'lose');
  assert.ok(!end3.ranking.find(r => r.name === 'Host') === false);   // Host cũ vẫn nằm trong bảng xếp hạng
  p2._teardown();

  /* ---------- 5. nối lại sau khi chuyển trang (resume) ---------- */
  const s4 = new MemoryServer();
  const store = memoryStore();
  const cA = s4.connect(); const A = new Engine(cA, { storage: store });
  const c4 = await A.createRoom('Nga'); const Bx = new Engine(s4.connect(), { storage: memoryStore() }); await Bx.joinRoom(c4, 'Oanh');
  await until(() => A.getPlayers().length === 2, 2000, 'lobby');
  await A.startGame();
  A._teardown(); cA.disconnect();                             // "chuyển sang trang game": ngắt kết nối cũ
  await sleep(100);
  const A2 = new Engine(s4.connect(), { storage: store });    // trang mới, cùng sessionStorage
  const stSeen = []; A2.onStageStart(s => stSeen.push(s));
  const r = await A2.resume();
  assert.ok(r && r.code === c4 && r.state === 'playing');
  assert.strictEqual(A2.id, A.id); assert.ok(A2.isHost());
  await until(() => stSeen.length === 1, 1000, 'phát lại stage hiện tại');
  assert.strictEqual(stSeen[0].stage, 1);
  await sleep(200);
  assert.strictEqual(A2.room.players[A.id].online, true);
  ok('chuyển trang rồi resume(): vẫn là cùng người chơi, nhận lại giai đoạn đang chạy, trạng thái online được bật lại');

  const stranger = new Engine(s4.connect(), { storage: memoryStore() });
  assert.strictEqual(await stranger.resume(), null);
  ok('resume() không có phiên thì trả về null');

  /* ---------- 6. offline quá lâu trong sảnh bị dọn, phòng trống bị xóa ---------- */
  const s5 = new MemoryServer(); const hc = s5.connect(), gc = s5.connect();
  const H = new Engine(hc, { storage: memoryStore() }), G = new Engine(gc, { storage: memoryStore() });
  const c5 = await H.createRoom('Chủ'); await G.joinRoom(c5, 'Khách');
  await until(() => H.getPlayers().length === 2, 2000, 'sảnh');
  gc.disconnect(); G._teardown();
  await until(() => H.getPlayers().length === 1, 3000, 'dọn khách offline');
  await H.leaveRoom();
  assert.strictEqual(s5.dump().rooms, undefined);
  ok('khách mất kết nối quá lâu bị dọn khỏi sảnh; người cuối rời thì phòng bị xóa');

  /* ---------- 7. solo với bot chạy trọn một ván ---------- */
  Object.assign(R, { MIN_SECONDS: 1.5, MAX_SECONDS: 2.1, SECONDS_STEP: 0.1 });
  const solo = await globalThis.BossNet.createSolo({ playerName: 'Tôi', bots: 3 });
  assert.strictEqual(solo.getPlayers().length, 4);
  let endS = null; solo.onGameEnd(e => endS = e);
  const stS = []; solo.onStageStart(s => stS.push(s));
  await solo.startGame();
  await until(() => endS, 20000, 'solo kết thúc');
  assert.ok(['win', 'lose'].includes(endS.outcome)); assert.strictEqual(stS[0].maxHp, 4 * 3 * 7);
  assert.ok(endS.ranking.length === 4 && endS.ranking[0].total >= endS.ranking[3].total);
  ok('createSolo: 3 bot tự chơi trọn ván -> ' + endS.outcome.toUpperCase() + ', ' + stS.length + ' giai đoạn, HP boss 84');
  solo._teardown(); solo.bots.forEach(b => { b.stopBrain(); b._teardown(); });

  console.log('\nTẤT CẢ ' + results.length + ' NHÓM KIỂM TRA ĐỀU ĐẠT');
  process.exit(0);
})().catch(e => { console.error('\n✗ THẤT BẠI:', e.message); console.error(e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); });
