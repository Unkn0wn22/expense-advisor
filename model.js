// On-device text classifier. Supports two exported formats:
//  1) "tfidf_logistic_regression": TF-IDF + logistic regression (scikit-learn Pipeline export)
//  2) Naive Bayes: vocabulary, classes, feature_log_prob, class_log_prior (optional idf etc.)
(function (root) {
  const isLR = m => m && m.type === 'tfidf_logistic_regression';
  function validate(m) {
    const errs = [];
    if (!m || typeof m !== 'object') return ['File is not a JSON object.'];
    const need = isLR(m) ? ['vocabulary', 'idf', 'classes', 'coefficients', 'intercepts'] : ['vocabulary', 'classes', 'feature_log_prob', 'class_log_prior'];
    for (const k of need) if (!(k in m)) errs.push('Missing field: ' + k);
    if (errs.length) return errs;
    const vsize = Array.isArray(m.vocabulary) ? m.vocabulary.length : Object.keys(m.vocabulary).length;
    const W = isLR(m) ? m.coefficients : m.feature_log_prob, B = isLR(m) ? m.intercepts : m.class_log_prior;
    if (W.length !== m.classes.length) errs.push('weight rows != number of classes');
    else if (W.some(r => r.length !== vsize)) errs.push('weight columns != vocabulary size (' + vsize + ')');
    if (B.length !== m.classes.length) errs.push('intercept/prior length != number of classes');
    if (m.idf && m.idf.length !== vsize) errs.push('idf length != vocabulary size');
    if (m.strip_accents && !['unicode', 'ascii'].includes(m.strip_accents)) errs.push('unsupported strip_accents: ' + m.strip_accents);
    if (m.analyzer && m.analyzer !== 'word') errs.push('unsupported analyzer: ' + m.analyzer);
    return errs;
  }
  function prepare(m) {
    const vocab = new Map();
    if (Array.isArray(m.vocabulary)) m.vocabulary.forEach((w, i) => vocab.set(w, i));
    else for (const w in m.vocabulary) vocab.set(w, m.vocabulary[w]);
    let ng = m.ngram_range;
    if (!ng) { // not stored: infer from vocabulary (entries like "bought rice" mean 1-2 word phrases)
      let mx = 1, mn = 2;
      for (const w of vocab.keys()) { const n = w.split(' ').length; if (n > mx) mx = n; if (n < mn) mn = n; }
      ng = [mn, mx];
    }
    return { m, vocab, ngMin: ng[0], ngMax: ng[1], idf: m.idf || null, lr: isLR(m) };
  }
  // Mirrors scikit-learn: lowercase, then strip accents, then tokens = runs of 2+ letters/digits/underscore.
  function tokens(text, p) {
    if (p.m.lowercase !== false) text = text.toLowerCase();
    if (p.m.strip_accents === 'unicode') text = text.normalize('NFKD').replace(/\p{M}/gu, '');
    else if (p.m.strip_accents === 'ascii') text = text.normalize('NFKD').replace(/[^\x00-\x7f]/g, '');
    const w = text.match(/[\p{L}\p{N}_]{2,}/gu) || [];
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
      if (p.m.norm !== 'none' && p.m.norm != null) {
        const n = Math.sqrt(vec.reduce((s, [, v]) => s + v * v, 0)) || 1;
        vec = vec.map(([i, v]) => [i, v / n]);
      }
    }
    const W = p.lr ? p.m.coefficients : p.m.feature_log_prob, B = p.lr ? p.m.intercepts : p.m.class_log_prior;
    const scores = p.m.classes.map((c, k) => { let s = B[k]; for (const [i, v] of vec) s += v * W[k][i]; return s; });
    const mx = Math.max(...scores), ex = scores.map(s => Math.exp(s - mx)), sum = ex.reduce((a, b) => a + b, 0);
    return p.m.classes.map((c, k) => ({ category: c, prob: ex[k] / sum, known: counts.size })).sort((a, b) => b.prob - a.prob);
  }
  const api = { validate, prepare, predict, tokens };
  if (typeof module !== 'undefined') module.exports = api; else root.ExpenseModel = api;
})(this);
