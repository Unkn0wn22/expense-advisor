const CATS = ['education','entertainment','food','health','housing','shopping','transport','utilities'];
const CURS = ['TZS','USD','KES','EUR','GBP','UGX','NGN','ZAR','INR','JPY','CAD','AUD','CNY'];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
let income = load('ea_income', {}), labels = load('ea_labels', {});
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
let expenses = load('ea_expenses', []), budgets = load('ea_budgets', []), editId = null, model = null;
const save = () => { localStorage.setItem('ea_expenses', JSON.stringify(expenses)); localStorage.setItem('ea_budgets', JSON.stringify(budgets)); localStorage.setItem('ea_income', JSON.stringify(income)); localStorage.setItem('ea_labels', JSON.stringify(labels)); };
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const money = (n, c) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: ['JPY','UGX','TZS'].includes(c) ? 0 : 2 }).format(n); } catch (e) { return n.toFixed(2) + ' ' + c; } };
const opts = (el, list, sel) => { el.innerHTML = list.map(x => `<option${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join(''); };

function init() {
  opts($('cat'), CATS); opts($('bCat'), ['all', ...CATS]); opts($('cur'), CURS, load('ea_lastcur', 'TZS')); opts($('bCur'), CURS, load('ea_lastcur', 'TZS')); opts($('aCur'), CURS, load('ea_lastcur', 'TZS'));
  $('btnInc').onclick = saveIncome; $('btnTrain').onclick = exportTrain;
  $('date').value = today();
  document.querySelectorAll('#nav button').forEach(b => b.onclick = () => showTab(b.dataset.t));
  $('btnPredict').onclick = doPredict; $('btnSave').onclick = saveExpense; $('btnBud').onclick = saveBudget;
  $('btnCsv').onclick = exportCsv; $('btnWipe').onclick = () => { if (confirm('Delete ALL expenses and budgets from this phone?')) { expenses = []; budgets = []; save(); render(); } };
  $('desc').addEventListener('keydown', e => { if (e.key === 'Enter') doPredict(); });
  loadModel(); render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e));
}
function showTab(t) {
  document.querySelectorAll('.tab').forEach(s => s.hidden = s.id !== 'tab-' + t);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  render(); window.scrollTo(0, 0);
}
async function loadModel() {
  try {
    const r = await fetch('expense_model.json'); if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json(); const errs = ExpenseModel.validate(m);
    if (errs.length) throw new Error(errs.join('; '));
    model = ExpenseModel.prepare(m);
    $('modelStatus').textContent = 'AI ready'; 
    const kind = m.type === 'tfidf_logistic_regression' ? 'TF-IDF + logistic regression' : 'Naive Bayes';
    $('modelInfo').textContent = `Loaded ${m.classes.length} categories, ${model.vocab.size} words/phrases (${kind}).`;
  } catch (e) {
    model = null; $('modelStatus').textContent = 'AI unavailable';
    $('modelInfo').textContent = 'Model not usable: ' + e.message + '. Pick categories manually, or fix the file (see README).';
  }
}
function splitParts(d) {
  // Several expenses in one sentence ("groceries and taxi"): predict each part separately and warn if they differ.
  const parts = d.split(/\s*(?:,|;|&|\+|\band\b|\bthen\b|\bna\b)\s*/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  const seen = {};
  parts.forEach(s => { const r = ExpenseModel.predict(model, s); if (r[0].known && r[0].prob >= 0.2 && r[0].prob >= 1.5 * r[1].prob) (seen[r[0].category] = seen[r[0].category] || []).push(s); });
  const cats = Object.keys(seen);
  return cats.length < 2 ? '' : '<div style="margin-top:6px">⚠️ This looks like <b>several expenses</b>: ' + cats.map(c => `"${esc(seen[c].join(', '))}" → ${esc(c)}`).join('; ') + '. For accurate totals, save them as separate entries.</div>';
}
function doPredict() {
  const d = $('desc').value.trim(), box = $('predBox');
  if (!d) { box.textContent = 'Type a description first.'; return; }
  const lab = labels[norm(d)], pre = lab ? `You chose <b>${esc(lab)}</b> for this before. ` : '';
  if (lab) $('cat').value = lab;
  if (!model) { box.innerHTML = pre + 'AI model is not loaded. Choose a category manually.'; return; }
  const r = ExpenseModel.predict(model, d);
  if (!r[0].known) { box.innerHTML = pre + 'The AI knows none of these words, so it can only guess. Please choose manually.'; return; }
  if (!lab) $('cat').value = r[0].category;
  box.innerHTML = pre + `AI suggests: <b>${esc(r[0].category)}</b> (${Math.round(r[0].prob * 100)}% confidence). Other options: ` +
    '<span class="chips">' + r.slice(1, 4).map(x => `<button type="button" data-c="${esc(x.category)}">${esc(x.category)} ${Math.round(x.prob * 100)}%</button>`).join('') + '</span>';
  box.insertAdjacentHTML('beforeend', splitParts(d));
  box.querySelectorAll('button').forEach(b => b.onclick = () => { $('cat').value = b.dataset.c; });
}
function saveExpense() {
  const desc = $('desc').value.trim(), amount = parseFloat($('amount').value);
  if (!desc) return msg('Please enter a description.');
  if (!(amount > 0)) return msg('Please enter an amount above 0.');
  const rec = { id: editId || Date.now() + '' + Math.random().toString(36).slice(2, 6), desc, amount, cur: $('cur').value, cat: $('cat').value, date: $('date').value || today() };
  if (editId) expenses = expenses.map(e => e.id === editId ? rec : e); else expenses.push(rec);
  labels[norm(desc)] = rec.cat; localStorage.setItem('ea_lastcur', rec.cur); editId = null; save();
  $('desc').value = ''; $('amount').value = ''; $('predBox').textContent = ''; $('btnSave').textContent = 'Save expense';
  msg('Saved ✔'); render();
}
const msg = t => { $('msg').textContent = t; };
function editExp(id) {
  const e = expenses.find(x => x.id === id); if (!e) return; editId = id;
  $('desc').value = e.desc; $('amount').value = e.amount; $('cur').value = e.cur; $('cat').value = e.cat; $('date').value = e.date;
  $('btnSave').textContent = 'Update expense'; showTab('add'); msg('Editing – change and tap Update.');
}
function delExp(id) { if (confirm('Delete this expense?')) { expenses = expenses.filter(e => e.id !== id); save(); render(); } }
function saveBudget() {
  const lim = parseFloat($('bLim').value); if (!(lim > 0)) return alert('Enter a limit above 0.');
  const b = { cat: $('bCat').value, cur: $('bCur').value, limit: lim };
  budgets = budgets.filter(x => !(x.cat === b.cat && x.cur === b.cur)); budgets.push(b); save(); $('bLim').value = ''; render();
}
function saveIncome() {
  const v = parseFloat($('aInc').value), c = $('aCur').value;
  if (v > 0) income[c] = v; else delete income[c];
  save(); $('aInc').value = ''; render();
}
function exportTrain() {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['description', 'category'], ...Object.entries(labels)];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
  a.download = 'my-category-choices.csv'; document.body.appendChild(a); a.click(); a.remove();
}
const sumBy = (list, f) => list.reduce((m, e) => { const k = f(e); m[k] = (m[k] || 0) + e.amount; return m; }, {});
function render() {
  const month = today().slice(0, 7), mExp = expenses.filter(e => e.date.startsWith(month));
  // Dashboard
  const curs = [...new Set(expenses.map(e => e.cur))];
  let h = '';
  if (!expenses.length) h = '<div class="card">No expenses yet. Add your first one!</div>';
  curs.forEach(c => {
    const all = expenses.filter(e => e.cur === c), mon = mExp.filter(e => e.cur === c), by = sumBy(mon, e => e.cat);
    const tot = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1]);
    h += `<div class="card"><h2>${esc(c)}</h2><div class="tot">${money(all.reduce((s, e) => s + e.amount, 0), c)}</div><div class="note">all-time · ${all.length} expenses · this month: ${money(tot, c)}</div>` +
      top.map(([k, v]) => `<div>${esc(k)} <span class="note">${money(v, c)}</span></div><div class="bar"><i style="width:${Math.round(v / tot * 100)}%"></i></div>`).join('') + '</div>';
  });
  if (expenses.length) h += '<div class="card"><h2>Recent</h2>' + sorted().slice(0, 5).map(itemHtml(false)).join('') + '</div>';
  $('dash').innerHTML = h;
  // History
  $('hist').innerHTML = expenses.length ? sorted().map(itemHtml(true)).join('') : '<p class="note">Nothing recorded yet.</p>';
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editExp(b.dataset.e));
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => delExp(b.dataset.d));
  // Advisor
  const rep = Advisor.advise(expenses, budgets, income, today(), money);
  $('adv').innerHTML = rep.length ? rep.map(r => `<div class="card"><h2>${esc(r.cur)}${income[r.cur] ? ' · income ' + money(income[r.cur], r.cur) : ''}</h2>` +
    r.tips.map(t => `<div class="tip">${t[0]} ${esc(t[1])}</div>`).join('') +
    (Object.keys(r.suggested).length ? `<button class="ghost" style="margin-top:10px" data-s="${esc(r.cur)}">Apply suggested budgets (${esc(r.basis)})</button><div class="note">${Object.entries(r.suggested).map(([c, v]) => esc(c) + ' ' + money(v, r.cur)).join(' · ')}</div>` : '') + '</div>').join('')
    : '<div class="card">Add some expenses to get advice.</div>';
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const r = rep.find(x => x.cur === b.dataset.s); for (const c in r.suggested) { budgets = budgets.filter(x => !(x.cat === c && x.cur === r.cur)); budgets.push({ cat: c, cur: r.cur, limit: r.suggested[c] }); } save(); render(); showTab('bud'); });
  // Budgets
  $('budList').innerHTML = budgets.length ? budgets.map((b, i) => {
    const sp = mExp.filter(e => e.cur === b.cur && (b.cat === 'all' || e.cat === b.cat)).reduce((s, e) => s + e.amount, 0), p = sp / b.limit;
    const st = p >= 1 ? 'over' : p >= .8 ? 'warn' : '', tx = p >= 1 ? '⚠️ Over budget' : p >= .8 ? '⚠️ Close to limit' : 'On track';
    return `<div>${esc(b.cat)} (${esc(b.cur)}): ${money(sp, b.cur)} / ${money(b.limit, b.cur)} · ${tx}</div><div class="bar ${st}"><i style="width:${Math.min(100, Math.round(p * 100))}%"></i></div><button class="danger" style="width:auto;padding:4px 10px;font-size:.8rem;margin-bottom:10px" data-b="${i}">Remove</button>`;
  }).join('') : '<p class="note">No budgets yet.</p>';
  document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { budgets.splice(+b.dataset.b, 1); save(); render(); });
}
const sorted = () => [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
const itemHtml = act => e => `<div class="item"><div>${esc(e.desc)}<small>${esc(e.cat)} · ${esc(e.date)}</small></div><div class="b">${money(e.amount, e.cur)}` +
  (act ? `<br><button data-e="${esc(e.id)}">Edit</button><button class="danger" data-d="${esc(e.id)}">Del</button>` : '') + '</div></div>';
function exportCsv() {
  const q = v => '"' + String(v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
  const rows = [['date','description','category','amount','currency'], ...sorted().map(e => [e.date, e.desc, e.cat, e.amount, e.cur])];
  const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'expenses-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}
init();
