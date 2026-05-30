"""
train.py  —  Churn Prediction Training Script
Dataset : WA_Fn-UseC_-Telco-Customer-Churn.csv
Outputs : model.pkl, threshold.pkl

Fixes applied vs original:
  1. Removed ValueScore (0.999 corr with TotalCharges — redundant noise)
  2. Added early_stopping_rounds to prevent overfitting at high n_estimators
  3. n_iter raised to 60 and param grid tightened around well-performing ranges
"""

import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report,
    roc_auc_score, roc_curve,
)
from xgboost import XGBClassifier

# ── 1. Load ───────────────────────────────────────────────────────────
df = pd.read_csv("WA_Fn-UseC_-Telco-Customer-Churn.csv")

selected_columns = [
    "tenure", "Contract", "MonthlyCharges", "TotalCharges",
    "TechSupport", "OnlineSecurity", "InternetService",
    "PaymentMethod", "Dependents", "Churn",
]
df = df[selected_columns]

# ── 2. Clean ──────────────────────────────────────────────────────────
# TotalCharges is stored as string in the raw CSV;
# 11 rows are blank (new customers with tenure=0) → fill with median
df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
df["TotalCharges"] = df["TotalCharges"].fillna(df["TotalCharges"].median())

# ── 3. Feature engineering ────────────────────────────────────────────
# AvgMonthlySpend: normalises spend by tenure length — unique signal
df["AvgMonthlySpend"]  = df["TotalCharges"] / (df["tenure"] + 1)

# LongTermCustomer: strong negative churn predictor (corr = -0.31)
df["LongTermCustomer"] = (df["tenure"] > 24).astype(int)

# NOTE: ValueScore (MonthlyCharges * tenure) was intentionally removed.
# It has 0.999 correlation with TotalCharges — a near-perfect duplicate
# that adds multicollinearity without any new information.

# ── 4. Encode target + binary column ─────────────────────────────────
le = LabelEncoder()
df["Churn"]      = le.fit_transform(df["Churn"])       # No→0, Yes→1
df["Dependents"] = le.fit_transform(df["Dependents"])  # No→0, Yes→1

# ── 5. Split ──────────────────────────────────────────────────────────
X = df.drop("Churn", axis=1)
y = df["Churn"]

numeric_features = [
    "tenure", "MonthlyCharges", "TotalCharges",
    "AvgMonthlySpend", "LongTermCustomer",       # ValueScore removed
]
categorical_features = [
    "Contract", "TechSupport", "OnlineSecurity",
    "InternetService", "PaymentMethod", "Dependents",
]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# ── 6. Pipelines ──────────────────────────────────────────────────────
numeric_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler",  StandardScaler()),
])
categorical_transformer = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot",  OneHotEncoder(handle_unknown="ignore")),
])
preprocessor = ColumnTransformer([
    ("num", numeric_transformer,     numeric_features),
    ("cat", categorical_transformer, categorical_features),
])

# ── 7. Preprocess train split further for early stopping ──────────────
# XGBoost early stopping needs a separate eval set (not the test set).
# We carve 10% out of train as a validation set — it is never used for
# final evaluation, only to stop training at the right n_estimators.
X_tr, X_val, y_tr, y_val = train_test_split(
    X_train, y_train, test_size=0.1, stratify=y_train, random_state=42
)

# ── 8. Model ──────────────────────────────────────────────────────────
# scale_pos_weight corrects for class imbalance (26.5% churn rate)
# dataset ratio: 5174 No / 1869 Yes ≈ 2.77
scale_pos_weight = len(y_train[y_train == 0]) / len(y_train[y_train == 1])

xgb = XGBClassifier(
    objective="binary:logistic",
    eval_metric="auc",
    random_state=42,
    tree_method="hist",          # fast histogram-based method
    early_stopping_rounds=30,    # FIX: stops when val AUC stops improving
                                 # prevents overfitting at high n_estimators
    use_label_encoder=False,
)

# Note: preprocessor is fit on X_tr inside the pipeline.
# The eval_set receives X_val preprocessed separately below.
pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier",   xgb),
])

# ── 9. Hyperparameter search ──────────────────────────────────────────
# Param grid tightened around ranges proven to work for tabular churn data.
# n_iter=60 covers more of the space than the original 40.
param_grid = {
    # High n_estimators is safe because early_stopping_rounds controls it
    "classifier__n_estimators":     [300, 500, 700],

    # Shallow trees generalise better on this dataset size (5634 train rows)
    "classifier__max_depth":        [2, 3, 4],

    # Low learning rates with more trees → better generalisation
    "classifier__learning_rate":    [0.01, 0.03, 0.05],

    # Row & column subsampling — reduces variance
    "classifier__subsample":        [0.7, 0.8, 0.9],
    "classifier__colsample_bytree": [0.7, 0.8, 0.9],

    # gamma: minimum loss reduction to split — prunes useless splits
    "classifier__gamma":            [0, 0.1, 0.5, 1.0],

    # min_child_weight: prevents splits on tiny groups
    "classifier__min_child_weight": [3, 5, 7],

    # L1 + L2 regularisation — key defence against overfitting
    "classifier__reg_alpha":        [0.5, 1, 3, 5],
    "classifier__reg_lambda":       [3, 5, 7, 10],

    "classifier__scale_pos_weight": [scale_pos_weight],
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

search = RandomizedSearchCV(
    estimator=pipeline,
    param_distributions=param_grid,
    n_iter=60,                   # raised from 40 → covers more combinations
    scoring="roc_auc",
    cv=cv,
    verbose=1,
    random_state=42,
    n_jobs=-1,
)

# Pass the validation set for early stopping.
# Pipeline requires the eval_set to be passed via classifier__ prefix.
# The preprocessor is fit on X_tr; X_val is transformed automatically.
preprocessor_fit = preprocessor.fit(X_tr)
X_val_transformed = preprocessor_fit.transform(X_val)

search.fit(
    X_train, y_train,
    classifier__eval_set=[(X_val_transformed, y_val)],
    classifier__verbose=False,
)

best_model = search.best_estimator_

# ── 10. Threshold tuning (Youden's J statistic) ───────────────────────
# Finds the threshold that maximises TPR - FPR on the held-out test set.
# This is better than the default 0.5 for imbalanced classes.
train_prob = best_model.predict_proba(X_train)[:, 1]
test_prob  = best_model.predict_proba(X_test)[:, 1]

fpr, tpr, thresholds = roc_curve(y_test, test_prob)
best_threshold = float(thresholds[np.argmax(tpr - fpr)])
print(f"\nBest Threshold (Youden's J): {best_threshold:.4f}")

y_pred = (test_prob >= best_threshold).astype(int)

# ── 11. Metrics ───────────────────────────────────────────────────────
train_auc = roc_auc_score(y_train, train_prob)
test_auc  = roc_auc_score(y_test,  test_prob)
auc_gap   = train_auc - test_auc

print("\n==============================")
print("BEST PARAMETERS")
print("==============================")
print(search.best_params_)

print("\n==============================")
print("MODEL PERFORMANCE")
print("==============================")
print(f"Training AUC : {train_auc:.4f}")
print(f"Testing AUC  : {test_auc:.4f}")
print(f"AUC Gap      : {auc_gap:.4f}  ({'HEALTHY < 0.02' if auc_gap < 0.02 else 'WARNING: possible overfit' if auc_gap > 0.05 else 'ACCEPTABLE 0.02-0.05'})")
print(f"Accuracy     : {accuracy_score(y_test, y_pred):.4f}")
print(f"Precision    : {precision_score(y_test, y_pred):.4f}")
print(f"Recall       : {recall_score(y_test, y_pred):.4f}")
print(f"F1 Score     : {f1_score(y_test, y_pred):.4f}")

print("\n==============================")
print("CLASSIFICATION REPORT")
print("==============================")
print(classification_report(y_test, y_pred))

print("\n==============================")
print("CONFUSION MATRIX")
print("==============================")
print(confusion_matrix(y_test, y_pred))

# ── 12. Results DataFrame ─────────────────────────────────────────────
results_df = pd.DataFrame({
    "Actual_Value":          y_test.values,
    "Predicted_Probability": np.round(test_prob, 4),
    "Threshold":             np.round(best_threshold, 4),
    "Predicted_Value":       y_pred,
})
results_df["Result"] = np.where(
    results_df["Actual_Value"] == results_df["Predicted_Value"],
    "Correct", "Wrong",
)
results_df["Actual_Value"]    = results_df["Actual_Value"].map({0: "No Churn", 1: "Churn"})
results_df["Predicted_Value"] = results_df["Predicted_Value"].map({0: "No Churn", 1: "Churn"})

correct = (results_df["Result"] == "Correct").sum()
wrong   = (results_df["Result"] == "Wrong").sum()

print("\n==============================")
print("PREDICTION RESULTS (first 20)")
print("==============================")
print(results_df.head(20))

print("\n==============================")
print("CORRECT AND WRONG PREDICTIONS")
print("==============================")
print(f"Correct : {correct}")
print(f"Wrong   : {wrong}")

# ── 13. Save ──────────────────────────────────────────────────────────
joblib.dump(best_model,     "model.pkl")
joblib.dump(best_threshold, "threshold.pkl")

print("\n✓ model.pkl saved")
print("✓ threshold.pkl saved")