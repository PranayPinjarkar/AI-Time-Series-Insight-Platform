import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
import joblib
import os

def train_and_save_model():
    print("Loading dataset...")
    # Load dataset with robust encoding handling
    try:
        df = pd.read_csv('processed_long_dataset.csv', encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv('processed_long_dataset.csv', encoding='latin1')
    except FileNotFoundError:
        print("Error: 'processed_long_dataset.csv' not found.")
        return

    # Basic cleaning
    df = df.dropna(subset=["Value"])
    
    # Sample data for faster training (10%) - Remove this line for production if needed
    df = df.sample(frac=0.1, random_state=42)
    print(f"Training on {len(df)} samples...")
    
    # Feature Engineering for Forecasting
    # We want to predict 'Value' based on Area, Month, Element, Year
    
    # Define features and target
    X = df[['Area', 'Month', 'Element', 'Year']]
    y = df['Value']

    # Preprocessing pipeline
    categorical_features = ['Area', 'Month', 'Element']
    numerical_features = ['Year']

    categorical_transformer = OneHotEncoder(handle_unknown='ignore')
    numerical_transformer = StandardScaler()

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numerical_transformer, numerical_features),
            ('cat', categorical_transformer, categorical_features)
        ])

    # Model pipeline
    model = Pipeline(steps=[('preprocessor', preprocessor),
                            ('regressor', RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1))])

    print("Training model (this might take a moment)...")
    model.fit(X, y)
    
    print("Saving model pipeline...")
    joblib.dump(model, 'model_pipeline.pkl')
    print("Model saved to model_pipeline.pkl")

    # --- Clustering for "Similar Areas Explorer" ---
    print("Performing clustering...")
    
    feature_agg = df.groupby(['Area', 'Element'])['Value'].agg(['mean', 'std', 'min', 'max']).reset_index()
    feature_agg = feature_agg.fillna(0)
    
    cluster_features = ['mean', 'std', 'min', 'max']
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(feature_agg[cluster_features])
    
    kmeans = KMeans(n_clusters=10, random_state=42)
    feature_agg['Cluster'] = kmeans.fit_predict(scaled_features)
    
    print("Saving cluster data...")
    feature_agg.to_csv('area_clusters.csv', index=False)
    print("Cluster data saved to area_clusters.csv")

if __name__ == "__main__":
    train_and_save_model()
