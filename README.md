# AI Smart Expense Advisor (installable web app / PWA)

All expense data stays on your phone. No server, no paid service. The AI runs inside the app, offline.
This is a PWA (installs from Chrome), NOT a native APK.

## Files
index.html, styles.css, app.js (screens + data), model.js (runs the AI), advisor.js (budget tips, plain rules, not AI),
sw.js (offline cache), manifest.json + icon.svg (installable), expense_model.json (your trained model), tests/ (optional checks).

## The AI model
expense_model.json is your TF-IDF + logistic regression export. model.js repeats scikit-learn's steps: lowercase, strip accents,
split into words of 2+ letters/digits, 1-2 word phrases, TF-IDF weights, L2 normalising, logistic-regression scores, softmax.
Old Naive Bayes exports (from the earlier notebook) are still readable.
Nothing you type is sent anywhere.

## Deploy / update on GitHub Pages (from your phone)
1. Extract the ZIP (Files app > tap ZIP > Extract).
2. GitHub > your `expense-advisor` repository > Add file > Upload files. Upload ALL files from the folder (they replace the old ones; the tests folder is optional). Commit changes.
3. Wait ~2 minutes. Open https://unkn0wn22.github.io/expense-advisor/ in Chrome.
4. Close the app fully and reopen it TWICE so the phone switches to the new cached version (cache name is now v3; raise it in sw.js on each future update).
5. Check More > AI model shows "TF-IDF + logistic regression".
First install needs internet; after that everything works offline. Updates need internet once.

## Tests (optional, need a computer or Colab; not needed to use the app)
- `pip install scikit-learn numpy`, then `python3 tests/make_reference.py` builds scikit-learn's answers from expense_model.json.
- `node tests/run_js_test.js` compares the JavaScript with them (also prints your 10 example sentences).
- `node tests/smoke_ui.js` runs the app logic in a fake browser (add/edit/delete, budgets, income, CSV).
To check against your ORIGINAL .joblib, add its predictions for the sentences to tests/expected.json in the same format.

## Known limits
- A 97.6% test score only means something for data like the test set. If it came from generated sentences, real-life accuracy will be lower. Always check the suggested category.
- One category per entry: "groceries and a taxi" should be saved as two entries (the app warns when it notices).
- Currencies are never converted; totals are per currency. Data lives in Chrome storage: export CSV regularly (clearing site data deletes it).
