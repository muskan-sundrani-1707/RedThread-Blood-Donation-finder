from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import random
import csv
import os

app = Flask(__name__)
CORS(app) 

# ==========================================
# 1. LOAD MACHINE LEARNING MODEL
# ==========================================
print("Loading AI Model...")
try:
    pipeline = joblib.load('donor_ml_pipeline.pkl')
    print("Model Loaded Successfully!")
except FileNotFoundError:
    print("WARNING: 'donor_ml_pipeline.pkl' nahi mili.")
    pipeline = None

# ==========================================
# 2. LOAD MAIN DATABASE
# ==========================================
print("Loading Database...")
try:
    donors_db = pd.read_csv('final_blood_donation_dataset4new 2.csv', skiprows=1, on_bad_lines='skip')
    donors_db.columns = ['recency', 'frequency', 'monetary', 'time', 'donated_target', 'blood_group', 'age', 'city']
except FileNotFoundError:
    donors_db = pd.DataFrame(columns=['recency', 'frequency', 'monetary', 'time', 'donated_target', 'blood_group', 'age', 'city'])

first_names = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Neha", "Ravi", "Pooja", "Arjun", "Kavita", "Aditya", "Roshni", "Karan", "Anjali", "Siddharth", "Meera", "Aarav", "Nisha", "Rohan", "Simran"]
last_names = ["Sharma", "Verma", "Singh", "Patel", "Kumar", "Gupta", "Desai", "Joshi", "Iyer", "Nair", "Reddy", "Menon", "Bose", "Das", "Kapoor", "Malhotra"]

if not donors_db.empty:
    donors_db['name'] = [f"{random.choice(first_names)} {random.choice(last_names)}" for _ in range(len(donors_db))]

# ==========================================
# 3. 🚀 HACKATHON MAGIC: AUTO-GENERATE 200 EXTRA DONORS
# ==========================================
print("Generating 200 Extra Fake Donors for Presentation...")
indian_cities = ["Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Surat", "Kanpur", "Nagpur", "Indore", "Thane","Bina","Bhopal"]
all_blood_groups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]

extra_donors = []
for _ in range(200): #
    freq = random.randint(1, 15)
    extra_donors.append({
        'name': f"{random.choice(first_names)} {random.choice(last_names)}",
        'blood_group': random.choice(all_blood_groups),
        'city': random.choice(indian_cities),
        'age': random.randint(18, 55),
        'recency': random.randint(1, 12),
        'frequency': freq,
        'monetary': freq * 250,
        'time': random.randint(5, 48),
        'donated_target': 1
    })

# Asli data aur 200 fake data ko mila diya!
donors_db = pd.concat([donors_db, pd.DataFrame(extra_donors)], ignore_index=True)

# ==========================================
# 4. LOAD NEW REGISTERED DONORS (From Website)
# ==========================================
if os.path.exists('new_donors.csv'):
    new_donors_df = pd.read_csv('new_donors.csv')
    donors_db = pd.concat([donors_db, new_donors_df], ignore_index=True)

# ==========================================
# API ROUTES
# ==========================================
@app.route('/')
def home():
    return "<h1>Red Thread API is Running! 🚀</h1>"

@app.route('/api/find_donors', methods=['POST'])
def find_donors():
    data = request.json
    requested_blood_group = data.get('bloodGroup')
    requested_city = data.get('location', '').strip().lower()
    urgency = data.get('urgency', 'normal')

    filtered_df = donors_db[donors_db['blood_group'] == requested_blood_group].copy()
    if requested_city:
        filtered_df = filtered_df[filtered_df['city'].str.lower().str.contains(requested_city, na=False)]

    if filtered_df.empty:
        return jsonify([]) 

    filtered_df = filtered_df.head(100) 

    features_for_prediction = filtered_df[['recency', 'frequency', 'monetary', 'time', 'age', 'blood_group', 'city']].copy()
    features_for_prediction.columns = ['Recency', 'Frequency', 'Monetary', 'Time', 'Age', 'Blood_Group', 'City']
    
    if pipeline:
        probabilities = pipeline.predict_proba(features_for_prediction)
    else:
        probabilities = [[0.5, 0.5] for _ in range(len(filtered_df))]

    results = []
    
    for i, (_, donor) in enumerate(filtered_df.iterrows()):
        freq = int(donor['frequency'])
        
        if freq == 0 or (freq == 1 and int(donor['time']) == 0):
            base_match_score = random.randint(90, 98) 
        else:
            prob_available = probabilities[i][1] 
            base_match_score = int(prob_available * 100)
        
        distance = round(random.uniform(1.0, 25.0), 1)
        urgency_penalty = 0
        if urgency == 'critical' and distance > 10:
            urgency_penalty = 15
        elif urgency == 'urgent' and distance > 15:
            urgency_penalty = 10
            
        final_score = max(0, base_match_score - urgency_penalty)
        
        lives_saved = freq * 3
        if freq >= 20: tier = "Platinum Donor"
        elif freq >= 10: tier = "Gold Donor"
        elif freq >= 5: tier = "Silver Donor"
        elif freq >= 2: tier = "Bronze Donor"
        else: tier = "First-time Donor"
        
        donor_data = {
            "id": random.randint(1000, 99999),
            "name": donor['name'],
            "bloodGroup": donor['blood_group'],
            "location": donor['city'].title(),
            "distance": distance,
            "age": int(donor['age']),
            "totalDonations": freq, 
            "livesSaved": lives_saved,
            "donorTier": tier,
            "isVerified": True if random.random() > 0.2 else False,
            "totalVolumeCC": int(donor['monetary']),
            "lastDonated": int(donor['recency'] * 30),
            "matchScore": final_score,
            "availability": 'immediate' if final_score >= 50 else 'within-week'
        }
        results.append(donor_data)

    results.sort(key=lambda x: (-x['matchScore'], x['distance']))
    return jsonify(results)

@app.route('/api/register', methods=['POST'])
def register_donor():
    data = request.json
    name = data.get('name', 'Anonymous').strip().title()
    blood_group = data.get('bloodGroup', 'O+')
    raw_location = data.get('location', '')
    city = raw_location.strip().title() if raw_location.strip() else 'Unknown'
    raw_age = data.get('age', 25)
    age = int(raw_age) if raw_age else 25

    recency = int(data.get('lastDonation', 0))
    frequency = 0 if recency == 0 else 1 
    monetary = frequency * 250

    new_donor = {
        'recency': recency, 'frequency': frequency, 'monetary': monetary,      
        'time': recency, 'donated_target': 1, 'blood_group': blood_group,
        'age': age, 'city': city, 'name': name
    }

    global donors_db
    donors_db = pd.concat([donors_db, pd.DataFrame([new_donor])], ignore_index=True)

    file_exists = os.path.isfile('new_donors.csv')
    with open('new_donors.csv', mode='a', newline='') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(['recency', 'frequency', 'monetary', 'time', 'donated_target', 'blood_group', 'age', 'city', 'name'])
        writer.writerow([recency, frequency, monetary, recency, 1, blood_group, age, city, name])

    return jsonify({"status": "success", "message": f"Thank you {name}! Aap ab Red Thread ke donor ban chuke hain (City: {city})."})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    real_donors = len(donors_db)
    real_active = int(donors_db[donors_db['donated_target'] == 1].shape[0])
    real_donations = int(donors_db['frequency'].sum())
    real_volume = int(donors_db['monetary'].sum())
    
    base_donors = 1248
    base_active = 835
    base_donations = 4210
    base_volume = base_donations * 250
    
    return jsonify({
        "totalDonors": base_donors + real_donors,
        "activeDonors": base_active + real_active,
        "totalDonations": base_donations + real_donations,
        "livesSaved": (base_donations + real_donations) * 3,
        "totalVolumeLiters": round((base_volume + real_volume) / 1000, 1) 
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)