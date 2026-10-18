// Naive-Bayes style text classifier running fully on-device.
(function (root) {
  function validate(m) {
    const errs = [];
    if (!m || typeof m !== 'object') return ['File is not a JSON object.'];
    for (const k of ['vocabulary', 'classes', 'feature_log_prob', 'class_log_prior'])
      if (!(k in m)) errs.push('Missing field: ' + k);
    if (errs.length) return errs;
    const vsize = Array.isArray(m.vocabulary) ? m.vocabulary.length : Object.keys(m.vocabulary).length;
    if (m.feature_log_prob.length !== m.classes.length) errs.push('feature_log_prob rows != number of classes');
    else if (m.feature_log_prob.some(r => r.length !== vsize)) errs.push('feature_log_prob columns != vocabulary size (' + vsize + ')');
    if (m.class_log_prior.length !== m.classes.length) errs.push('class_log_prior length != number of classes');
    return errs;
  }
  function prepare(m) {
    const vocab = new Map();
    if (Array.isArray(m.vocabulary)) m.vocabulary.forEach((w, i) => vocab.set(w, i));
    else for (const w in m.vocabulary) vocab.set(w, m.vocabulary[w]);
    let ng = m.ngram_range;
    if (!ng) { // not stored in file: infer from the vocabulary (e.g. entries like "bought rice" mean 1-2 word phrases)
      let mx = 1, mn = 2;
      for (const w of vocab.keys()) { const n = w.split(' ').length; if (n > mx) mx = n; if (n < mn) mn = n; }
      ng = [mn, mx];
    }
    return { m, vocab, ngMin: ng[0], ngMax: ng[1], idf: m.idf || null };
  }
  function tokens(text, p) {
    if (p.m.lowercase !== false) text = text.toLowerCase();
    const w = text.match(/\b\w\w+\b/g) || [];
    const out = [];
    for (let n = p.ngMin; n <= p.ngMax; n++)
      for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' '));
    return out;
  }
  function predict(p, text) {
    const counts = new Map();
    for (const t of tokens(text, p)) {
      const i = p.vocab.get(t);
      if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
    }
    let vec = [...counts.entries()];
    if (p.idf) {
      vec = vec.map(([i, c]) => [i, (p.m.sublinear_tf ? 1 + Math.log(c) : c) * p.idf[i]]);
      if (p.m.norm !== 'none') {
        const n = Math.sqrt(vec.reduce((s, [, v]) => s + v * v, 0)) || 1;
        vec = vec.map(([i, v]) => [i, v / n]);
      }
    }
    const scores = p.m.classes.map((c, k) => {
      let s = p.m.class_log_prior[k];
      for (const [i, v] of vec) s += v * p.m.feature_log_prob[k][i];
      return s;
    });
    const mx = Math.max(...scores);
    const ex = scores.map(s => Math.exp(s - mx));
    const sum = ex.reduce((a, b) => a + b, 0);
    return p.m.classes.map((c, k) => ({ category: c, prob: ex[k] / sum, known: counts.size }))
      .sort((a, b) => b.prob - a.prob);
  }
  const api = { validate, prepare, predict };
  if (typeof module !== 'undefined') module.exports = api; else root.ExpenseModel = api;
})(this);
