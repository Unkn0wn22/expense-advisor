// Rule-based budget advice from the user's own numbers. NOT the AI model.
(function (root) {
  const NEEDS = ['housing', 'utilities', 'food', 'health', 'transport', 'education'], WANTS = ['entertainment', 'shopping'];
  const prevMonth = m => { const [y, mo] = m.split('-').map(Number), d = new Date(y, mo - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const sumBy = list => list.reduce((o, e) => { o[e.cat] = (o[e.cat] || 0) + e.amount; return o; }, {});
  const total = o => Object.values(o).reduce((a, b) => a + b, 0);
  const step = a => a >= 100000 ? 5000 : a >= 10000 ? 1000 : a >= 1000 ? 100 : 1;
  function advise(expenses, budgets, income, todayStr, money) {
    const month = todayStr.slice(0, 7), [y, mo, day] = todayStr.split('-').map(Number), dim = new Date(y, mo, 0).getDate();
    const curs = [...new Set([...expenses.map(e => e.cur), ...Object.keys(income)])];
    return curs.map(cur => {
      const ex = expenses.filter(e => e.cur === cur), now = sumBy(ex.filter(e => e.date.startsWith(month)));
      const spent = total(now), f = dim / Math.max(day, 1), projected = spent * f;
      const last = sumBy(ex.filter(e => e.date.startsWith(prevMonth(month)))), lastSpent = total(last);
      const tips = [];
      if (!spent && !lastSpent) tips.push(['ℹ️', 'No expenses recorded this month yet.']);
      if (spent && day < 5) tips.push(['ℹ️', 'Early in the month, so forecasts are rough.']);
      if (spent) tips.push(['📈', `At this pace you will spend about ${money(projected, cur)} by month end.`]);
      if (spent && lastSpent) { const p = Math.round((projected / lastSpent - 1) * 100); if (Math.abs(p) >= 10) tips.push([p > 0 ? '⚠️' : '✅', `On pace to spend ${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} than last month (${money(lastSpent, cur)}).`]); }
      const top = Object.entries(now).sort((a, b) => b[1] - a[1])[0];
      if (top && spent && top[1] / spent > 0.4 && Object.keys(now).length > 1) tips.push(['🔎', `${top[0]} is ${Math.round(top[1] / spent * 100)}% of this month's spending. Check if you can trim it.`]);
      for (const c in now) if (last[c] > 0 && now[c] * f > 1.5 * last[c] && now[c] > 0.1 * spent) tips.push(['⚠️', `${c} is growing fast: about ${money(now[c] * f, cur)} expected vs ${money(last[c], cur)} last month.`]);
      budgets.filter(b => b.cur === cur).forEach(b => {
        const sp = b.cat === 'all' ? spent : (now[b.cat] || 0), pr = sp * f;
        if (sp >= b.limit) tips.push(['🚨', `${b.cat} budget is exceeded (${money(sp, cur)} of ${money(b.limit, cur)}).`]);
        else if (pr > b.limit && sp > 0) tips.push(['⚠️', `${b.cat} is on pace to pass its ${money(b.limit, cur)} budget (expected ${money(pr, cur)}).`]);
      });
      const inc = income[cur];
      if (inc > 0) {
        const left = inc - projected, rate = left / inc;
        tips.push([rate < 0 ? '🚨' : rate < 0.1 ? '⚠️' : '✅', rate < 0 ? `Expected spending is above your income by ${money(-left, cur)}.` : `Expected savings: ${money(left, cur)} (${Math.round(rate * 100)}% of income). A common goal is 20%.`]);
        const pc = cs => cs.reduce((s, c) => s + (now[c] || 0), 0) * f / inc * 100;
        if (spent && pc(NEEDS) > 50) tips.push(['ℹ️', `Needs (housing, utilities, food, health, transport, education) are about ${Math.round(pc(NEEDS))}% of income; the rule of thumb is 50%.`]);
        if (spent && pc(WANTS) > 30) tips.push(['ℹ️', `Wants (entertainment, shopping) are about ${Math.round(pc(WANTS))}% of income; the rule of thumb is 30%.`]);
      } else if (spent) tips.push(['ℹ️', 'Add your monthly income to see savings advice.']);
      // suggested budgets: average of up to 3 previous months, else this month's forecast
      const prev = []; let m = month; for (let i = 0; i < 3; i++) { m = prevMonth(m); const s = sumBy(ex.filter(e => e.date.startsWith(m))); if (total(s)) prev.push(s); }
      const suggested = {};
      CATS_ALL(now, prev).forEach(c => {
        const avg = prev.length ? prev.reduce((s, p) => s + (p[c] || 0), 0) / prev.length : (now[c] || 0) * f;
        const st = step(avg), v = Math.round(avg * 0.95 / st) * st; if (v > 0) suggested[c] = v;
      });
      return { cur, spent, projected, lastSpent, tips, suggested, basis: prev.length ? `average of your last ${prev.length} month(s)` : "this month's forecast" };
    });
  }
  const CATS_ALL = (now, prev) => [...new Set([...Object.keys(now), ...prev.flatMap(Object.keys)])];
  const api = { advise };
  if (typeof module !== 'undefined') module.exports = api; else root.Advisor = api;
})(this);
