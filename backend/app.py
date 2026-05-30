from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import roc_curve
import os
from datetime import datetime
app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# Load model at startup.
# threshold.pkl is saved by train.py alongside model.pkl.
# If it is missing (old model), fall back to 0.5.
# ─────────────────────────────────────────────
model = joblib.load("model.pkl")

try:
    threshold = float(joblib.load("threshold.pkl"))
    print(f"[startup] threshold loaded from threshold.pkl → {threshold:.4f}")
except FileNotFoundError:
    threshold = 0.5
    print("[startup] threshold.pkl not found — using default 0.5")


def build_features(data: dict) -> pd.DataFrame:

    df = pd.DataFrame([data])

    for col in ["tenure", "MonthlyCharges", "TotalCharges"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["AvgMonthlySpend"] = (
        df["TotalCharges"] /
        (df["tenure"] + 1)
    )

    df["LongTermCustomer"] = (
        df["tenure"] > 24
    ).astype(int)

    df["Dependents"] = (
        df["Dependents"]
        .map({"Yes": 1, "No": 0})
        .fillna(0)
        .astype(int)
    )

    return df
def save_prediction(payload, prob, pred, risk):

    row = {
        "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tenure": payload["tenure"],
        "Contract": payload["Contract"],
        "MonthlyCharges": payload["MonthlyCharges"],
        "TotalCharges": payload["TotalCharges"],
        "TechSupport": payload["TechSupport"],
        "OnlineSecurity": payload["OnlineSecurity"],
        "InternetService": payload["InternetService"],
        "PaymentMethod": payload["PaymentMethod"],
        "Dependents": payload["Dependents"],
        "ChurnProbability": round(prob, 4),
        "Prediction": "Churn" if pred else "No Churn",
        "RiskLevel": risk
    }

    file_path = "predictions_log.csv"

    df = pd.DataFrame([row])

    if os.path.exists(file_path):
        df.to_csv(file_path, mode="a", header=False, index=False)
    else:
        df.to_csv(file_path, index=False)
    print("Prediction saved successfully")

@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(force=True)

    required = [
        "tenure", "Contract", "MonthlyCharges", "TotalCharges",
        "TechSupport", "OnlineSecurity", "InternetService",
        "PaymentMethod", "Dependents",
    ]
    missing = [f for f in required if f not in payload]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        df   = build_features(payload)
        prob = float(model.predict_proba(df)[0][1])
        pred = int(prob >= threshold)

        risk = (
            "High Risk"   if prob >= 0.7 else
            "Medium Risk" if prob >= 0.4 else
            "Low Risk"
        )
        save_prediction(payload, prob, pred, risk)
        return jsonify({
            "churn_probability": round(prob, 4),
            "churn_prediction":  "Churn" if pred else "No Churn",
            "risk_level":        risk,
            "threshold_used":    round(threshold, 4),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "threshold": round(threshold, 4)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)