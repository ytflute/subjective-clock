document.addEventListener('DOMContentLoaded', async () => {
    // Get Firebase SDK functions from window
    const {
        initializeApp,
        getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
        getFirestore, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, setDoc, getDoc, limit,
        setLogLevel
    } = window.firebaseSDK;

    // DOM Element Retrieval
    const findCityButton = document.getElementById('findCityButton');
    const resultTextDiv = document.getElementById('resultText');
    const countryFlagImg = document.getElementById('countryFlag');
    const mapContainerDiv = document.getElementById('mapContainer');
    const debugInfoSmall = document.getElementById('debugInfo');

    const userNameInput = document.getElementById('userName');
    const setUserNameButton = document.getElementById('setUserNameButton');
    const currentUserIdSpan = document.getElementById('currentUserId');
    const currentUserDisplayNameSpan = document.getElementById('currentUserDisplayName');

    const historyListUl = document.getElementById('historyList');
    const historyMapContainerDiv = document.getElementById('historyMapContainer');
    const historyDebugInfoSmall = document.getElementById('historyDebugInfo');
    const refreshHistoryButton = document.getElementById('refreshHistoryButton');

    const globalDateInput = document.getElementById('globalDate');
    const refreshGlobalMapButton = document.getElementById('refreshGlobalMapButton');
    const globalTodayMapContainerDiv = document.getElementById('globalTodayMapContainer');
    const globalTodayDebugInfoSmall = document.getElementById('globalTodayDebugInfo');

    // Global Variables
    let citiesData = [];
    let db, auth;
    let currentDataIdentifier = null;
    let rawUserDisplayName = "";
    let clockLeafletMap = null;
    let globalLeafletMap = null;
    let globalMarkerLayerGroup = null;
    let historyLeafletMap = null;
    let historyMarkerLayerGroup = null;

    // Firebase Configuration
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id-worldclock-history';
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    const firebaseConfig = {
      apiKey: "AIzaSyC5-AKkFhx9olWx57bdB985IwZA9DpH66o",
      authDomain: "subjective-clock.firebaseapp.com",
      projectId: "subjective-clock",
      storageBucket: "subjective-clock.appspot.com",
      messagingSenderId: "452566766153",
      appId: "1:452566766153:web:522312f3ed5c81403f2598",
      measurementId: "G-QZ6440LZEM"
    };

    console.log("DOM loaded. Initializing Firebase...");

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("Firebase configuration is incomplete!");
        alert("Firebase configuration is incomplete, the application cannot initialize Firebase.");
        currentUserIdSpan.textContent = "Firebase Configuration Error";
        return;
    }

    try {
        setLogLevel('debug');
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully. App ID (for path prefix):", appId, "Project ID (from config):", firebaseConfig.projectId);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        currentUserIdSpan.textContent = "Firebase Initialization Failed";
        alert("Firebase initialization failed, some features may not be available.");
        return;
    }

    if (globalDateInput) {
        // New method: directly set .value to the local date's YYYY-MM-DD string
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
        const day = today.getDate().toString().padStart(2, '0');
        const localTodayDateString = `${year}-${month}-${day}`; // Corrected template literal

        globalDateInput.value = localTodayDateString;
        console.log("Page initially loaded, globalDateInput.value set to:", globalDateInput.value);
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Firebase session authenticated (Auth UID):", user.uid, "Anonymous:", user.isAnonymous);
            const lastUsedName = localStorage.getItem('worldClockUserName');
            if (lastUsedName && !currentDataIdentifier) {
                console.log("Restored last used name from localStorage:", lastUsedName);
                userNameInput.value = lastUsedName;
                await setOrLoadUserName(lastUsedName, false);
            } else if (currentDataIdentifier) {
                if (citiesData.length > 0) {
                    console.log("Firebase authenticated and currentDataIdentifier is set, enabling findCityButton (if city data is loaded).");
                    findCityButton.disabled = false;
                }
            }
            // On initial page load, if the corresponding tab is active, load its content
            if (document.getElementById('HistoryTab').classList.contains('active') && currentDataIdentifier) {
                loadHistory();
            }
            if (document.getElementById('GlobalTodayMapTab') && document.getElementById('GlobalTodayMapTab').classList.contains('active')) {
                loadGlobalTodayMap();
            }
        } else {
            console.log("Firebase session not authenticated, attempting to sign in...");
            currentUserIdSpan.textContent = "Authenticating...";
            findCityButton.disabled = true;
            if (initialAuthToken) {
                console.log("Attempting to sign in with initialAuthToken...");
                signInWithCustomToken(auth, initialAuthToken)
                    .catch((error) => {
                        console.error("Sign in with initialAuthToken failed, trying anonymous sign-in:", error.code, error.message);
                        signInAnonymously(auth).catch(anonError => {
                            console.error("Anonymous sign-in failed:", anonError);
                            currentUserIdSpan.textContent = "Authentication Failed";
                            alert("Firebase authentication failed, cannot save history.");
                        });
                    });
            } else {
                console.log("initialAuthToken not provided, trying anonymous sign-in...");
                signInAnonymously(auth).catch(error => {
                    console.error("Anonymous sign-in failed:", error);
                    currentUserIdSpan.textContent = "Authentication Failed";
                    alert("Firebase authentication failed, cannot save history.");
                });
            }
        }
    });

    function sanitizeNameToFirestoreId(name) {
        if (!name || typeof name !== 'string') return null;
        let sanitized = name.toLowerCase().trim();
        sanitized = sanitized.replace(/\s+/g, '_');
        sanitized = sanitized.replace(/[^a-z0-9_.-]/g, '');
        if (sanitized === "." || sanitized === "..") {
            sanitized = `name_${sanitized.replace(/\./g, '')}`;
        }
        if (sanitized.startsWith("__") && sanitized.endsWith("__") && sanitized.length > 4) {
            sanitized = `name${sanitized.substring(2, sanitized.length - 2)}`;
        } else if (sanitized.startsWith("__")) {
            sanitized = `name${sanitized.substring(2)}`;
        } else if (sanitized.endsWith("__")) {
            sanitized = `name${sanitized.substring(0, sanitized.length - 2)}`;
        }
        return sanitized.substring(0, 100) || null;
    }

    async function setOrLoadUserName(name, showAlert = true) {
        console.log("[setOrLoadUserName] Received name:", name, "showAlert:", showAlert);
        const newDisplayNameRaw = name.trim();
        if (!newDisplayNameRaw) {
            if (showAlert) alert("Display name cannot be empty.");
            return false;
        }
        const sanitizedName = sanitizeNameToFirestoreId(newDisplayNameRaw);
        if (!sanitizedName) {
            if (showAlert) alert("Processed name is invalid (may contain disallowed characters or be too short), please try another name.");
            return false;
        }

        currentDataIdentifier = sanitizedName;
        rawUserDisplayName = newDisplayNameRaw;
        currentUserIdSpan.textContent = currentDataIdentifier;
        currentUserDisplayNameSpan.textContent = rawUserDisplayName;
        userNameInput.value = rawUserDisplayName;
        localStorage.setItem('worldClockUserName', rawUserDisplayName);

        console.log("[setOrLoadUserName] User data identifier set to:", currentDataIdentifier);
        if (showAlert) alert(`Name set to "${rawUserDisplayName}". Your history will be associated with this name.`);

        if (citiesData.length > 0 && auth.currentUser && currentDataIdentifier) {
            console.log("[setOrLoadUserName] All conditions met, enabling findCityButton.");
            findCityButton.disabled = false;
        } else {
            console.log("[setOrLoadUserName] Conditions not met, findCityButton remains disabled. Cities loaded:", citiesData.length > 0, "Auth current user:", !!auth.currentUser, "Data ID set:", !!currentDataIdentifier);
            findCityButton.disabled = true;
        }

        console.log("[setOrLoadUserName] Preparing to switch to ClockTab and display the last record.");
        openTab(null, 'ClockTab', true);
        await displayLastRecordForCurrentUser();
        return true;
    }

    setUserNameButton.addEventListener('click', async () => {
        console.log("'Set/Update Name' button clicked.");
        await setOrLoadUserName(userNameInput.value.trim());
    });

    async function displayLastRecordForCurrentUser() {
        console.log("[displayLastRecordForCurrentUser] function called. currentDataIdentifier:", currentDataIdentifier);
        clearPreviousResults();

        if (!currentDataIdentifier) {
            console.log("[displayLastRecordForCurrentUser] currentDataIdentifier is empty, returning.");
            resultTextDiv.innerHTML = `<p>Please set your display name above first.</p>`;
            return;
        }
        if (!auth.currentUser) {
            console.log("[displayLastRecordForCurrentUser] Firebase user not authenticated, returning.");
            resultTextDiv.innerHTML = `<p>Firebase authenticating, please wait...</p>`;
            return;
        }

        console.log(`[displayLastRecordForCurrentUser] Attempting to get the last record for identifier "${currentDataIdentifier}"...`);
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc"), limit(1));

        try {
            const querySnapshot = await getDocs(q);
            console.log("[displayLastRecordForCurrentUser] Firestore query completed. Snapshot is empty:", querySnapshot.empty);

            if (!querySnapshot.empty) {
                const lastRecord = querySnapshot.docs[0].data();
                console.log("[displayLastRecordForCurrentUser] Found last record:", JSON.parse(JSON.stringify(lastRecord)));

                const userTimeFormatted = lastRecord.localTime || "Unknown time";
                const cityActualUTCOffset = (typeof lastRecord.matchedCityUTCOffset === 'number' && isFinite(lastRecord.matchedCityUTCOffset))
                    ? lastRecord.matchedCityUTCOffset
                    : null;

                const finalCityName = lastRecord.city_zh && lastRecord.city_zh !== lastRecord.city ? `${lastRecord.city_zh} (${lastRecord.city})` : lastRecord.city;
                const finalCountryName = lastRecord.country_zh && lastRecord.country_zh !== lastRecord.country ? `${lastRecord.country_zh} (${lastRecord.country})` : lastRecord.country;

                if (lastRecord.country === "Universe" && lastRecord.city === "Unknown Planet") { // Assuming these are the English keys
                    resultTextDiv.innerHTML = `This is ${rawUserDisplayName}'s last record at <strong>${userTimeFormatted}</strong>,<br>At that time, you had left Earth and started a new day with non-Earth beings from <strong>${finalCityName} (${finalCountryName})</strong>!`;
                } else {
                    resultTextDiv.innerHTML = `This is ${rawUserDisplayName}'s last record at <strong>${userTimeFormatted}</strong>,<br>At that time, you synchronized with people from <strong>${finalCityName} (${finalCountryName})</strong>,<br>and started a new day together!`;
                }

                if (lastRecord.country_iso_code && lastRecord.country_iso_code !== 'universe_code') {
                    countryFlagImg.src = `https://flagcdn.com/w40/${lastRecord.country_iso_code.toLowerCase()}.png`;
                    countryFlagImg.alt = `${finalCountryName} Flag`;
                    countryFlagImg.style.display = 'inline-block';
                } else {
                    countryFlagImg.style.display = 'none';
                }

                if (clockLeafletMap) {
                    clockLeafletMap.remove();
                    clockLeafletMap = null;
                }
                mapContainerDiv.innerHTML = '';
                mapContainerDiv.classList.remove('universe-message');

                if (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude) &&
                    typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) {

                    clockLeafletMap = L.map(mapContainerDiv).setView([lastRecord.latitude, lastRecord.longitude], 7);
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                        subdomains: 'abcd', maxZoom: 19
                    }).addTo(clockLeafletMap);
                    L.circleMarker([lastRecord.latitude, lastRecord.longitude], {
                        color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
                    }).addTo(clockLeafletMap).bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();

                } else if (lastRecord.city === "Unknown Planet") { // Assuming English key
                    mapContainerDiv.classList.add('universe-message');
                    mapContainerDiv.innerHTML = "<p>Vast universe, unable to locate...</p>";
                } else {
                    mapContainerDiv.innerHTML = "<p>Cannot display map, coordinate information for this record is incomplete or invalid.</p>";
                }

                const recordedAtDate = lastRecord.recordedAt && lastRecord.recordedAt.toDate ? lastRecord.recordedAt.toDate().toLocaleString('en-US') : 'Unknown record time'; // Changed to en-US
                const targetUTCOffsetStr = (typeof lastRecord.targetUTCOffset === 'number' && isFinite(lastRecord.targetUTCOffset)) ? lastRecord.targetUTCOffset.toFixed(2) : 'N/A';
                const latitudeStr = (typeof lastRecord.latitude === 'number' && isFinite(lastRecord.latitude)) ? lastRecord.latitude.toFixed(2) : 'N/A';
                const longitudeStr = (typeof lastRecord.longitude === 'number' && isFinite(lastRecord.longitude)) ? lastRecord.longitude.toFixed(2) : 'N/A';

                debugInfoSmall.innerHTML = `(Recorded at: ${recordedAtDate})<br>(Target city latitude: ${latitudeStr}°, longitude: ${longitudeStr}°)<br>(Target UTC offset: ${targetUTCOffsetStr}, City actual UTC offset: ${cityActualUTCOffset !== null ? cityActualUTCOffset.toFixed(2) : 'N/A'}, Timezone: ${lastRecord.timezone || 'Unknown'})`;
            } else {
                resultTextDiv.innerHTML = `<p>Welcome, ${rawUserDisplayName}! No history for this name yet.</p>`;
                console.log("[displayLastRecordForCurrentUser] No history yet for this identifier.");
            }
        } catch (e) {
            console.error("[displayLastRecordForCurrentUser] Failed to read the last record:", e);
            resultTextDiv.innerHTML = "<p>Failed to read the last record.</p>";
        }
    }

    fetch('cities_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            citiesData = data;
            console.log("City data loaded", citiesData.length, "records");
            if (citiesData.length === 0) {
                resultTextDiv.innerHTML = "Info: Loaded city data is empty.";
                findCityButton.disabled = true;
            } else if (currentDataIdentifier && auth.currentUser) {
                findCityButton.disabled = false;
            }
        })
        .catch(e => {
            console.error("Failed to load city data:", e);
            resultTextDiv.innerHTML = "Error: Failed to load city data.";
            findCityButton.disabled = true;
        });

    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    if (refreshGlobalMapButton) {
        refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);
    }

    function parseOffsetString(offsetStr) {
        if (!offsetStr || typeof offsetStr !== 'string') return NaN;
        const cleaned = offsetStr.replace('GMT', '').replace('UTC', '').trim();
        const signMatch = cleaned.match(/^([+-])/);
        const sign = signMatch ? (signMatch[1] === '+' ? 1 : -1) : 1;
        const numericPart = signMatch ? cleaned.substring(1) : cleaned;
        const parts = numericPart.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
        if (isNaN(hours) || isNaN(minutes)) return NaN;
        return sign * (hours + minutes / 60);
    }

    function getCityUTCOffsetHours(ianaTimeZone) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en', { // 'en' is fine for offset calculation
                timeZone: ianaTimeZone,
                timeZoneName: 'longOffset',
            });
            const parts = formatter.formatToParts(now);
            let offsetStringVal = "";
            for (const part of parts) {
                if (part.type === 'timeZoneName' || part.type === 'unknown' || part.type === 'literal') {
                    if ((part.value.startsWith('GMT') || part.value.startsWith('UTC')) && (part.value.includes('+') || part.value.includes('-'))) {
                        offsetStringVal = part.value;
                        break;
                    }
                }
            }
            if (!offsetStringVal) {
                const formattedDateString = formatter.format(now);
                const match = formattedDateString.match(/(GMT|UTC)([+-]\d{1,2}(:\d{2})?)/);
                if (match && match[0]) {
                    offsetStringVal = match[0];
                }
            }
            if (offsetStringVal) {
                return parseOffsetString(offsetStringVal);
            } else {
                console.warn("Could not get timezone offset string from Intl.DateTimeFormat:", ianaTimeZone, "Parts:", parts);
                return NaN;
            }
        } catch (e) {
            console.error("Error getting timezone offset:", ianaTimeZone, e);
            return NaN;
        }
    }

    const timezoneOffsetCache = new Map();

    function clearPreviousResults() {
        resultTextDiv.innerHTML = "";
        countryFlagImg.src = "";
        countryFlagImg.alt = "Country Flag"; // Translated
        countryFlagImg.style.display = 'none';
        if (clockLeafletMap) {
            clockLeafletMap.remove();
            clockLeafletMap = null;
        }
        mapContainerDiv.innerHTML = "";
        mapContainerDiv.classList.remove('universe-message');
        debugInfoSmall.innerHTML = "";
    }

    async function findMatchingCity() {
        clearPreviousResults();
        console.log("--- Start finding matching city ---");

        if (!currentDataIdentifier) {
            alert("Please set your display name first.");
            return;
        }
        if (!auth.currentUser) {
            alert("Firebase session not ready, please wait or refresh the page.");
            return;
        }
        if (citiesData.length === 0) {
            resultTextDiv.innerHTML = "Error: City data not loaded or empty.";
            return;
        }

        const userLocalDate = new Date(); // User's local time Date object

        // Generate the correct local date string (YYYY-MM-DD) here
        const year = userLocalDate.getFullYear();
        const month = (userLocalDate.getMonth() + 1).toString().padStart(2, '0');
        const day = userLocalDate.getDate().toString().padStart(2, '0');
        const localDateStringForRecord = `${year}-${month}-${day}`; // Corrected template literal

        const userLocalHours = userLocalDate.getHours();
        const userLocalMinutes = userLocalDate.getMinutes();
        const userTimezoneOffsetMinutes = userLocalDate.getTimezoneOffset();
        const userUTCOffsetHours = -userTimezoneOffsetMinutes / 60;

        let adjustedUserLocalHours = userLocalHours;
        let adjustedUserLocalMinutes = Math.round(userLocalMinutes / 15) * 15;

        if (adjustedUserLocalMinutes === 60) {
            adjustedUserLocalMinutes = 0;
            adjustedUserLocalHours = (adjustedUserLocalHours + 1) % 24;
        }
        const userLocalHoursDecimalForTarget = adjustedUserLocalHours + adjustedUserLocalMinutes / 60;
        const targetUTCOffsetHours = 8 - userLocalHoursDecimalForTarget + userUTCOffsetHours;
        const targetLatitude = 90 - (userLocalMinutes / 59) * 180;

        const userTimeFormatted = userLocalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); // Changed to en-US

        console.log(`User actual time: ${userTimeFormatted} (UTC${userUTCOffsetHours >= 0 ? '+' : ''}${userUTCOffsetHours.toFixed(2)})`);
        console.log(`User local date string (for record): ${localDateStringForRecord}`);
        console.log(`Adjusted user time for calculating target offset: ${adjustedUserLocalHours}:${adjustedUserLocalMinutes < 10 ? '0' : ''}${adjustedUserLocalMinutes}`);
        console.log(`Finding target UTC offset (targetUTCOffsetHours): ${targetUTCOffsetHours.toFixed(2)} (i.e., UTC ${targetUTCOffsetHours >= 0 ? '+' : ''}${targetUTCOffsetHours.toFixed(2)})`);
        console.log(`Target matching range (UTC): ${(targetUTCOffsetHours - 0.5).toFixed(2)} to ${(targetUTCOffsetHours + 0.5).toFixed(2)}`);
        console.log(`Target latitude (targetLatitude): ${targetLatitude.toFixed(2)}`);


        let candidateCities = [];
        for (const city of citiesData) {
            if (!city || !city.timezone ||
                typeof city.latitude !== 'number' || !isFinite(city.latitude) ||
                typeof city.longitude !== 'number' || !isFinite(city.longitude) ||
                !city.country_iso_code) {
                continue;
            }
            let cityUTCOffset;
            if (timezoneOffsetCache.has(city.timezone)) {
                cityUTCOffset = timezoneOffsetCache.get(city.timezone);
            } else {
                cityUTCOffset = getCityUTCOffsetHours(city.timezone);
                if (isFinite(cityUTCOffset)) {
                    timezoneOffsetCache.set(city.timezone, cityUTCOffset);
                }
            }
            if (!isFinite(cityUTCOffset)) continue;

            if (Math.abs(cityUTCOffset - targetUTCOffsetHours) <= 0.5) {
                candidateCities.push(city);
            }
        }


        if (candidateCities.length === 0) {
            resultTextDiv.innerHTML = `Today, you started this day at <strong>${userTimeFormatted}</strong> local time,<br>But unfortunately, you have left Earth and started a new day with non-Earth beings.`;

            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }
            mapContainerDiv.innerHTML = '';
            mapContainerDiv.classList.add('universe-message');
            mapContainerDiv.innerHTML = "<p>Vast universe, unable to locate...</p>";

            countryFlagImg.style.display = 'none';
            debugInfoSmall.innerHTML = `(Attempted target UTC offset: ${targetUTCOffsetHours.toFixed(2)})`;

            const universeRecord = {
                dataIdentifier: currentDataIdentifier,
                userDisplayName: rawUserDisplayName,
                recordedAt: serverTimestamp(),
                localTime: userTimeFormatted,
                city: "Unknown Planet",
                country: "Universe",
                city_zh: "Unknown Planet", // Translated for English version consistency
                country_zh: "Universe",   // Translated for English version consistency
                country_iso_code: "universe_code",
                latitude: null,
                longitude: null,
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: null,
                recordedDateString: localDateStringForRecord
            };
            await saveHistoryRecord(universeRecord);
            await saveToGlobalDailyRecord(universeRecord);
            console.log("--- End finding matching city (universe case) ---");
            return;
        }

        let bestMatchCity = null;
        let minLatDiff = Infinity;
        for (const city of candidateCities) {
            const latDiff = Math.abs(city.latitude - targetLatitude);
            if (latDiff < minLatDiff) {
                minLatDiff = latDiff;
                bestMatchCity = city;
            }
        }

        if (bestMatchCity) {
            const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);
            const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city; // This logic might need review if _zh fields also become English. For now, assumes city_zh may still hold other lang.
            const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country; // Same as above.

            resultTextDiv.innerHTML = `Today, you<br>started a new day together with people from<br><strong>${finalCityName} (${finalCountryName})</strong>!`;

            if (bestMatchCity.country_iso_code) {
                countryFlagImg.src = `https://flagcdn.com/w40/${bestMatchCity.country_iso_code.toLowerCase()}.png`;
                countryFlagImg.alt = `${finalCountryName} Flag`;
                countryFlagImg.style.display = 'inline-block';
            }

            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }
            mapContainerDiv.innerHTML = '';
            mapContainerDiv.classList.remove('universe-message');

            if (typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) &&
                typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude)) {

                clockLeafletMap = L.map(mapContainerDiv).setView([bestMatchCity.latitude, bestMatchCity.longitude], 7);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd', maxZoom: 19
                }).addTo(clockLeafletMap);
                L.circleMarker([bestMatchCity.latitude, bestMatchCity.longitude], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.8, radius: 8
                }).addTo(clockLeafletMap).bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();
            } else {
                mapContainerDiv.innerHTML = "<p>Cannot display map, city coordinate information is incomplete or invalid.</p>";
            }

            const debugLat = typeof bestMatchCity.latitude === 'number' && isFinite(bestMatchCity.latitude) ? bestMatchCity.latitude.toFixed(2) : 'N/A';
            const debugLon = typeof bestMatchCity.longitude === 'number' && isFinite(bestMatchCity.longitude) ? bestMatchCity.longitude.toFixed(2) : 'N/A';
            const debugTargetLat = typeof targetLatitude === 'number' && isFinite(targetLatitude) ? targetLatitude.toFixed(2) : 'N/A';
            const debugMinLatDiff = typeof minLatDiff === 'number' && isFinite(minLatDiff) ? minLatDiff.toFixed(2) : 'N/A';
            const debugTargetOffset = typeof targetUTCOffsetHours === 'number' && isFinite(targetUTCOffsetHours) ? targetUTCOffsetHours.toFixed(2) : 'N/A';
            const debugActualOffset = !isFinite(cityActualUTCOffset) ? 'N/A' : cityActualUTCOffset.toFixed(2);

            debugInfoSmall.innerHTML = `(Target city latitude: ${debugLat}°, Calculated target latitude: ${debugTargetLat}°, Latitude diff: ${debugMinLatDiff}°)<br>(Target UTC offset: ${debugTargetOffset}, City actual UTC offset: ${debugActualOffset}, Timezone: ${bestMatchCity.timezone || 'Unknown'})`;

            const recordData = {
                dataIdentifier: currentDataIdentifier,
                userDisplayName: rawUserDisplayName,
                recordedAt: serverTimestamp(),
                localTime: userTimeFormatted,
                city: bestMatchCity.city,
                country: bestMatchCity.country,
                city_zh: bestMatchCity.city_zh || "", // Keeping _zh fields, values would be Chinese if present in cities_data.json
                country_zh: bestMatchCity.country_zh || "", // Same as above
                country_iso_code: bestMatchCity.country_iso_code.toLowerCase(),
                latitude: bestMatchCity.latitude,
                longitude: bestMatchCity.longitude,
                targetUTCOffset: targetUTCOffsetHours,
                matchedCityUTCOffset: !isFinite(cityActualUTCOffset) ? null : cityActualUTCOffset,
                recordedDateString: localDateStringForRecord
            };
            await saveHistoryRecord(recordData);
            await saveToGlobalDailyRecord(recordData);
            console.log("--- End finding matching city (city found) ---");
        }
    }

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) {
            console.warn("Cannot save history: user name not set.");
            return;
        }
        if (recordData.city !== "Unknown Planet" && // Assuming English key
            (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) ||
                typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude))) {
            console.error("Cannot save Earth history record: invalid latitude/longitude.", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("Personal history record saved, document ID:", docRef.id);
        } catch (e) {
            console.error("Failed to save personal history record to Firestore:", e);
        }
    }

    async function saveToGlobalDailyRecord(recordData) {
        if (!auth.currentUser) {
            console.warn("Cannot save global record: Firebase session not ready.");
            return;
        }
        const globalRecord = {
            dataIdentifier: recordData.dataIdentifier,
            userDisplayName: recordData.userDisplayName,
            recordedAt: recordData.recordedAt,
            recordedDateString: recordData.recordedDateString,
            city: recordData.city,
            country: recordData.country,
            city_zh: recordData.city_zh, // Passing through _zh fields
            country_zh: recordData.country_zh, // Passing through _zh fields
            country_iso_code: recordData.country_iso_code,
            latitude: recordData.latitude,
            longitude: recordData.longitude,
        };
        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        try {
            const docRef = await addDoc(globalCollectionRef, globalRecord);
            console.log("Global daily record saved, document ID:", docRef.id);
        } catch (e) {
            console.error("Failed to save global daily record to Firestore:", e);
        }
    }

    async function loadHistory() {
        if (!currentDataIdentifier) {
            historyListUl.innerHTML = '<li>Please set your display name first to view history.</li>';
            if (historyLeafletMap) {
                historyLeafletMap.remove();
                historyLeafletMap = null;
            }
            historyMapContainerDiv.innerHTML = '<p>After setting a name, your personal history map will be displayed here.</p>';
            return;
        }
        historyListUl.innerHTML = '<li>Loading history...</li>';
        if (!historyLeafletMap) {
            historyMapContainerDiv.innerHTML = '<p>Loading personal history map...</p>';
        } else if (historyMarkerLayerGroup) {
            historyMarkerLayerGroup.clearLayers();
        }
        historyDebugInfoSmall.textContent = "";

        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        const q = query(historyCollectionRef, orderBy("recordedAt", "desc"));

        try {
            const querySnapshot = await getDocs(q);
            historyListUl.innerHTML = '';
            const historyPoints = [];

            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>No history yet.</li>';
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName}'s History Trail`, 'history');
                return;
            }

            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const li = document.createElement('li');
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date unknown'; // Changed to en-US

                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                li.innerHTML = `<span class="date">${recordDate}</span> - 
                                Local time: <span class="time">${record.localTime || 'Unknown'}</span> - 
                                Synchronized at: <span class="location">${cityDisplay || 'Unknown city'}, ${countryDisplay || 'Unknown country'}</span>`;
                historyListUl.appendChild(li);

                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}`
                    });
                } else if (record.city !== "Unknown Planet") { // Assuming English key
                    console.warn("Skipping point with invalid lat/lon in personal history:", record);
                }
            });
            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName}'s History Trail`, 'history');
        } catch (e) {
            console.error("Failed to read history:", e);
            historyListUl.innerHTML = '<li>Failed to read history.</li>';
            historyMapContainerDiv.innerHTML = '<p>An error occurred while reading history.</p>';
            historyDebugInfoSmall.textContent = `Error: ${e.message}`;
        }
    }

    async function loadGlobalTodayMap() {
        if (!auth.currentUser) {
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Firebase authenticating, please wait...</p>';
            return;
        }

        const selectedDateValue = globalDateInput.value;
        if (!selectedDateValue) {
            if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Please select a date first.</p>';
            return;
        }

        if (!globalLeafletMap) globalTodayMapContainerDiv.innerHTML = '<p>Loading global map for selected date...</p>'; // Adjusted message
        else if (globalMarkerLayerGroup) globalMarkerLayerGroup.clearLayers();

        globalTodayDebugInfoSmall.textContent = `Query date: ${selectedDateValue}`;
        console.log(`[loadGlobalTodayMap] Query date: ${selectedDateValue}`);

        const globalCollectionRef = collection(db, `artifacts/${appId}/publicData/allSharedEntries/dailyRecords`);
        const q = query(globalCollectionRef, where("recordedDateString", "==", selectedDateValue));

        try {
            const querySnapshot = await getDocs(q);
            console.log(`[loadGlobalTodayMap] Firestore query completed. Found ${querySnapshot.size} records.`);
            const globalPoints = [];

            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const record = doc.data();
                    if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                        typeof record.longitude === 'number' && isFinite(record.longitude)) {

                        const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                        const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;
                        const userDisplay = record.userDisplayName || record.dataIdentifier || "Anonymous";

                        globalPoints.push({
                            lat: record.latitude,
                            lon: record.longitude,
                            title: `${userDisplay} @ ${cityDisplay}, ${countryDisplay}`
                        });
                    } else {
                        console.warn("Skipping point with invalid lat/lon in global records (or universe record):", record);
                    }
                });
            }
            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, `Global Awakening Map for ${selectedDateValue}`, 'global');

        } catch (e) {
            console.error("Failed to read global daily records:", e);
            globalTodayMapContainerDiv.innerHTML = '<p>Failed to load global map data.</p>';
            globalTodayDebugInfoSmall.textContent = `Error: ${e.message}`;
        }
    }

    function renderPointsOnMap(points, mapDivElement, debugDivElement, mapTitle = "Map", mapType = 'global') { // Default mapTitle to "Map"
        console.log(`[renderPointsOnMap] Preparing to render map: "${mapTitle}", Number of points: ${points ? points.length : 0}, Map type: ${mapType}`);

        let currentMapInstance;
        let currentMarkerLayerGroup;

        if (mapType === 'global') {
            currentMapInstance = globalLeafletMap;
            currentMarkerLayerGroup = globalMarkerLayerGroup;
        } else if (mapType === 'history') {
            currentMapInstance = historyLeafletMap;
            currentMarkerLayerGroup = historyMarkerLayerGroup;
        } else {
            console.error("Unknown map type:", mapType);
            return;
        }

        if (!currentMapInstance) {
            console.log(`[renderPointsOnMap] Initializing new Leaflet map instance on ${mapDivElement.id}`);
            mapDivElement.innerHTML = ''; // Clearing "Loading" or "No data" message
            currentMapInstance = L.map(mapDivElement).setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd', maxZoom: 18, minZoom: 2
            }).addTo(currentMapInstance);
            currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);

            if (mapType === 'global') {
                globalLeafletMap = currentMapInstance;
                globalMarkerLayerGroup = currentMarkerLayerGroup;
            } else if (mapType === 'history') {
                historyLeafletMap = currentMapInstance;
                historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
        } else {
            console.log(`[renderPointsOnMap] Clearing old markers on ${mapDivElement.id}.`);
            if (currentMarkerLayerGroup) {
                currentMarkerLayerGroup.clearLayers();
            } else {
                currentMarkerLayerGroup = L.layerGroup().addTo(currentMapInstance);
                if (mapType === 'global') globalMarkerLayerGroup = currentMarkerLayerGroup;
                else if (mapType === 'history') historyMarkerLayerGroup = currentMarkerLayerGroup;
            }
            if (currentMapInstance.getContainer().innerHTML.includes("<p>")) { // Simple check if container is occupied by text
                mapDivElement.innerHTML = ''; // Clear text
                mapDivElement.appendChild(currentMapInstance.getContainer()); // Re-attach map DOM
            }
            currentMapInstance.invalidateSize();
        }

        if (!points || points.length === 0) {
            if (currentMarkerLayerGroup) currentMarkerLayerGroup.clearLayers();
            console.log("[renderPointsOnMap] No points to render, displaying hint."); // Adjusted message
            if (debugDivElement) debugDivElement.textContent = `${mapTitle}: No valid coordinate points to display.`;
            else console.warn("Debug element not provided for no-points message.");
            return;
        }

        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        let validPointsForBboxCount = 0;

        points.forEach(point => {
            if (typeof point.lat === 'number' && isFinite(point.lat) && typeof point.lon === 'number' && isFinite(point.lon)) {
                const marker = L.circleMarker([point.lat, point.lon], {
                    color: 'red', fillColor: '#f03', fillOpacity: 0.7, radius: 6
                }).addTo(currentMarkerLayerGroup);
                if (point.title) {
                    marker.bindTooltip(point.title);
                }
                minLat = Math.min(minLat, point.lat);
                maxLat = Math.max(maxLat, point.lat);
                minLon = Math.min(minLon, point.lon);
                maxLon = Math.max(maxLon, point.lon);
                validPointsForBboxCount++;
            }
        });

        if (validPointsForBboxCount > 0) {
            const latDiff = maxLat - minLat;
            const lonDiff = maxLon - minLon;
            const defaultMargin = 1.0;
            const latMargin = latDiff < 0.1 ? defaultMargin : latDiff * 0.2 + 0.1;
            const lonMargin = lonDiff < 0.1 ? defaultMargin : lonDiff * 0.2 + 0.1;

            let south = Math.max(-85, minLat - latMargin);
            let west = Math.max(-180, minLon - lonMargin);
            let north = Math.min(85, maxLat + latMargin);
            let east = Math.min(180, maxLon + lonMargin);

            if (west >= east) {
                const centerLon = validPointsForBboxCount === 1 ? minLon : (minLon + maxLon) / 2;
                west = centerLon - defaultMargin / 2;
                east = centerLon + defaultMargin / 2;
            }
            if (south >= north) {
                const centerLat = validPointsForBboxCount === 1 ? minLat : (minLat + maxLat) / 2;
                south = centerLat - defaultMargin / 2;
                north = centerLat + defaultMargin / 2;
            }
            west = Math.max(-180, Math.min(west, 179.9999));
            east = Math.min(180, Math.max(east, west + 0.0001));
            south = Math.max(-85, Math.min(south, 84.9999));
            north = Math.min(85, Math.max(north, south + 0.0001));

            console.log(`[renderPointsOnMap] (${mapTitle}) Calculated BBOX:`, `${west},${south},${east},${north}`);
            currentMapInstance.fitBounds([[south, west], [north, east]], { padding: [20, 20] });
        } else if (currentMapInstance) {
            currentMapInstance.setView([20, 0], 2);
        }

        if (debugDivElement) debugDivElement.textContent = `${mapTitle} - Displaying ${validPointsForBboxCount} valid locations.`;
    }

    window.openTab = function (evt, tabName, triggeredBySetName = false) {
        console.log(`[openTab] Switching to tab: ${tabName}, Event triggered: ${!!evt}, Triggered by set name: ${triggeredBySetName}`);
        let i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-button");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove("active");
        }
        const currentTabDiv = document.getElementById(tabName);
        if (currentTabDiv) {
            currentTabDiv.style.display = "block";
            console.log(`[openTab] ${tabName} set to display: block`);
        } else {
            console.warn(`[openTab] Tab content element with ID ${tabName} not found.`);
        }

        const targetButtonId = `tabButton-${tabName}`;
        const targetButton = document.getElementById(targetButtonId);
        if (targetButton) {
            targetButton.classList.add("active");
        } else if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add("active");
        }

        setTimeout(() => {
            if (tabName === 'HistoryTab') {
                if (historyLeafletMap && historyMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] HistoryTab is visible, invalidating map size.");
                    historyLeafletMap.invalidateSize();
                }
                if (currentDataIdentifier && auth.currentUser && !triggeredBySetName) {
                    console.log("[openTab] Calling loadHistory for HistoryTab.");
                    loadHistory();
                }
            } else if (tabName === 'GlobalTodayMapTab') {
                if (globalLeafletMap && globalTodayMapContainerDiv.offsetParent !== null) {
                    console.log("[openTab] GlobalTodayMapTab is visible, invalidating map size.");
                    globalLeafletMap.invalidateSize();
                }
                if (auth.currentUser && !triggeredBySetName) {
                    if (globalDateInput) { // Ensure date input exists
                        const today = new Date(); // Current local time
                        console.log("[openTab] GlobalTodayMapTab: `new Date()` is:", today.toString());

                        // New method: directly set .value to the local date's YYYY-MM-DD string
                        const year = today.getFullYear();
                        const month = (today.getMonth() + 1).toString().padStart(2, '0');
                        const day = today.getDate().toString().padStart(2, '0');
                        const localTodayDateString = `${year}-${month}-${day}`; // Corrected template literal
                        
                        globalDateInput.value = localTodayDateString; // Directly set YYYY-MM-DD string
                        console.log("[openTab] GlobalTodayMapTab: Forcing reset of globalDateInput.value to:", globalDateInput.value);
                    }
                    console.log("[openTab] Calling loadGlobalTodayMap for GlobalTodayMapTab.");
                    loadGlobalTodayMap();
                }
            }
        }, 0);
    }
});
