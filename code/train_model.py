import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from sklearn.metrics import classification_report, accuracy_score
import joblib

# 1. Load Dataset (Naye folder structure ke hisaab se)
print("Loading dataset...")
df = pd.read_csv("../dataset/final_blood_donation_dataset4new 2.csv", skiprows=1, on_bad_lines='skip')

# Columns rename kiye
df.columns = ['Recency', 'Frequency', 'Monetary', 'Time', 'Donated', 'Blood_Group', 'Age', 'City']

# Data ko clean karna (Numbers ensure karna)
numeric_cols = ['Recency', 'Frequency', 'Monetary', 'Time', 'Age']
for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')

df['Donated'] = pd.to_numeric(df['Donated'], errors='coerce').fillna(0).astype(int)
df = df.dropna()

# 2. Features (X) aur Target (y) alag karein
X = df[['Recency', 'Frequency', 'Monetary', 'Time', 'Age', 'Blood_Group', 'City']]
y = df['Donated']

# 80% Training, 20% Testing
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Smart Data Preprocessor (Encoding & Scaling)
preprocessor = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), ['Recency', 'Frequency', 'Monetary', 'Time', 'Age']),
        ('cat', OneHotEncoder(handle_unknown='ignore'), ['Blood_Group', 'City'])
    ])

# 4. TUNED 5 ULTIMATE MODELS (For 80%+ Accuracy)
print("Initializing 5 Tuned Advanced Models...")
model1 = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)
model2 = GradientBoostingClassifier(n_estimators=150, learning_rate=0.05, max_depth=3, random_state=42)
model3 = LogisticRegression(max_iter=1000, random_state=42)
model4 = KNeighborsClassifier(n_neighbors=11)
model5 = SVC(probability=True, kernel='rbf', C=1.0, random_state=42)

# Paancho ko milakar ek 'Voting Classifier' banaya
ensemble_model = VotingClassifier(
    estimators=[
        ('RandomForest', model1), 
        ('GradientBoost', model2), 
        ('LogisticReg', model3),
        ('KNN', model4),
        ('SVM', model5)
    ],
    voting='soft' # Soft voting probabilities ka average nikalta hai
)

# 5. Pipeline mein fit karein
print("Training the 5-in-1 Super Ensemble Model (This might take a few seconds)...")
model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', ensemble_model)
])

# Train the model
model_pipeline.fit(X_train, y_train)

# 6. Test the Model
y_pred = model_pipeline.predict(X_test)
print("\n--- 5-in-1 Ensemble Model Performance ---")
print(f"Overall Accuracy: {accuracy_score(y_test, y_pred) * 100:.2f}%")
print("\nClassification Report:\n", classification_report(y_test, y_pred))

# 7. Save the Model Pipeline directly into the deployment folder
os.makedirs('../deployment', exist_ok=True) # Ensure folder exists
save_path = '../deployment/donor_ml_pipeline.pkl'
joblib.dump(model_pipeline, save_path)
print(f"\nSuccess! 5-in-1 Model saved ready for the website at: {save_path}")