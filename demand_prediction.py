import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS if needed

print("Starting Flask API...")

# Try to load the trained model and log the status
try:
    model = joblib.load("demand_model.pkl")
    print("Model loaded successfully!")
except Exception as e:
    print("Error loading model:", e)

# Define the dummy month columns and features order (must match training)
DUMMY_MONTH_COLS = [f"month_{m}" for m in range(2, 13)]
FEATURES = [
    "year",
    "day_of_week",
    "is_weekend",
    "is_holiday_season",
    "avg_lead_time",
    "sum_previous_bookings",
    "avg_adr",
    "total_children"
] + DUMMY_MONTH_COLS

@app.route('/predict_demand', methods=['GET'])
def predict_demand():
    """
    Example usage:
    curl "http://127.0.0.1:5000/predict_demand?year=2025&month=7&day_of_week=5&is_weekend=1&is_holiday_season=1&avg_lead_time=120&sum_previous_bookings=50&avg_adr=200&total_children=5"
    """
    try:
        # Parse input parameters with default values
        year = int(request.args.get("year", 2025))
        month = int(request.args.get("month", 7))
        day_of_week = int(request.args.get("day_of_week", 4))
        is_weekend = int(request.args.get("is_weekend", 0))
        is_holiday_season = int(request.args.get("is_holiday_season", 0))
        avg_lead_time = float(request.args.get("avg_lead_time", 30))
        sum_previous_bookings = float(request.args.get("sum_previous_bookings", 5))
        avg_adr = float(request.args.get("avg_adr", 100))
        total_children = float(request.args.get("total_children", 2))
        
        # Build a row dictionary with the features
        row_dict = {
            "year": year,
            "day_of_week": day_of_week,
            "is_weekend": is_weekend,
            "is_holiday_season": is_holiday_season,
            "avg_lead_time": avg_lead_time,
            "sum_previous_bookings": sum_previous_bookings,
            "avg_adr": avg_adr,
            "total_children": total_children
        }
        # Initialize dummy month columns to 0
        for m_col in DUMMY_MONTH_COLS:
            row_dict[m_col] = 0
        
        # Set the correct dummy column to 1 for the given month
        month_col = f"month_{month}"
        if month_col in row_dict:
            row_dict[month_col] = 1

        # Create DataFrame ensuring columns are in the correct order
        X_input = pd.DataFrame([row_dict])
        X_input = X_input[FEATURES]

        # Predict and round the result
        prediction = model.predict(X_input)
        predicted_count = int(round(prediction[0]))
        return jsonify({"predicted_room_demand": predicted_count})
    except Exception as e:
        print("Error in prediction:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Bind to 0.0.0.0 so that Railway can route external traffic to your app
    app.run(host="0.0.0.0", port=5000, debug=True)
    import os
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

