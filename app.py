from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import joblib
import os
import json

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Load model and data
MODEL_PATH = 'model_pipeline.pkl'
DATA_PATH = 'processed_long_dataset.csv'
CLUSTERS_PATH = 'area_clusters.csv'

model = None
df = None
clusters_df = None

def load_resources():
    global model, df, clusters_df
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    else:
        print("Warning: Model file not found.")
    
    if os.path.exists(DATA_PATH):
        try:
            df = pd.read_csv(DATA_PATH, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(DATA_PATH, encoding='latin1')
        df = df.dropna(subset=["Value"])
    else:
        print("Warning: Data file not found.")
        
    if os.path.exists(CLUSTERS_PATH):
        clusters_df = pd.read_csv(CLUSTERS_PATH)
    else:
        print("Warning: Clusters file not found.")

load_resources()

@app.route('/')
def index():
    return jsonify({"status": "running", "message": "AI Time-Series Insight Platform API is active."})

@app.route('/api/options')
def get_options():
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500
    
    areas = sorted(df['Area'].unique().tolist())
    elements = sorted(df['Element'].unique().tolist())
    months = sorted(df['Month'].unique().tolist())
    
    return jsonify({
        'areas': areas,
        'elements': elements,
        'months': months
    })

@app.route('/api/data')
def get_data():
    area = request.args.get('area')
    element = request.args.get('element')
    month = request.args.get('month')
    
    if df is None:
        return jsonify({'error': 'Data not loaded'}), 500

    filtered_df = df[(df['Area'] == area) & (df['Element'] == element)]
    
    if month and month != 'All months':
        filtered_df = filtered_df[filtered_df['Month'] == month]
    
    # Sort by Year
    filtered_df = filtered_df.sort_values(by='Year')
    
    data = {
        'years': filtered_df['Year'].tolist(),
        'values': filtered_df['Value'].tolist(),
        'months': filtered_df['Month'].tolist() if month == 'All months' else None
    }
    return jsonify(data)

@app.route('/api/forecast')
def get_forecast():
    area = request.args.get('area')
    element = request.args.get('element')
    month = request.args.get('month')
    
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
        
    # Generate future years
    last_year = df['Year'].max()
    future_years = list(range(last_year + 1, last_year + 11)) # Forecast 10 years
    
    if month == 'All months':
        target_month = 'January' 
    else:
        target_month = month
        
    # Prepare input dataframe for prediction
    input_data = pd.DataFrame({
        'Area': [area] * len(future_years),
        'Month': [target_month] * len(future_years),
        'Element': [element] * len(future_years),
        'Year': future_years
    })
    
    predictions = model.predict(input_data)
    
    return jsonify({
        'years': future_years,
        'values': predictions.tolist(),
        'month': target_month
    })

@app.route('/api/anomalies')
def get_anomalies():
    area = request.args.get('area')
    element = request.args.get('element')
    
    if model is None or df is None:
        return jsonify({'error': 'Resources not loaded'}), 500
        
    # Get historical data
    filtered_df = df[(df['Area'] == area) & (df['Element'] == element)].copy()
    
    # Predict for historical data
    X_hist = filtered_df[['Area', 'Month', 'Element', 'Year']]
    filtered_df['Predicted'] = model.predict(X_hist)
    
    # Calculate error
    filtered_df['Error'] = (filtered_df['Value'] - filtered_df['Predicted']).abs()
    
    # Define anomaly threshold (e.g., 2 std dev)
    threshold = filtered_df['Error'].mean() + 2 * filtered_df['Error'].std()
    
    anomalies = filtered_df[filtered_df['Error'] > threshold]
    
    return jsonify({
        'years': filtered_df['Year'].tolist(),
        'months': filtered_df['Month'].tolist(),
        'actual': filtered_df['Value'].tolist(),
        'predicted': filtered_df['Predicted'].tolist(),
        'anomalies': anomalies[['Year', 'Month', 'Value', 'Error']].to_dict(orient='records')
    })

@app.route('/api/similar')
def get_similar():
    area = request.args.get('area')
    element = request.args.get('element')
    
    if clusters_df is None:
        return jsonify({'error': 'Cluster data not loaded'}), 500
        
    # Find cluster for selected Area-Element
    target = clusters_df[(clusters_df['Area'] == area) & (clusters_df['Element'] == element)]
    
    if target.empty:
        return jsonify({'similar_areas': []})
        
    target_cluster = target['Cluster'].iloc[0]
    
    # Get other areas in same cluster
    similar = clusters_df[
        (clusters_df['Cluster'] == target_cluster) & 
        (clusters_df['Element'] == element) & 
        (clusters_df['Area'] != area)
    ]
    
    # Return top 5 similar areas
    return jsonify({
        'similar_areas': similar['Area'].head(5).tolist(),
        'cluster_id': int(target_cluster)
    })

if __name__ == '__main__':
    print("Starting Flask API server...")
    app.run(debug=True, port=5000)
