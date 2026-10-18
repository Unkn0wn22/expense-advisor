# AI Smart Expense Advisor (installable web app)

All data stays on your phone. No server, no paid service. The AI runs inside the app.

## IMPORTANT: your model file is NOT included
Your trained model is already included. If you retrain, replace it: put YOUR `expense_model.json` in the same folder as `index.html`. The app checks it on startup and the top-right badge shows "AI ready" or "AI unavailable" (with the reason in More > AI model).
Accuracy is 62.5% on your test data, so always check the suggested category. Tap a suggested alternative or change the dropdown to correct it.

## Does your model match? (Colab export cell)
The app expects these fields: vocabulary, classes, feature_log_prob, class_log_prior. Optional: idf, ngram_range, sublinear_tf, norm, lowercase.
If your model used TF-IDF, `idf` is needed or predictions will be off. If unsure, re-export in Colab. Set `vec` to your fitted TfidfVectorizer/CountVectorizer and `clf` to your fitted MultinomialNB:

```python
import json
data = {
  "vocabulary": {k: int(v) for k, v in vec.vocabulary_.items()},
  "classes": [str(c) for c in clf.classes_],
  "feature_log_prob": clf.feature_log_prob_.tolist(),
  "class_log_prior": clf.class_log_prior_.tolist(),
  "ngram_range": list(vec.ngram_range),
  "lowercase": bool(vec.lowercase),
}
if hasattr(vec, "idf_"):
    data.update(idf=vec.idf_.tolist(), sublinear_tf=bool(vec.sublinear_tf), norm=vec.norm or "none")
json.dump(data, open("expense_model.json", "w"))
from google.colab import files; files.download("expense_model.json")
```
Only works for Naive Bayes models. For another model type, tell me what it is.

## Deploy (all from your phone, free)
1. Unzip this folder (Files app > tap the ZIP > Extract).
2. In Chrome open github.com, create a free account, tap + > New repository. Name it `expense-advisor`.
   Choose **Public** (GitHub Pages is free for public repos only). This is OK: your expenses are NOT in the repo, they live in your phone. Only the app files and your trained model are public. Do not put real CSV backups in it.
3. Tap "uploading an existing file" and upload every file from the folder, plus your `expense_model.json`. Tap Commit changes.
   (If the phone won't pick many files, use Chrome's "Desktop site" option.)
4. Repository > Settings > Pages > Source: "Deploy from a branch", Branch: main, folder / (root), Save.
5. Wait about 2 minutes. Your address will be `https://YOURNAME.github.io/expense-advisor/`.
6. Open that address in Chrome on your phone. Wait for it to fully load.
7. Chrome menu (three dots) > "Add to Home screen" > "Install". Open it from the home screen.
8. Test offline: open the app once online, add a test expense, turn on airplane mode, close the app fully and reopen. Tap "Suggest category". It should still work.

## PWA vs APK
This is a PWA: it installs from Chrome, runs full-screen, works offline, but is not an APK file. A real APK needs extra tools (for example PWABuilder or Bubblewrap with Android signing) and is much harder on a phone alone. Start with the PWA.

## Notes
- Data lives in Chrome's storage on this phone. Clearing Chrome/site data deletes it, so use More > Export CSV regularly.
- Totals are kept per currency; there is no exchange-rate conversion.
- Budgets are monthly, per category (or "all") and per currency; amber at 80%, red at 100%.
- After updating files on GitHub, change `CACHE = 'expense-advisor-v1'` in sw.js to v2 so phones fetch the new version.
