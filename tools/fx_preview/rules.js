// UrhoX 特效规则（与 Renderer.lua 一一对应），供预览页使用
(function () {
  var MODEL_COL = { fx_white: [1, 1, 1], fx_white_bolt: [1, 1, 1], fx_spark: [1, .702, .2784], fx_laser_player: [.3608, .949, .8627], fx_laser_enemy: [1, .302, .4157] };
  function boost(c, k) { var g = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; return c.map(function (v) { return Math.max(0, Math.min(1, g + (v - g) * k)); }); }
  function fxColor(id, tint) {
    var c;
    if (tint) { var r = Math.max(0, tint[0]), g = Math.max(0, tint[1]), b = Math.max(0, tint[2]), m = Math.max(r, g, b); if (m > 1) { r /= m; g /= m; b /= m; }
      c = [r, g, b].map(function (v) { return Math.pow(Math.floor(v * 8 + .5) / 8, 1 / 2.2); }); }
    else c = MODEL_COL[id];
    var mx = Math.max(c[0], c[1], c[2], 1e-4); return boost([c[0] / mx, c[1] / mx, c[2] / mx], 1.35);
  }
  window.__fxColor = fxColor;
  var ADD = { fx_white: 1, fx_white_bolt: 1, fx_spark: 1, fx_laser_player: 1, fx_laser_enemy: 1 };
  var rules = {};
  rules.old = function (d) {                                   // v1.4.8
    var id = d.mesh.id; if (!ADD[id]) return null;
    var k = (d.kind || 0) === 0 ? (d.tint ? 0.32 : 0.45) : (d.s > 6 ? 0.7 : 0.9), c = fxColor(id, d.tint), HALO = { fx_white: 1, fx_spark: .8 };
    var r = { col: c.map(function (v) { return v * k; }) };
    if (HALO[id] && (d.kind || 0) !== 0 && d.s <= 4) r.halo = { col: c.map(function (v) { return v * 0.18 * HALO[id]; }), scale: 1.8, rot: 1 };
    return r;
  };
  // ---- 新方案：按角色（推进器 / 机甲攻击 / 敌人攻击 / 冲击环 / 粒子）分别处理；细长弹道用“粗而短”的彩色光套，不再整体放大或斜转
  var ELONG = { fx_white_bolt: 1, fx_laser_player: 1, fx_laser_enemy: 1 }, E_CORE = [1.25, 0.5, 0.6];
  var LV = [0.02, 0.035, 0.05, 0.065, 0.08, 0.1, 0.13, 0.16, 0.2, 0.25, 0.3, 0.36, 0.45, 0.55, 0.65, 0.75, 0.85];
  function qk(k) { var b = LV[0]; for (var i = 0; i < LV.length; i++) if (Math.abs(LV[i] - k) < Math.abs(b - k)) b = LV[i]; return b; }
  window.__qk = qk;
  rules.new = function (d) {
    var id = d.mesh.id; if (!ADD[id]) return null;
    var role = d.role, a = d.a == null ? 1 : d.a, tint = d.tint;
    if (role === 'e' && !tint) tint = E_CORE;
    var c = fxColor(id, tint), mul = function (k) { k = qk(k); return c.map(function (v) { return v * k; }); }, r = { halos: [] };
    if (role === 'thrust') { r.col = mul(tint ? 0.03 + 0.07 * a : 0.13); r.sc = 0.8; return r; }
    var fade = role === 'fx' ? (a > 0.6 ? 1 : a > 0.35 ? 0.7 : a > 0.15 ? 0.45 : 0.25) : role === 'nova' ? (a > 0.6 ? 1 : a > 0.3 ? 0.65 : 0.35) : 1;
    var thin = ELONG[id] && d.s <= 2.4, k = role === 'e' ? (thin ? 0.45 : 0.8) : role === 'nova' ? 0.7 : 0.85;
    if (d.s > 6) k = Math.min(k, 0.6);
    r.col = mul(k * fade);
    if (ELONG[id]) {                                          // 细长弹道：三层由内到外渐淡的彩色光套（横向粗、纵向只略长），边缘不明显
      var e = role === 'e', g = thin ? 0.5 : 1;
      r.halos.push({ col: mul((e ? 0.2 : 0.16) * g), s: [1.7, 1.7, 1.06] });
      r.halos.push({ col: mul((e ? 0.1 : 0.08) * g), s: [2.5, 2.5, 1.12] });
      if (!thin) r.halos.push({ col: mul(e ? 0.045 : 0.035), s: [3.4, 3.4, 1.2] });
    } else if ((id === 'fx_white' || id === 'fx_spark') && d.s <= 4 && role !== 'nova') {
      r.halos.push({ col: mul(0.12 * fade), s: 1.9, rot: 1 }); if (fade >= 0.7) r.halos.push({ col: mul(0.05 * fade), s: 2.8, rot: 1 });
    } else if (d.s > 6) { r.halos.push({ col: mul(0.1), s: 1.5 }); r.halos.push({ col: mul(0.04), s: 2.1 }); }
    return r;
  };
  rules.nothrust = function (d) { if (d.role === 'thrust') return { col: [0, 0, 0] }; return rules.new(d); };
  window.__rules = rules;
  window.__urhoRule = function (d) { return rules[window.__ruleSet || 'old'](d); };
  window.__urhoBloom = function (env) { return { thr: Math.min(0.9, Math.pow(env.bloom.threshold, 1 / 2.2) * 0.94), mix: env.bloom.mix * 0.78 }; };
  window.__m4local = function (m, rot, sc) {
    var L;
    if (rot) { var w = 0.92388, x = 0.22095, y = x, z = x;
      L = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1];
    } else L = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    var sv = typeof sc === 'number' ? [sc, sc, sc] : sc;
    for (var i = 0; i < 3; i++) { L[i] *= sv[0]; L[4 + i] *= sv[1]; L[8 + i] *= sv[2]; }
    var o = new Float32Array(16);
    for (var col = 0; col < 4; col++) for (var row = 0; row < 4; row++) { var s = 0; for (var k = 0; k < 4; k++) s += m[k * 4 + row] * L[col * 4 + k]; o[col * 4 + row] = s; }
    return o;
  };
})();
