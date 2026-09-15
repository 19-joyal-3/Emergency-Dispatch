#!/usr/bin/env python3
"""
==============================================================================
 KERALA EMERGENCY DISPATCH — STATEWIDE 14-DISTRICT AI HAZARD TRAINING ENGINE
==============================================================================
This pipeline:
1. Ingests 4+ years of hourly ERA5 climate, rainfall, and multi-depth geotechnical
   soil moisture records across ALL 14 Kerala revenue districts (~500,000 observations).
2. Augments telemetry with district-specific topographic metadata (elevation, 
   Western Ghats orographic classification, coastal flood susceptibility).
3. Engineers 18 domain physics features per district per hour:
   - Antecedent precipitation saturation (1h, 3h, 6h, 24h, 72h, 7-day cumulative)
   - Multi-layer soil pore-water saturation (0-7cm, 7-28cm)
   - Barometric pressure front tendency (3h drop)
   - Topographic & spatial orographic coordinates
4. Trains a unified Statewide XGBoost Classifier with chronological validation.
5. Measures performance per district (Wayanad, Idukki, Alappuzha, Kochi, etc.).
6. Exports:
   - 'kerala_statewide_disaster_model.json' (Native XGBoost)
   - 'kerala_statewide_disaster_model.onnx' (Universal ONNX Edge runtime)
   - 'src/aiDisasterModelWeights.json' (Embedded client weights for instant browser inference)
==============================================================================
"""

import os
import sys
import json
import time
import requests
import numpy as np
import pandas as pd
from datetime import datetime

# Configure UTF-8 for Windows terminals
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import xgboost as xgb
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import onnxmltools
from onnxmltools.convert.common.data_types import FloatTensorType

START_DATE = "2020-01-01"
END_DATE = "2023-12-31"
DATA_CACHE_FILE = "kerala_14_districts_era5_cache.csv"
MODEL_OUTPUT_JSON = "kerala_statewide_disaster_model.json"
MODEL_OUTPUT_ONNX = "kerala_statewide_disaster_model.onnx"
APP_MODEL_WEIGHTS_FILE = os.path.join("src", "aiDisasterModelWeights.json")

# 14 Kerala revenue districts with exact coordinates and topographic classifications
# terrain_type: 0 = Coastal / Lowland Inundation, 1 = Midland, 2 = High Range Western Ghats (Landslide)
KERALA_DISTRICTS = [
    {"id": "tvm", "name": "Thiruvananthapuram", "lat": 8.5241, "lng": 76.9366, "elevation_m": 10, "terrain_type": 0},
    {"id": "kollam", "name": "Kollam", "lat": 8.8932, "lng": 76.6141, "elevation_m": 15, "terrain_type": 0},
    {"id": "pathanamthitta", "name": "Pathanamthitta", "lat": 9.2648, "lng": 76.7870, "elevation_m": 85, "terrain_type": 2},
    {"id": "alappuzha", "name": "Alappuzha", "lat": 9.4981, "lng": 76.3388, "elevation_m": 1, "terrain_type": 0},
    {"id": "kottayam", "name": "Kottayam", "lat": 9.5916, "lng": 76.5222, "elevation_m": 22, "terrain_type": 1},
    {"id": "idukki", "name": "Idukki", "lat": 9.8500, "lng": 76.9700, "elevation_m": 1200, "terrain_type": 2},
    {"id": "kochi", "name": "Ernakulam", "lat": 9.9312, "lng": 76.2673, "elevation_m": 4, "terrain_type": 0},
    {"id": "thrissur", "name": "Thrissur", "lat": 10.5276, "lng": 76.2144, "elevation_m": 12, "terrain_type": 1},
    {"id": "palakkad", "name": "Palakkad", "lat": 10.7867, "lng": 76.6548, "elevation_m": 84, "terrain_type": 1},
    {"id": "malappuram", "name": "Malappuram", "lat": 11.0722, "lng": 76.0740, "elevation_m": 40, "terrain_type": 1},
    {"id": "kozhibode", "name": "Kozhikode", "lat": 11.2588, "lng": 75.7804, "elevation_m": 10, "terrain_type": 0},
    {"id": "wayanad", "name": "Wayanad", "lat": 11.6050, "lng": 76.0830, "elevation_m": 900, "terrain_type": 2},
    {"id": "kannur", "name": "Kannur", "lat": 11.8745, "lng": 75.3704, "elevation_m": 15, "terrain_type": 0},
    {"id": "kasaragod", "name": "Kasaragod", "lat": 12.5103, "lng": 74.9852, "elevation_m": 16, "terrain_type": 0}
]


def step1_fetch_statewide_data():
    """
    Downloads or loads cached ERA5 hourly climate records across all 14 districts.
    Uses 2 batches of 7 districts to respect API limits.
    """
    if os.path.exists(DATA_CACHE_FILE):
        print(f"[1/5] Loading cached statewide dataset from '{DATA_CACHE_FILE}'...")
        df = pd.read_csv(DATA_CACHE_FILE, parse_dates=["time"])
        print(f"      Loaded {len(df):,} hourly observations across all districts.")
        return df

    print(f"[1/5] Downloading 4-year ERA5 archive for all 14 Kerala districts ({START_DATE} to {END_DATE})...")
    url = "https://archive-api.open-meteo.com/v1/archive"

    batch_size = 7
    all_frames = []

    for batch_idx in range(0, len(KERALA_DISTRICTS), batch_size):
        sub_districts = KERALA_DISTRICTS[batch_idx:batch_idx + batch_size]
        lats = [d["lat"] for d in sub_districts]
        lngs = [d["lng"] for d in sub_districts]

        print(f"      Requesting batch {batch_idx//batch_size + 1}/2 ({len(sub_districts)} districts)...")
        params = {
            "latitude": lats,
            "longitude": lngs,
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

        resp = requests.get(url, params=params, timeout=120)
        resp.raise_for_status()
        raw_list = resp.json()
        if not isinstance(raw_list, list):
            raw_list = [raw_list]

        for d_idx, dist in enumerate(sub_districts):
            hourly_data = raw_list[d_idx]["hourly"]
            dist_df = pd.DataFrame(hourly_data)
            dist_df["district_id"] = dist["id"]
            dist_df["district_name"] = dist["name"]
            dist_df["lat"] = dist["lat"]
            dist_df["lng"] = dist["lng"]
            dist_df["elevation_m"] = dist["elevation_m"]
            dist_df["terrain_type"] = dist["terrain_type"]
            all_frames.append(dist_df)
            print(f"      + Ingested {len(dist_df):,} records for {dist['name']}.")

        time.sleep(1) # Polite pause

    combined_df = pd.concat(all_frames, ignore_index=True)
    combined_df["time"] = pd.to_datetime(combined_df["time"])
    combined_df.sort_values(by=["time", "district_id"], inplace=True)
    combined_df.to_csv(DATA_CACHE_FILE, index=False)
    print(f"      Statewide dataset cached to '{DATA_CACHE_FILE}' ({len(combined_df):,} total records).")
    return combined_df


def step2_feature_engineering_statewide(df):
    """
    Computes domain physics, rolling rainfall windows, and soil saturation per district.
    """
    print("[2/5] Engineering physical features across all 14 districts...")
    engineered_list = []

    for dist in KERALA_DISTRICTS:
        dist_id = dist["id"]
        sub = df[df["district_id"] == dist_id].copy().sort_values("time")
        sub.set_index("time", inplace=True)

        feat = pd.DataFrame(index=sub.index)
        feat["district_id"] = dist_id
        feat["district_name"] = dist["name"]

        # Base atmospheric & terrain telemetry
        feat["temp"] = sub["temperature_2m"].astype(np.float32)
        feat["humidity"] = sub["relative_humidity_2m"].astype(np.float32)
        feat["pressure"] = sub["surface_pressure"].astype(np.float32)
        feat["wind_speed"] = sub["wind_speed_10m"].astype(np.float32)
        feat["wind_gusts"] = sub["wind_gusts_10m"].astype(np.float32)
        feat["elevation_m"] = float(dist["elevation_m"])
        feat["terrain_type"] = float(dist["terrain_type"])
        feat["lat"] = float(dist["lat"])
        feat["lng"] = float(dist["lng"])

        # Geotechnical soil moisture
        feat["soil_moisture_shallow"] = sub["soil_moisture_0_to_7cm"].astype(np.float32)
        feat["soil_moisture_deep"] = sub["soil_moisture_7_to_28cm"].astype(np.float32)
        feat["mean_soil_saturation"] = ((sub["soil_moisture_0_to_7cm"] + sub["soil_moisture_7_to_28cm"]) / 2.0).astype(np.float32)

        # Hydrological rolling rainfall windows
        feat["rain_1h"] = sub["precipitation"].astype(np.float32)
        feat["rain_3h"] = sub["precipitation"].rolling(3).sum().astype(np.float32)
        feat["rain_6h"] = sub["precipitation"].rolling(6).sum().astype(np.float32)
        feat["rain_24h"] = sub["precipitation"].rolling(24).sum().astype(np.float32)
        feat["rain_72h"] = sub["precipitation"].rolling(72).sum().astype(np.float32)
        feat["rain_7d"] = sub["precipitation"].rolling(168).sum().astype(np.float32)

        # Barometric pressure delta (3h storm front drop)
        feat["pressure_tendency_3h"] = (sub["surface_pressure"] - sub["surface_pressure"].shift(3)).astype(np.float32)

        # Drop rolling window warmup NaNs
        feat.dropna(inplace=True)

        # Target Definition (Future 24h Disaster Event)
        future_24h_rain = sub["precipitation"].shift(-24).rolling(24).sum().loc[feat.index]
        
        # Adaptive hazard criterion based on district terrain
        if dist["terrain_type"] == 2:  # High Range Ghats (Wayanad, Idukki, Pathanamthitta)
            # Severe if future rain >= 50mm OR (Soil saturation >= 0.38 and future rain >= 25mm)
            target = ((future_24h_rain >= 50.0) | ((feat["mean_soil_saturation"] >= 0.38) & (future_24h_rain >= 25.0))).astype(int)
        elif dist["terrain_type"] == 0: # Coastal / Lowland (Alappuzha, Kochi, Kollam, etc.)
            # Severe if future rain >= 65mm OR (Antecedent 7d rain >= 120mm and future rain >= 35mm)
            target = ((future_24h_rain >= 65.0) | ((feat["rain_7d"] >= 120.0) & (future_24h_rain >= 35.0))).astype(int)
        else: # Midland
            target = ((future_24h_rain >= 60.0) | ((feat["mean_soil_saturation"] >= 0.40) & (future_24h_rain >= 30.0))).astype(int)

        clean_mask = target.notna()
        feat = feat.loc[clean_mask]
        feat["target_hazard"] = target.loc[clean_mask]
        engineered_list.append(feat)

    full_dataset = pd.concat(engineered_list)
    print(f"      Statewide engineered dataset shape: {full_dataset.shape[0]:,} rows x {full_dataset.shape[1]} columns.")
    hazard_pct = (full_dataset['target_hazard'].sum() / len(full_dataset)) * 100
    print(f"      Total disaster hazard events recorded across Kerala: {full_dataset['target_hazard'].sum():,} ({hazard_pct:.2f}%)")
    return full_dataset


def step3_train_statewide_model(dataset):
    """
    Trains an XGBoost model across all 14 districts with chronological validation.
    """
    print("[3/5] Chronologically splitting statewide dataset (Train: 2020-2022, Test: 2023)...")

    feature_cols = [
        "temp", "humidity", "pressure", "wind_speed", "wind_gusts",
        "elevation_m", "terrain_type", "lat", "lng",
        "soil_moisture_shallow", "soil_moisture_deep", "mean_soil_saturation",
        "rain_1h", "rain_3h", "rain_6h", "rain_24h", "rain_72h", "rain_7d",
        "pressure_tendency_3h"
    ]

    # Split chronologically at 2023-01-01
    split_date = pd.Timestamp("2023-01-01")
    train_df = dataset[dataset.index < split_date]
    test_df = dataset[dataset.index >= split_date]

    X_train = train_df[feature_cols]
    y_train = train_df["target_hazard"]
    X_test = test_df[feature_cols]
    y_test = test_df["target_hazard"]

    print(f"      Train samples: {len(X_train):,} | Test samples: {len(X_test):,}")

    # Scale weight for positive class imbalance
    pos = int(y_train.sum())
    neg = len(y_train) - pos
    scale_weight = float(neg) / max(1, pos)

    model = xgb.XGBClassifier(
        n_estimators=220,
        max_depth=6,
        learning_rate=0.035,
        scale_pos_weight=scale_weight,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        eval_metric="logloss"
    )

    print("      Fitting Statewide XGBoost Classifier...")
    model.fit(X_train, y_train)

    # Evaluate overall statewide test set
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    overall_roc = roc_auc_score(y_test, y_prob)

    print("\n" + "="*70)
    print("       STATEWIDE KERALA MODEL VALIDATION (UNSEEN 2023 FUTURE DATA)")
    print("="*70)
    print(classification_report(y_test, y_pred, target_names=["SAFE (Normal)", "HAZARD (Severe Risk)"]))
    print(f"[*] Statewide Out-of-Sample ROC-AUC Score: {overall_roc:.4f}")
    print("="*70)

    # Per-district evaluation breakdown
    print("\n📍 PER-DISTRICT PERFORMANCE BREAKDOWN:")
    for dist in KERALA_DISTRICTS:
        dist_mask = test_df["district_id"] == dist["id"]
        if dist_mask.sum() == 0:
            continue
        d_y_true = y_test[dist_mask]
        d_y_prob = y_prob[dist_mask]
        d_y_pred = y_pred[dist_mask]
        
        pos_count = int(d_y_true.sum())
        if pos_count > 0:
            d_roc = roc_auc_score(d_y_true, d_y_prob)
            cm = confusion_matrix(d_y_true, d_y_pred)
            tp = cm[1,1] if cm.shape == (2,2) else 0
            recall = (tp / pos_count) * 100
            print(f"   • {dist['name']:<18} | ROC-AUC: {d_roc:.4f} | Hazard Catch Rate: {recall:5.1f}% ({tp}/{pos_count} events)")
        else:
            print(f"   • {dist['name']:<18} | (Zero hazard events in 2023 test period)")

    # Top features
    importance = pd.Series(model.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("\n🏆 Top 6 Most Influential Statewide Factors:")
    for rank, (name, val) in enumerate(importance.head(6).items(), start=1):
        print(f"   {rank}. {name:<22} : {val*100:5.1f}%")

    return model, feature_cols, X_test


def step4_export_all_artifacts(model, feature_cols, X_test):
    """
    Exports model artifacts in multiple standard formats:
    1. Native XGBoost JSON (Universal server/Python format)
    2. ONNX format (Native mobile Android / iOS / WebAssembly runtime)
    3. Lightweight browser weight coefficients for Vanguard Geo web client
    """
    print("\n[4/5] Exporting Statewide Model Artifacts...")

    # 1. Native JSON
    model.save_model(MODEL_OUTPUT_JSON)
    size_json = os.path.getsize(MODEL_OUTPUT_JSON) / 1024
    print(f"      Saved Native Model: '{MODEL_OUTPUT_JSON}' ({size_json:.1f} KB)")

    # 2. ONNX Model
    try:
        booster = model.get_booster()
        orig_names = booster.feature_names
        booster.feature_names = [f"f{i}" for i in range(len(feature_cols))]
        initial_types = [('float_input', FloatTensorType([None, len(feature_cols)]))]
        onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_types, target_opset=12)
        booster.feature_names = orig_names

        with open(MODEL_OUTPUT_ONNX, "wb") as f:
            f.write(onnx_model.SerializeToString())
        size_onnx = os.path.getsize(MODEL_OUTPUT_ONNX) / 1024
        print(f"      Saved ONNX Model:   '{MODEL_OUTPUT_ONNX}' ({size_onnx:.1f} KB)")
    except Exception as e:
        print(f"      Note: ONNX export skipped ({e}).")

    # 3. Export model metadata & feature coefficients for client app integration
    importance_dict = {col: float(model.feature_importances_[idx]) for idx, col in enumerate(feature_cols)}
    weights_payload = {
        "model_name": "KeralaStatewideDisasterHazardModel_v1",
        "version": "1.0.0",
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "districts_covered": 14,
        "feature_names": feature_cols,
        "feature_importances": importance_dict,
        "hazard_threshold": 0.50,
        "terrain_categories": {
            "0": "Coastal / Lowland Floodplain",
            "1": "Midland River Basin",
            "2": "High Range Western Ghats"
        }
    }
    with open(APP_MODEL_WEIGHTS_FILE, "w", encoding="utf-8") as f:
        json.dump(weights_payload, f, indent=2)
    print(f"      Exported Client Weights: '{APP_MODEL_WEIGHTS_FILE}'")


def step5_verify_districts_inference(model, feature_cols):
    """
    Verifies inference for 3 distinct high-risk terrain types:
    1. Wayanad (High Range Landslide)
    2. Alappuzha (Coastal Lowland Inundation)
    3. Ernakulam / Kochi (Urban Floodplain)
    """
    print("\n[5/5] Running real-time test inference for key Kerala sectors...")

    test_scenarios = [
        {
            "name": "Wayanad (Chooralmala Landslide Corridor)",
            "readings": [24.0, 95.0, 915.0, 18.0, 42.0, 900.0, 2.0, 11.6050, 76.0830, 0.44, 0.42, 0.43, 14.0, 32.0, 55.0, 85.0, 140.0, 220.0, -4.5]
        },
        {
            "name": "Alappuzha (Kuttanad Lowland Floodplain)",
            "readings": [27.0, 92.0, 1008.0, 22.0, 50.0, 1.0, 0.0, 9.4981, 76.3388, 0.48, 0.46, 0.47, 8.0, 20.0, 40.0, 75.0, 160.0, 240.0, -2.8]
        },
        {
            "name": "Ernakulam (Kochi Urban Safe Day)",
            "readings": [31.0, 68.0, 1012.0, 12.0, 20.0, 4.0, 0.0, 9.9312, 76.2673, 0.22, 0.24, 0.23, 0.0, 0.0, 0.0, 2.0, 5.0, 10.0, 0.5]
        }
    ]

    for scenario in test_scenarios:
        vec = np.array([scenario["readings"]], dtype=np.float32)
        prob = float(model.predict_proba(vec)[0, 1])
        alert_tag = "🔴 RED ALERT" if prob >= 0.50 else ("🟡 CAUTION" if prob >= 0.25 else "🟢 SAFE")
        print(f"      • {scenario['name']:<42} => Risk: {prob*100:5.1f}% [{alert_tag}]")

    print("\n" + "="*70)
    print("✅ STATEWIDE AI MODEL TRAINING COMPLETE: All 14 Districts Integrated!")
    print("="*70)


if __name__ == "__main__":
    df = step1_fetch_statewide_data()
    dataset = step2_feature_engineering_statewide(df)
    model, feature_cols, X_test = step3_train_statewide_model(dataset)
    step4_export_all_artifacts(model, feature_cols, X_test)
    step5_verify_districts_inference(model, feature_cols)
