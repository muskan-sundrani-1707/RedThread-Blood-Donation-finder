(function () {
  'use strict';

  const API_BASE_URLS = [
    'https://profile-uninsured-shining.ngrok-free.dev',
    'http://127.0.0.1:5000'
  ];
  const DASHBOARD_FALLBACK_STATS = {
    totalDonors: 1350,
    activeDonors: 920,
    livesSaved: 12900,
    totalVolumeLiters: 1105.5
  };
  const DASHBOARD_FALLBACK_ANALYTICS = {
    donationTrends: [
      { label: 'Jan-Feb', value: 280 },
      { label: 'Mar-Apr', value: 330 },
      { label: 'May-Jun', value: 410 },
      { label: 'Jul-Aug', value: 470 },
      { label: 'Sep-Oct', value: 510 },
      { label: 'Nov-Dec', value: 520 }
    ],
    availabilityRate: [
      { label: 'Immediate', value: 48 },
      { label: 'Within week', value: 34 },
      { label: 'Flexible', value: 18 }
    ],
    responseTimeMinutes: [
      { label: 'Critical', value: 7 },
      { label: 'Urgent', value: 11 },
      { label: 'Normal', value: 16 }
    ]
  };

  async function fetchFromApi(path, options) {
    let lastError = null;
    for (const baseUrl of API_BASE_URLS) {
      try {
        const requestOptions = { ...(options || {}) };
        requestOptions.headers = {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(options?.headers || {})
        };

        const response = await fetch(`${baseUrl}${path}`, requestOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Unable to reach API');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function renderSimpleBars(targetId, items, valueSuffix = '') {
    const target = document.getElementById(targetId);
    if (!target) return;

    if (!Array.isArray(items) || items.length === 0) {
      target.innerHTML = '<div class="analytics-empty">No data available.</div>';
      return;
    }

    const maxValue = Math.max(...items.map(item => Number(item.value) || 0), 1);
    target.innerHTML = items.map(item => {
      const value = Number(item.value) || 0;
      const width = Math.max(6, Math.round((value / maxValue) * 100));
      return `
        <div class="analytics-row">
          <div class="analytics-meta">
            <span class="analytics-label">${escapeHtml(item.label)}</span>
            <span>${value.toLocaleString()}${valueSuffix}</span>
          </div>
          <div class="analytics-bar-wrap">
            <div class="analytics-bar" style="width:${width}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDashboardStats(data) {
    document.getElementById('stat-total-donors').textContent = data.totalDonors.toLocaleString();
    document.getElementById('stat-active-donors').textContent = data.activeDonors.toLocaleString();
    document.getElementById('stat-lives-saved').textContent = data.livesSaved.toLocaleString();
    document.getElementById('stat-total-volume').textContent = data.totalVolumeLiters.toLocaleString() + ' Liters';
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
      
      const locationInput = document.getElementById('findLocationInput') || document.getElementById('location');
      const location = locationInput?.value || '';
      
      const urgency = document.getElementById('urgency')?.value || 'normal';

      if (!bloodGroup) return;

      if (urgency === 'critical' && emergencyMode) emergencyMode.style.display = 'block';

      resultsLoading?.classList.add('active');
      if (resultsGrid) resultsGrid.classList.add('hidden');
      if (resultsEmpty) resultsEmpty.classList.add('hidden');

      try {
        const response = await fetchFromApi('/api/find_donors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bloodGroup, location, urgency })
        });

        const matches = await response.json();
        
        resultsLoading?.classList.remove('active');

        if (resultsEmpty) {
          resultsEmpty.classList.add('hidden');
          if (matches.length === 0) {
            resultsEmpty.innerHTML = 'No matching donors found for this City and Blood Group. Try adjusting your search.';
            resultsEmpty.classList.remove('hidden');
          }
        }

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
            
            let lastDonatedText = donor.lastDonated === 0 ? 'Registered' : 
                      donor.lastDonated <= 90 ? donor.lastDonated + ' days ago' : 'Over 3 months ago';
            
            let btnClass = urgency === 'critical' && isHighlighted ? 'btn btn-primary btn-call-now' : 'btn btn-primary';
            let btnText = urgency === 'critical' && isHighlighted ? 'CALL NOW' : 'Contact Donor';

            let badges = [];
            if (isBest) badges.push('<span class="donor-badge donor-badge-best">&#9733; Best Match</span>');
            if (donor.isVerified) badges.push('<span class="donor-badge" style="background:#e0f2fe; color:#0369a1;">✔️ Verified</span>');
            
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
        alert("Error: Unable to connect to the backend server. Make sure 'python app.py' is running in your terminal.");
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
      
      const locInput = document.getElementById('regLocationInput') || document.getElementById('location');
      const location = locInput?.value || '';
      const availability = document.getElementById('availability')?.value || 'immediate';
      const lastDonation = document.getElementById('lastDonation')?.value || "0";
      
      try {
        const response = await fetchFromApi('/api/register', {
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
        const response = await fetchFromApi('/api/stats');
        const data = await response.json();
        renderDashboardStats(data);
      } catch (error) {
        console.error("Error fetching stats:", error);
        // Netlify-safe fallback when ngrok/local backend is unavailable.
        renderDashboardStats(DASHBOARD_FALLBACK_STATS);
      }
    }

    async function fetchDashboardAnalytics() {
      try {
        const response = await fetchFromApi('/api/analytics');
        const data = await response.json();

        renderSimpleBars('analytics-donation-trends', data.donationTrends || []);
        renderSimpleBars('analytics-availability-rate', data.availabilityRate || [], '%');
        renderSimpleBars('analytics-response-time', data.responseTimeMinutes || [], ' min');
      } catch (error) {
        console.error("Error fetching analytics:", error);
        renderSimpleBars('analytics-donation-trends', DASHBOARD_FALLBACK_ANALYTICS.donationTrends);
        renderSimpleBars('analytics-availability-rate', DASHBOARD_FALLBACK_ANALYTICS.availabilityRate, '%');
        renderSimpleBars('analytics-response-time', DASHBOARD_FALLBACK_ANALYTICS.responseTimeMinutes, ' min');
      }
    }

    fetchDashboardStats();
    fetchDashboardAnalytics();
  }

  // Mobile Navigation Toggle
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

})(); // End of IIFE block.


// ==========================================
// 📍 GLOBAL FUNCTIONS (GPS Logic)
// ==========================================
async function useGPSLocation(inputId, btnId) {
    const gpsBtn = document.getElementById(btnId);
    const locationInput = document.getElementById(inputId);
    
    if (!gpsBtn || !locationInput) {
        console.error("System could not find the Button or Input box.");
        return;
    }
    
    const originalText = gpsBtn.innerHTML;

    gpsBtn.innerText = "⏳...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            try {
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