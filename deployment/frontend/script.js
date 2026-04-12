(function () {
  'use strict';

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ==========================================
  // 1. FIND BLOOD LOGIC
  // ==========================================
  const searchForm = document.getElementById('searchForm');
  const resultsGrid = document.getElementById('resultsGrid');
  const resultsLoading = document.getElementById('resultsLoading');
  const resultsEmpty = document.getElementById('resultsEmpty');
  const emergencyMode = document.getElementById('emergencyMode');

  if (searchForm) {
    searchForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const bloodGroup = document.getElementById('bloodGroup')?.value;
      
      // Smart Check: Find Location ka ID 'findLocationInput' bhi ho sakta hai ya 'location' bhi
      const locationInput = document.getElementById('findLocationInput') || document.getElementById('location');
      const location = locationInput?.value || '';
      
      const urgency = document.getElementById('urgency')?.value || 'normal';

      if (!bloodGroup) return;

      if (urgency === 'critical' && emergencyMode) emergencyMode.style.display = 'block';

      // Loading animation chalu karein
      resultsLoading?.classList.add('active');
      if (resultsGrid) resultsGrid.classList.add('hidden');
      if (resultsEmpty) resultsEmpty.classList.add('hidden');

      try {
        // Flask Backend API ko call kar rahe hain
        const response = await fetch('http://127.0.0.1:5000/api/find_donors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bloodGroup, location, urgency })
        });

        const matches = await response.json();
        
        // Loading animation band karein
        resultsLoading?.classList.remove('active');

        // Agar koi donor nahi mila
        if (resultsEmpty) {
          resultsEmpty.classList.add('hidden');
          if (matches.length === 0) {
            resultsEmpty.innerHTML = 'No matching donors found for this City and Blood Group. Try adjusting your search.';
            resultsEmpty.classList.remove('hidden');
          }
        }

        // Agar donors mil gaye toh Cards banayein
        if (resultsGrid) {
          resultsGrid.classList.remove('hidden');
          resultsGrid.innerHTML = '';

          if (matches.length === 0) return;

          let nearestIndex = 0;
          let immediateDonors = matches.filter(m => m.availability === 'immediate');
          let minDist = immediateDonors.length ? Math.min(...immediateDonors.map(m => m.distance)) : 999;
          let fastestIndex = matches.findIndex(m => m.availability === 'immediate' && m.distance === minDist);
          if (fastestIndex < 0) fastestIndex = 0;

          matches.forEach(function (donor, index) {
            let isBest = index === 0;
            let isNearest = index === nearestIndex;
            let isFastest = index === fastestIndex && donor.availability === 'immediate';
            let isHighlighted = isBest || isNearest || isFastest;
            
            let availLabel = donor.availability === 'immediate' ? 'Available now' :
              donor.availability === 'within-week' ? 'Within a week' : 'Flexible';
            let availClass = donor.availability === 'immediate' ? 'donor-badge-available' : 'donor-badge-unavailable';
            
            // Last donated text smartly show karna
            let lastDonatedText = donor.lastDonated === 0 ? 'Registered Today' : 
                                  donor.lastDonated <= 90 ? donor.lastDonated + ' days ago' : 'Over 3 months ago';
            
            let btnClass = urgency === 'critical' && isHighlighted ? 'btn btn-primary btn-call-now' : 'btn btn-primary';
            let btnText = urgency === 'critical' && isHighlighted ? 'CALL NOW' : 'Contact Donor';

            // Badges List
            let badges = [];
            if (isBest) badges.push('<span class="donor-badge donor-badge-best">&#9733; Best Match</span>');
            if (donor.isVerified) badges.push('<span class="donor-badge" style="background:#e0f2fe; color:#0369a1;">✔️ Verified</span>');
            
            // Tier based badge color
            let tierColor = donor.donorTier.includes('Platinum') ? '#64748b' : 
                            donor.donorTier.includes('Gold') ? '#ca8a04' : 
                            donor.donorTier.includes('Silver') ? '#475569' : 
                            donor.donorTier.includes('Bronze') ? '#b45309' : '#047857';
            let tierBg = donor.donorTier.includes('Platinum') ? '#f1f5f9' : 
                         donor.donorTier.includes('Gold') ? '#fef08a' : 
                         donor.donorTier.includes('Silver') ? '#e2e8f0' : 
                         donor.donorTier.includes('Bronze') ? '#ffedd5' : '#d1fae5';

            badges.push(`<span class="donor-badge" style="background:${tierBg}; color:${tierColor};">🏆 ${donor.donorTier}</span>`);
            badges.push('<span class="donor-badge ' + availClass + '">' + availLabel + '</span>');

            let card = document.createElement('div');
            card.className = 'donor-card' + (isHighlighted ? ' highlighted' : '');
            
            // Card HTML with new Stats UI
            card.innerHTML = `
              <div class="donor-blood">${escapeHtml(donor.bloodGroup)}</div>
              <div class="donor-info">
                <h3 style="display:flex; align-items:center; gap:5px;">
                  ${escapeHtml(donor.name)} 
                  ${donor.isVerified ? '<span title="Verified Profile" style="color:#0ea5e9; font-size:1.1rem;">✔️</span>' : ''}
                </h3>
                <p style="color: var(--gray-600); margin-bottom: 8px;">
                  📍 ${escapeHtml(donor.location)} &middot; 🚗 ${donor.distance} km away &middot; 👤 Age: ${donor.age}
                </p>
                <div class="donor-meta" style="margin-bottom: 12px;">${badges.join('')}</div>
                
                <div style="display: flex; gap: 15px; background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 0.9rem;">
                  <div style="text-align: center; flex: 1;">
                    <div style="font-size: 1.2rem; margin-bottom: 2px;">🩸</div>
                    <div style="font-weight: 700; color: var(--gray-800);">${donor.totalDonations}</div>
                    <div style="color: var(--gray-500); font-size: 0.8rem;">Donations</div>
                  </div>
                  <div style="width: 1px; background: #e2e8f0;"></div>
                  <div style="text-align: center; flex: 1;">
                    <div style="font-size: 1.2rem; margin-bottom: 2px;">❤️</div>
                    <div style="font-weight: 700; color: var(--primary);">${donor.livesSaved}</div>
                    <div style="color: var(--gray-500); font-size: 0.8rem;">Lives Saved</div>
                  </div>
                  <div style="width: 1px; background: #e2e8f0;"></div>
                  <div style="text-align: center; flex: 1;">
                    <div style="font-size: 1.2rem; margin-bottom: 2px;">🕒</div>
                    <div style="font-weight: 700; color: var(--gray-800); font-size:0.85rem;">${escapeHtml(lastDonatedText)}</div>
                    <div style="color: var(--gray-500); font-size: 0.8rem;">Last Donated</div>
                  </div>
                </div>

                <div class="donor-action">
                  <a href="tel:+919876543210" class="${btnClass}">${btnText}</a>
                </div>
              </div>
              <div class="donor-match">
                <div class="donor-match-score">${donor.matchScore}%</div>
                <div class="donor-match-label">AI Match</div>
              </div>`;
            resultsGrid.appendChild(card);
          });
        }
      } catch (error) {
        resultsLoading?.classList.remove('active');
        alert("Error: Backend server se connect nahi ho pa raha. Make sure terminal mein 'python app.py' chal raha ho.");
      }
    });
  }

  // ==========================================
  // 2. REGISTER DONOR LOGIC
  // ==========================================
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      
      const name = document.getElementById('name')?.value?.trim();
      const age = document.getElementById('age')?.value;
      const bloodGroup = document.getElementById('bloodGroup')?.value;
      
      // Location input can be 'regLocationInput' or 'location'
      const locInput = document.getElementById('regLocationInput') || document.getElementById('location');
      const location = locInput?.value || '';
      
      const lastDonation = document.getElementById('lastDonation')?.value || "0";
      
      try {
        const response = await fetch('http://127.0.0.1:5000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: name, 
            age: age, 
            bloodGroup: bloodGroup, 
            location: location,
            lastDonation: lastDonation
          })
        });
        const data = await response.json();
        alert(data.message);
        registerForm.reset();
      } catch (err) {
        alert('Registration failed. Check backend connection.');
      }
    });
  }

  // ==========================================
  // 3. DASHBOARD STATS LOGIC
  // ==========================================
  const statTotalDonors = document.getElementById('stat-total-donors');
  if (statTotalDonors) {
    async function fetchDashboardStats() {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/stats');
        const data = await response.json();
        
        document.getElementById('stat-total-donors').textContent = data.totalDonors.toLocaleString();
        document.getElementById('stat-active-donors').textContent = data.activeDonors.toLocaleString();
        document.getElementById('stat-lives-saved').textContent = data.livesSaved.toLocaleString();
        document.getElementById('stat-total-volume').textContent = data.totalVolumeLiters.toLocaleString() + ' Liters';
      } catch (error) {
        console.error("Error fetching stats:", error);
        statTotalDonors.textContent = "Error";
      }
    }
    fetchDashboardStats();
  }

  // Mobile Navigation Toggle
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

})(); // <-- IIFE BLOCK YAHAN BAND HOTA HAI! ZAROORI HAI!


// ==========================================
// 📍 GLOBAL FUNCTIONS (GPS Logic)
// ==========================================
// Yeh universal function hai jo bahar se call ho sakta hai
async function useGPSLocation(inputId, btnId) {
    const gpsBtn = document.getElementById(btnId);
    const locationInput = document.getElementById(inputId);
    
    // Safety check in case IDs don't match
    if (!gpsBtn || !locationInput) {
        console.error("System could not find the Button or Input box.");
        return;
    }
    
    const originalText = gpsBtn.innerHTML;

    // Button state update
    gpsBtn.innerText = "⏳...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            try {
                // Free OpenStreetMap API
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();

                let city = data.address.city || data.address.town || data.address.state_district || "";

                if (city) {
                    city = city.replace(" District", ""); 
                    locationInput.value = city; 
                    
                    gpsBtn.innerText = "✅ Done!";
                    setTimeout(() => gpsBtn.innerHTML = originalText, 2500); 
                } else {
                    alert("Exact city not found. Please type manually.");
                    gpsBtn.innerHTML = originalText;
                }
            } catch (error) {
                console.error("API Error:", error);
                alert("Could not connect to GPS server. Please type manually.");
                gpsBtn.innerHTML = originalText;
            }
        }, function(error) {
            alert("Please allow Location Access in your browser popup! 🔒");
            gpsBtn.innerHTML = originalText;
        });
    } else {
        alert("Your browser does not support GPS Geolocation.");
        gpsBtn.innerHTML = originalText;
    }
}