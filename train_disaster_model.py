#!/usr/bin/env python3
"""
==============================================================================
 KERALA EMERGENCY DISPATCH — AI DISASTER PREDICTION MODEL TRAINING PIPELINE
==============================================================================
This script:
1. Ingests 6 years of hourly ERA5 climate and geotechnical soil moisture records
   from the ECMWF/Copernicus archive for high-risk Kerala coordinates (Wayanad/Idukki).
2. Computes domain physics features:
   - Rolling precipitation accumulation windows (1h, 3h, 6h, 24h, 72h, 7-day).
   - Multi-layer geotechnical soil saturation (0-7cm, 7-28cm pore water pressure).
   - Atmospheric barometric pressure tendency (storm front delta).
3. Trains a high-performance Gradient Boosted Tree (XGBoost) using strict
   chronological train/test splitting (no data leakage).
4. Evaluates performance with ROC-AUC, F1-Score, and feature importance.
5. Exports the trained model to ONNX format for 100% offline deployment
   directly inside the Vanguard Geo mobile app or web client.
==============================================================================
"""

import os
import sys
import requests
import numpy as np
import pandas as pd
from datetime import datetime

# Configure UTF-8 encoding for Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import onnxmltools
from onnxmltools.convert.common.data_types import FloatTensorType

# Default: Wayanad high-range landslide zone (11.6854 N, 76.1320 E)
LATITUDE = 11.6854
LONGITUDE = 76.1320
START_DATE = "2018-01-01"
END_DATE = "2024-01-01"
DATA_CACHE_FILE = "kerala_era5_training_data.csv"
MODEL_OUTPUT_ONNX = "kerala_disaster_hazard_model.onnx"
MODEL_OUTPUT_JSON = "kerala_disaster_hazard_model.json"


def step1_fetch_era5_data():
    """
    Downloads or loads cached 6-year hourly ERA5 climate & soil physics dataset.
    """
    if os.path.exists(DATA_CACHE_FILE):
        print(f"[1/5] Loading cached ERA5 dataset from '{DATA_CACHE_FILE}'...")
        df = pd.read_csv(DATA_CACHE_FILE, parse_dates=["time"], index_col="time")
        print(f"      Loaded {len(df):,} hourly observations.")
        return df

    print(f"[1/5] Downloading ERA5 climate archive for ({LATITUDE}, {LONGITUDE}) from {START_DATE} to {END_DATE}...")
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "surface_pressure",
            "wind_speed_10m",
            "wind_gusts_10m",
            "soil_moisture_0_to_7cm",
            "soil_moisture_7_to_28cm"
        ],
        "timezone": "Asia/Kolkata"
    }

    resp = requests.get(url, params=params, timeout=60)
    resp.raise_for_status()
    payload = resp.json()["hourly"]

    df = pd.DataFrame(payload)
    df["time"] = pd.to_datetime(df["time"])
    df.set_index("time", inplace=True)
    df.sort_index(inplace=True)

    # Save cache so subsequent runs are instant
    df.to_csv(DATA_CACHE_FILE)
    print(f"      Retrieved {len(df):,} hours. Cached to '{DATA_CACHE_FILE}'.")
    return df


def step2_feature_engineering(df):
    """
    Calculates physical hydrological memory and geotechnical saturation indices.
    """
    print("[2/5] Engineering domain physics and geotechnical features...")
    feat = pd.DataFrame(index=df.index)

    # 1. Atmospheric Telemetry
    feat["temp"] = df["temperature_2m"].astype(np.float32)
    feat["humidity"] = df["relative_humidity_2m"].astype(np.float32)
    feat["pressure"] = df["surface_pressure"].astype(np.float32)
    feat["wind_speed"] = df["wind_speed_10m"].astype(np.float32)
    feat["wind_gusts"] = df["wind_gusts_10m"].astype(np.float32)

    # 2. Geotechnical Soil Moisture Layers (0-7cm, 7-28cm)
    feat["soil_moisture_shallow"] = df["soil_moisture_0_to_7cm"].astype(np.float32)
    feat["soil_moisture_deep"] = df["soil_moisture_7_to_28cm"].astype(np.float32)
    feat["mean_soil_saturation"] = ((df["soil_moisture_0_to_7cm"] + df["soil_moisture_7_to_28cm"]) / 2.0).astype(np.float32)

    # 3. Rolling Precipitation Accumulation Windows
    feat["rain_1h"] = df["precipitation"].astype(np.float32)
    feat["rain_3h"] = df["precipitation"].rolling(3).sum().astype(np.float32)
    feat["rain_6h"] = df["precipitation"].rolling(6).sum().astype(np.float32)
    feat["rain_24h"] = df["precipitation"].rolling(24).sum().astype(np.float32)
    feat["rain_72h"] = df["precipitation"].rolling(72).sum().astype(np.float32)
    feat["rain_7d"] = df["precipitation"].rolling(168).sum().astype(np.float32)

    # 4. Barometric Pressure Tendency (Storm Front Delta in 3h)
    feat["pressure_tendency_3h"] = (df["surface_pressure"] - df["surface_pressure"].shift(3)).astype(np.float32)

    # Clean initial NaN values from rolling accumulation
    valid_mask = ~feat.isna().any(axis=1)
    feat = feat.loc[valid_mask]

    # 5. Target Definition: Severe Disaster Incident in next 24 Hours
    # Criterion: Future 24h rain >= 65mm (IMD Heavy Rain threshold)
    # OR High Soil Saturation (>= 0.40 m3/m3) accompanied by >= 35mm rain (Landslide critical trigger)
    future_24h_rain = df["precipitation"].shift(-24).rolling(24).sum().loc[feat.index]
    target = (
        (future_24h_rain >= 65.0) |
        ((feat["mean_soil_saturation"] >= 0.40) & (future_24h_rain >= 35.0))
    ).astype(int)

    # Filter out trailing NaNs caused by the forward-looking target
    clean_idx = target.dropna().index
    feat = feat.loc[clean_idx]
    target = target.loc[clean_idx]

    print(f"      Engineered {feat.shape[1]} physical features across {len(feat):,} samples.")
    print(f"      Hazard incidents identified: {target.sum():,} ({target.mean()*100:.2f}% of hours)")
    return feat, target


def step3_train_model(X, y):
    """
    Trains an XGBoost classifier with chronological time-series splitting.
    """
    print("[3/5] Splitting data chronologically and training XGBoost...")
    # 80% Chronological Train, 20% Out-of-Sample Test
    split_idx = int(len(X) * 0.80)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"      Train window: {X_train.index.min().date()} to {X_train.index.max().date()} ({len(X_train):,} hrs)")
    print(f"      Test window:  {X_test.index.min().date()} to {X_test.index.max().date()} ({len(X_test):,} hrs)")

    # Weight positive hazard samples to prevent class imbalance skew
    pos_count = max(1, int(y_train.sum()))
    neg_count = len(y_train) - pos_count
    scale_weight = float(neg_count) / pos_count

    model = xgb.XGBClassifier(
        n_estimators=180,
        max_depth=5,
        learning_rate=0.04,
        scale_pos_weight=scale_weight,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        eval_metric="logloss"
    )

    model.fit(X_train, y_train)

    # Evaluate on untouched future test window
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    roc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred)

    print("\n" + "="*65)
    print("           MODEL VALIDATION ON UNSEEN FUTURE WEATHER")
    print("="*65)
    print(classification_report(y_test, y_pred, target_names=["SAFE (Normal)", "HAZARD (Severe Risk)"]))
    print(f"[*] Out-of-Sample ROC-AUC Score: {roc:.4f}")
    print(f"[*] Confusion Matrix:\n   True Negatives: {cm[0,0]:<6} | False Positives: {cm[0,1]}")
    print(f"   False Negatives: {cm[1,0]:<5} | True Positives:  {cm[1,1]}")
    print("="*65 + "\n")

    # Feature Importance Analysis
    importance = pd.Series(model.feature_importances_, index=X.columns).sort_values(ascending=False)
    print("🏆 Top 6 Most Predictive Disaster Factors:")
    for rank, (name, val) in enumerate(importance.head(6).items(), start=1):
        print(f"   {rank}. {name:<22} : {val*100:5.1f}%")

    return model, X_test


def step4_export_models(model, X_test):
    """
    Exports the trained model to standard JSON and ONNX format for mobile/browser execution.
    """
    print("\n[4/5] Exporting model artifacts...")
    
    # 1. Native XGBoost JSON Format (Lightweight, universal)
    model.save_model(MODEL_OUTPUT_JSON)
    size_json_kb = os.path.getsize(MODEL_OUTPUT_JSON) / 1024
    print(f"      Saved XGBoost model: '{MODEL_OUTPUT_JSON}' ({size_json_kb:.1f} KB)")

    # 2. ONNX Format (For zero-dependency mobile runtime in Android / iOS / WebAssembly)
    try:
        booster = model.get_booster()
        original_names = booster.feature_names
        booster.feature_names = [f"f{i}" for i in range(X_test.shape[1])]
        initial_types = [('float_input', FloatTensorType([None, X_test.shape[1]]))]
        onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_types, target_opset=12)
        booster.feature_names = original_names
        with open(MODEL_OUTPUT_ONNX, "wb") as f:
            f.write(onnx_model.SerializeToString())
        size_onnx_kb = os.path.getsize(MODEL_OUTPUT_ONNX) / 1024
        print(f"      Saved ONNX model:    '{MODEL_OUTPUT_ONNX}' ({size_onnx_kb:.1f} KB)")
    except Exception as e:
        print(f"      Note: ONNX export skipped ({e}). Native JSON model ready for use.")


def step5_demonstration_inference(model, X_test):
    """
    Demonstrates instant live inference on a simulated incoming field telemetry packet.
    """
    print("\n[5/5] Testing real-time inference on field telemetry packet...")
    sample = X_test.iloc[-1:].copy()
    prob = model.predict_proba(sample)[0, 1]
    is_hazard = prob >= 0.50

    print(f"      Input readings: Rain 24h = {sample['rain_24h'].values[0]:.1f}mm | "
          f"Soil Saturation = {sample['mean_soil_saturation'].values[0]*100:.1f}% | "
          f"Pressure = {sample['pressure'].values[0]:.1f} hPa")
    print(f"      Calculated Disaster Probability: {prob*100:.1f}%")
    status_tag = "🔴 RED ALERT: Severe Disaster Imminent" if is_hazard else "🟢 GREEN: Conditions Stable"
    print(f"      Early Warning Output: {status_tag}")
    print("\n✅ PIPELINE COMPLETE: Your custom AI disaster model is fully trained and ready!")


if __name__ == "__main__":
    df = step1_fetch_era5_data()
    X, y = step2_feature_engineering(df)
    model, X_test = step3_train_model(X, y)
    step4_export_models(model, X_test)
    step5_demonstration_inference(model, X_test)
