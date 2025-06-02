document.addEventListener('DOMContentLoaded', async () => {
    // Get Firebase SDK functions from window
    const { 
        initializeApp, 
        getAuth, 
        signInAnonymously, 
        onAuthStateChanged,
        signInWithCustomToken,
        getFirestore, 
        collection, 
        addDoc, 
        query, 
        where, 
        getDocs, 
        orderBy, 
        serverTimestamp,
        doc,
        setDoc,
        getDoc,
        limit,
        setLogLevel
    } = window.firebaseSDK;

    // Initialize Firebase
    const app = initializeApp(window.firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Set Firebase log level
    setLogLevel('error');

    // DOM Elements
    const userNameInput = document.getElementById('userName');
    const groupNameInput = document.getElementById('groupName');
    const setUserNameButton = document.getElementById('setUserNameButton');
    const currentUserIdSpan = document.getElementById('currentUserId');
    const currentUserDisplayNameSpan = document.getElementById('currentUserDisplayName');
    const currentGroupNameSpan = document.getElementById('currentGroupName');
    const findCityButton = document.getElementById('findCityButton');
    const resultTextDiv = document.getElementById('resultText');
    const countryFlagImg = document.getElementById('countryFlag');
    const mapContainerDiv = document.getElementById('mapContainer');
    const debugInfoSmall = document.getElementById('debugInfo');
    const historyListUl = document.getElementById('historyList');
    const historyMapContainerDiv = document.getElementById('historyMapContainer');
    const historyDebugInfoSmall = document.getElementById('historyDebugInfo');
    const refreshHistoryButton = document.getElementById('refreshHistoryButton');
    const globalDateInput = document.getElementById('globalDate');
    const groupFilterSelect = document.getElementById('groupFilter');
    const refreshGlobalMapButton = document.getElementById('refreshGlobalMapButton');
    const globalTodayMapContainerDiv = document.getElementById('globalTodayMapContainer');
    const globalTodayDebugInfoSmall = document.getElementById('globalTodayDebugInfo');

    // Global variables
    let currentDataIdentifier = null;
    let rawUserDisplayName = null;
    let currentGroupName = null;
    let clockLeafletMap = null;
    let historyLeafletMap = null;
    let globalTodayLeafletMap = null;
    let historyMarkerLayerGroup = null;
    let globalTodayMarkerLayerGroup = null;
    const appId = 'clock';

    // Tab switching function
    window.openTab = function(evt, tabName) {
        const tabContents = document.getElementsByClassName("tab-content");
        for (let i = 0; i < tabContents.length; i++) {
            tabContents[i].classList.remove("active");
        }

        const tabButtons = document.getElementsByClassName("tab-button");
        for (let i = 0; i < tabButtons.length; i++) {
            tabButtons[i].classList.remove("active");
        }

        document.getElementById(tabName).classList.add("active");
        evt.currentTarget.classList.add("active");

        // Special handling for map tabs
        if (tabName === 'HistoryTab') {
            if (historyLeafletMap) {
                setTimeout(() => {
                    historyLeafletMap.invalidateSize();
                }, 100);
            }
        } else if (tabName === 'GlobalTodayMapTab') {
            if (globalTodayLeafletMap) {
                setTimeout(() => {
                    globalTodayLeafletMap.invalidateSize();
                }, 100);
            }
        }
    };

    // Authentication state change handler
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User authenticated:", user.uid);
            currentDataIdentifier = user.uid;
            currentUserIdSpan.textContent = user.uid;
            currentUserIdSpan.style.display = 'inline';
            
            // Load user profile
            const userProfileRef = doc(db, `artifacts/${appId}/userProfiles/${user.uid}`);
            const userProfileDoc = await getDoc(userProfileRef);
            
            if (userProfileDoc.exists()) {
                const userData = userProfileDoc.data();
                if (userData.displayName) {
                    rawUserDisplayName = userData.displayName;
                    currentUserDisplayNameSpan.textContent = rawUserDisplayName;
                    currentUserDisplayNameSpan.style.display = 'inline';
                    userNameInput.value = rawUserDisplayName;
                    findCityButton.disabled = false;
                }
                if (userData.groupName) {
                    currentGroupName = userData.groupName;
                    currentGroupNameSpan.textContent = `Group: ${currentGroupName}`;
                    currentGroupNameSpan.style.display = 'inline';
                    groupNameInput.value = currentGroupName;
                }
            }
            
            // Load history and display last record
            await loadHistory();
            await displayLastRecordForCurrentUser();
        } else {
            console.log("No user authenticated");
            currentDataIdentifier = null;
            currentUserIdSpan.textContent = "Not Set";
            currentUserDisplayNameSpan.style.display = 'none';
            currentGroupNameSpan.style.display = 'none';
            findCityButton.disabled = true;
        }
    });

    // Set/Update user name
    setUserNameButton.addEventListener('click', async () => {
        const displayName = userNameInput.value.trim();
        const groupName = groupNameInput.value.trim();
        
        if (!displayName) {
            alert("Please enter a display name");
            return;
        }

        if (!currentDataIdentifier) {
            alert("Please wait for authentication to complete");
            return;
        }

        try {
            const userProfileRef = doc(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}`);
            await setDoc(userProfileRef, {
                displayName: displayName,
                groupName: groupName,
                updatedAt: serverTimestamp()
            }, { merge: true });

            rawUserDisplayName = displayName;
            currentGroupName = groupName;
            currentUserDisplayNameSpan.textContent = displayName;
            currentUserDisplayNameSpan.style.display = 'inline';
            currentGroupNameSpan.textContent = groupName ? `Group: ${groupName}` : '';
            currentGroupNameSpan.style.display = groupName ? 'inline' : 'none';
            findCityButton.disabled = false;

            // Refresh history and last record
            await loadHistory();
            await displayLastRecordForCurrentUser();
        } catch (error) {
            console.error("Error updating user profile:", error);
            alert("Failed to update profile. Please try again.");
        }
    });

    // Find matching city function
    async function findMatchingCity() {
        clearPreviousResults();
        findCityButton.disabled = true;
        debugInfoSmall.textContent = "Searching for your wake-up location...";

        const userLocalDate = new Date();
        const userLocalHours = userLocalDate.getHours();
        const userLocalMinutes = userLocalDate.getMinutes();
        const userLocalTime = userLocalHours + userLocalMinutes / 60;
        const targetUTCOffsetHours = -userLocalDate.getTimezoneOffset() / 60;

        debugInfoSmall.textContent = `Your local time: ${userLocalTime.toFixed(2)} (UTC${targetUTCOffsetHours >= 0 ? '+' : ''}${targetUTCOffsetHours.toFixed(1)})`;

        const candidateCities = [];
        const cities = await fetchCitiesData();

        for (const city of cities) {
            const cityLocalTime = getCityLocalTime(city.timezone, userLocalDate);
            const timeDiff = Math.abs(cityLocalTime - userLocalTime);
            const adjustedTimeDiff = timeDiff > 12 ? 24 - timeDiff : timeDiff;

            if (adjustedTimeDiff <= 0.67) { // 0.67 hours = 40 minutes
                candidateCities.push({
                    ...city,
                    timeDiff: adjustedTimeDiff,
                    localTime: cityLocalTime
                });
                console.log(`Found candidate city: ${city.city}, Local time: ${cityLocalTime.toFixed(2)}, Time difference: ${adjustedTimeDiff.toFixed(2)}`);
            }
        }

        candidateCities.sort((a, b) => a.timeDiff - b.timeDiff);

        if (candidateCities.length === 0) {
            const apiResponse = await fetchStoryFromAPI("Unknown Planet", "Universe", "UNIVERSE_CODE");
            const greetingFromAPI = apiResponse.greeting;
            const storyFromAPI = apiResponse.story;

            resultTextDiv.innerHTML = `
                <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
                <p>Today, you started your day at <strong>${userLocalDate.toLocaleTimeString()}</strong> local time,<br>but unfortunately, you have left Earth and started a new day with non-Earth beings.</p>
                <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
            `;

            if (clockLeafletMap) {
                clockLeafletMap.remove();
                clockLeafletMap = null;
            }
            mapContainerDiv.innerHTML = '';
            mapContainerDiv.classList.add('universe-message');
            mapContainerDiv.innerHTML = "<p>Vast universe, unable to locate...</p>";
            countryFlagImg.style.display = 'none';

            const breakfastContainer = document.createElement('div');
            breakfastContainer.id = 'breakfastImageContainer';
            breakfastContainer.style.marginTop = '20px';
            breakfastContainer.style.textAlign = 'center';
            resultTextDiv.appendChild(breakfastContainer);

            try {
                const imageData = await generateBreakfastImage("Unknown Planet", "Universe", "cosmic");
                if (imageData.imageUrl) {
                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${imageData.imageUrl}" alt="Cosmic Breakfast" style="max-width: 100%; border-radius: 8px;">
                            <p style="font-size: 0.9em; color: #555;"><em>Today's Cosmic Breakfast</em></p>
                        </div>
                    `;

                    const universeRecord = {
                        dataIdentifier: currentDataIdentifier,
                        userDisplayName: rawUserDisplayName,
                        recordedAt: serverTimestamp(),
                        localTime: userLocalDate.toLocaleTimeString(),
                        city: "Unknown Planet",
                        country: "Universe",
                        city_zh: "未知星球",
                        country_zh: "宇宙",
                        country_iso_code: "universe_code",
                        latitude: null,
                        longitude: null,
                        targetUTCOffset: targetUTCOffsetHours,
                        matchedCityUTCOffset: null,
                        recordedDateString: userLocalDate.toISOString().split('T')[0],
                        greeting: greetingFromAPI,
                        story: storyFromAPI,
                        imageUrl: imageData.imageUrl,
                        timezone: "Cosmic/Unknown",
                        isUniverseTheme: true
                    };
                    await saveHistoryRecord(universeRecord);
                    await saveToGlobalDailyRecord(universeRecord);
                }
            } catch (error) {
                console.error("Failed to generate breakfast image:", error);
                breakfastContainer.innerHTML = `<p style="color: red;">Sorry, an error occurred while generating the cosmic breakfast image: ${error.message}</p>`;
            }

            console.log("--- End of city matching (Universe case) ---");
            findCityButton.disabled = false;
            return;
        }

        const bestMatchCity = candidateCities[0];
        const cityActualUTCOffset = getCityUTCOffsetHours(bestMatchCity.timezone);
        const finalCityName = bestMatchCity.city_zh && bestMatchCity.city_zh !== bestMatchCity.city ? `${bestMatchCity.city_zh} (${bestMatchCity.city})` : bestMatchCity.city;
        const finalCountryName = bestMatchCity.country_zh && bestMatchCity.country_zh !== bestMatchCity.country ? `${bestMatchCity.country_zh} (${bestMatchCity.country})` : bestMatchCity.country;

        const apiResponse = await fetchStoryFromAPI(finalCityName, finalCountryName, bestMatchCity.country_iso_code);
        const greetingFromAPI = apiResponse.greeting;
        const storyFromAPI = apiResponse.story;

        resultTextDiv.innerHTML = `
            <p style="font-weight: bold; font-size: 1.1em;">${greetingFromAPI}</p>
            <p>Today you are a citizen of <strong>${finalCityName} (${finalCountryName})</strong>!</p>
            <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyFromAPI}</p>
        `;

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

        clockLeafletMap = L.map(mapContainerDiv).setView([bestMatchCity.latitude, bestMatchCity.longitude], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(clockLeafletMap);

        const marker = L.marker([bestMatchCity.latitude, bestMatchCity.longitude]).addTo(clockLeafletMap);
        marker.bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();

        const breakfastContainer = document.createElement('div');
        breakfastContainer.id = 'breakfastImageContainer';
        breakfastContainer.style.marginTop = '20px';
        breakfastContainer.style.textAlign = 'center';
        resultTextDiv.appendChild(breakfastContainer);

        try {
            const imageData = await generateBreakfastImage(finalCityName, finalCountryName, bestMatchCity.country_iso_code);
            if (imageData.imageUrl) {
                breakfastContainer.innerHTML = `
                    <div class="postcard-image-container">
                        <img src="${imageData.imageUrl}" alt="Breakfast in ${finalCityName}" style="max-width: 100%; border-radius: 8px;">
                        <p style="font-size: 0.9em; color: #555;"><em>Today's Breakfast in ${finalCityName}</em></p>
                    </div>
                `;

                const record = {
                    dataIdentifier: currentDataIdentifier,
                    userDisplayName: rawUserDisplayName,
                    recordedAt: serverTimestamp(),
                    localTime: userLocalDate.toLocaleTimeString(),
                    city: bestMatchCity.city,
                    country: bestMatchCity.country,
                    city_zh: bestMatchCity.city_zh,
                    country_zh: bestMatchCity.country_zh,
                    country_iso_code: bestMatchCity.country_iso_code,
                    latitude: bestMatchCity.latitude,
                    longitude: bestMatchCity.longitude,
                    targetUTCOffset: targetUTCOffsetHours,
                    matchedCityUTCOffset: cityActualUTCOffset,
                    recordedDateString: userLocalDate.toISOString().split('T')[0],
                    greeting: greetingFromAPI,
                    story: storyFromAPI,
                    imageUrl: imageData.imageUrl,
                    timezone: bestMatchCity.timezone
                };
                await saveHistoryRecord(record);
                await saveToGlobalDailyRecord(record);
            }
        } catch (error) {
            console.error("Failed to generate breakfast image:", error);
            breakfastContainer.innerHTML = `<p style="color: red;">Sorry, an error occurred while generating the breakfast image: ${error.message}</p>`;
        }

        console.log("--- End of city matching (Found city) ---");
        findCityButton.disabled = false;
    }

    // Event listeners
    findCityButton.addEventListener('click', findMatchingCity);
    refreshHistoryButton.addEventListener('click', loadHistory);
    refreshGlobalMapButton.addEventListener('click', loadGlobalTodayMap);

    // Initialize date input with today's date
    if (globalDateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const localTodayDateString = `${year}-${month}-${day}`;
        globalDateInput.value = localTodayDateString;
        console.log("Page initial load, globalDateInput.value set to:", globalDateInput.value);
    }

    // Helper functions
    function clearPreviousResults() {
        resultTextDiv.innerHTML = '';
        countryFlagImg.style.display = 'none';
        if (clockLeafletMap) {
            clockLeafletMap.remove();
            clockLeafletMap = null;
        }
        mapContainerDiv.innerHTML = '';
        mapContainerDiv.classList.remove('universe-message');
    }

    async function fetchCitiesData() {
        try {
            const response = await fetch('/api/cities');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching cities data:', error);
            return [];
        }
    }

    function getCityLocalTime(timezone, date) {
        const cityDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        return cityDate.getHours() + cityDate.getMinutes() / 60;
    }

    function getCityUTCOffsetHours(timezone) {
        const date = new Date();
        const cityDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        return (cityDate.getTime() - date.getTime()) / (1000 * 60 * 60);
    }

    async function fetchStoryFromAPI(city, country, countryCode) {
        console.log(`[fetchStoryFromAPI] Calling backend /api/generateStory02 for City: ${city}, Country: ${country}, Country Code: ${countryCode}`);

        try {
            const response = await fetch('/api/generateStory02', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    city: city,
                    country: country,
                    language: "English"
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unable to parse API error response" }));
                console.error(`API Error from /api/generateStory02: ${response.status} ${response.statusText}`, errorData);
                return {
                    greeting: `(System Message: Failed to get greeting - ${response.status})`,
                    story: `System Message: Failed to get story about ${city}, ${country}. Please try again later. Error: ${errorData.error || response.statusText}`
                };
            }

            const data = await response.json();
            console.log("[fetchStoryFromAPI] Received data from backend:", data);

            if (data && typeof data.greeting === 'string' && typeof data.trivia === 'string') {
                return {
                    greeting: data.greeting,
                    story: data.trivia
                };
            } else {
                console.warn("[fetchStoryFromAPI] Backend response format unexpected:", data);
                return {
                    greeting: "(System Message: Received greeting format error)",
                    story: `Story about ${city}, ${country} is being prepared, please check back later! (Response format issue)`
                };
            }

        } catch (error) {
            console.error("Error calling /api/generateStory02 from frontend:", error);
            return {
                greeting: "(System Message: Network error, unable to get greeting)",
                story: `Network connection issue while getting story about ${city}, ${country}. Please check your network and try again.`
            };
        }
    }

    async function generateBreakfastImage(city, country, countryCode) {
        try {
            const response = await fetch('/api/generateImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    city: city,
                    country: country,
                    countryCode: countryCode
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error generating breakfast image:', error);
            throw error;
        }
    }

    async function saveHistoryRecord(recordData) {
        if (!currentDataIdentifier) {
            console.warn("Cannot save history record: Username not set.");
            return;
        }
        recordData.greeting = recordData.greeting || "";
        recordData.story = recordData.story || "";
        recordData.imageUrl = recordData.imageUrl || null;
        recordData.groupName = currentGroupName || "";

        if (recordData.city !== "Unknown Planet" && recordData.city_zh !== "未知星球" &&
            (typeof recordData.latitude !== 'number' || !isFinite(recordData.latitude) ||
             typeof recordData.longitude !== 'number' || !isFinite(recordData.longitude))) {
            console.error("Cannot save Earth history record: Invalid coordinates.", recordData);
            return;
        }
        const historyCollectionRef = collection(db, `artifacts/${appId}/userProfiles/${currentDataIdentifier}/clockHistory`);
        try {
            const docRef = await addDoc(historyCollectionRef, recordData);
            console.log("Personal history record saved, document ID:", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Failed to save personal history record to Firestore:", e);
            return null;
        }
    }

    async function saveToGlobalDailyRecord(recordData) {
        if (!recordData.recordedDateString) {
            console.error("Cannot save to global daily record: Missing date string");
            return;
        }

        const globalDailyCollectionRef = collection(db, `artifacts/${appId}/globalDailyRecords/${recordData.recordedDateString}/records`);
        try {
            const docRef = await addDoc(globalDailyCollectionRef, recordData);
            console.log("Global daily record saved, document ID:", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Failed to save global daily record to Firestore:", e);
            return null;
        }
    }

    async function displayLastRecordForCurrentUser() {
        console.log("[displayLastRecordForCurrentUser] Function called. currentDataIdentifier:", currentDataIdentifier);

        if (!currentDataIdentifier) {
            resultTextDiv.innerHTML = '<p>Please set your display name to view your wake-up location.</p>';
            return;
        }

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

                const greetingText = lastRecord.greeting || ""; 
                const storyText = lastRecord.story || "No special story recorded for the last wake-up.";

                let mainMessage = "";
                if (lastRecord.country === "Universe" || (lastRecord.country_zh === "宇宙" && lastRecord.city_zh === "未知星球")) {
                     mainMessage = `${rawUserDisplayName} has left Earth,<br>starting a new day with <strong>${finalCityName} (${finalCountryName})</strong> non-Earth beings!`;
                } else {
                     mainMessage = `${rawUserDisplayName} woke up in <strong>${finalCityName} (${finalCountryName})</strong>.`;
                }
                resultTextDiv.innerHTML = `
                    <p style="font-weight: bold; font-size: 1.1em;">${greetingText}</p>
                    <p>${mainMessage}</p>
                    <p style="font-style: italic; margin-top: 10px; font-size: 0.9em; color: #555;">${storyText}</p>
                `;

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

                if (lastRecord.latitude && lastRecord.longitude) {
                    clockLeafletMap = L.map(mapContainerDiv).setView([lastRecord.latitude, lastRecord.longitude], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(clockLeafletMap);

                    const marker = L.marker([lastRecord.latitude, lastRecord.longitude]).addTo(clockLeafletMap);
                    marker.bindPopup(`<b>${finalCityName}</b><br>${finalCountryName}`).openPopup();
                }

                if (lastRecord.imageUrl) {
                    const breakfastContainer = document.createElement('div');
                    breakfastContainer.id = 'breakfastImageContainer';
                    breakfastContainer.style.marginTop = '20px';
                    breakfastContainer.style.textAlign = 'center';
                    resultTextDiv.appendChild(breakfastContainer);

                    breakfastContainer.innerHTML = `
                        <div class="postcard-image-container">
                            <img src="${lastRecord.imageUrl}" alt="Breakfast in ${finalCityName}" style="max-width: 100%; border-radius: 8px;">
                            <p style="font-size: 0.9em; color: #555;"><em>Breakfast in ${finalCityName}</em></p>
                        </div>
                    `;
                }
            } else {
                resultTextDiv.innerHTML = '<p>No wake-up records yet.</p>';
            }
        } catch (error) {
            console.error("Error displaying last record:", error);
            resultTextDiv.innerHTML = '<p>Error loading last record. Please try again.</p>';
        }
    }

    async function loadHistory() {
        if (!currentDataIdentifier) {
            historyListUl.innerHTML = '<li>Please set your display name to view history records.</li>';
            if (historyLeafletMap) {
                historyLeafletMap.remove();
                historyLeafletMap = null;
            }
            historyMapContainerDiv.innerHTML = '<p>Your personal history map will be displayed here after setting your name.</p>';
            return;
        }

        console.log("[loadHistory] Preparing to load history records, using identifier:", currentDataIdentifier);
        historyListUl.innerHTML = '<li>Loading history records...</li>';
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
            console.log("[loadHistory] Query results:", querySnapshot.size, "records");
            historyListUl.innerHTML = '';
            const historyPoints = [];

            if (querySnapshot.empty) {
                historyListUl.innerHTML = '<li>No history records yet.</li>';
                renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName}'s History Track`, 'history');
                return;
            }

            const markerMap = new Map();
            
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                console.log("[loadHistory] Processing record:", record);
                const docId = doc.id;
                const recordDate = record.recordedAt && record.recordedAt.toDate ? record.recordedAt.toDate().toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown Date';

                const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;

                const li = document.createElement('li');
                li.innerHTML = `<span class="date">${recordDate}</span> -  
                                Woke up in: <span class="location">${cityDisplay || 'Unknown City'}, ${countryDisplay || 'Unknown Country'}</span>`;
                
                const detailsButton = document.createElement('button');
                detailsButton.textContent = 'View Log';
                detailsButton.className = 'history-log-button';

                const handleButtonClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showHistoryLogModal(record);
                };

                detailsButton.addEventListener('click', handleButtonClick);
                detailsButton.addEventListener('touchstart', handleButtonClick, { passive: false });
                detailsButton.addEventListener('touchend', (e) => {
                    e.preventDefault();
                }, { passive: false });

                detailsButton.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                }, { passive: false });

                li.appendChild(detailsButton);

                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    
                    li.classList.add('hoverable-history-item');
                    
                    li.dataset.lat = record.latitude;
                    li.dataset.lon = record.longitude;
                    li.dataset.timestamp = record.recordedAt.toMillis();

                    historyPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${recordDate} @ ${cityDisplay}, ${countryDisplay}`,
                        timestamp: record.recordedAt.toMillis(),
                        listItem: li
                    });
                }

                historyListUl.appendChild(li);
            });

            renderPointsOnMap(historyPoints, historyMapContainerDiv, historyDebugInfoSmall, `${rawUserDisplayName}'s History Track`, 'history');

        } catch (error) {
            console.error("Error loading history:", error);
            historyListUl.innerHTML = '<li>Error loading history records. Please try again.</li>';
        }
    }

    function showHistoryLogModal(record) {
        const modal = document.getElementById('historyLogModal');
        const modalContent = document.getElementById('historyLogModalContent');
        if (!modal || !modalContent) {
            console.error("Modal elements not found");
            return;
        }

        const cityDisplay = formatCityName(record);
        document.getElementById('modalTitle').textContent = `${cityDisplay || 'Unknown Location'} - Wake Up Log`;

        const recordDate = formatDate(record.recordedAt);
        modalContent.innerHTML = `
            <div id="logBasicInfo">
                <p><strong>Record Time:</strong> ${recordDate}</p>
                <p><strong>User Local Time:</strong> ${record.localTime || 'Unknown'}</p>
                <p><strong>Wake Up Location:</strong> ${cityDisplay}, ${formatCountryName(record)}</p>
                <p style="margin-top:15px;"><strong>Greeting:</strong></p>
                <p style="font-weight: bold; font-style: italic; color: #2c3e50;">${record.greeting || 'No greeting for this record.'}</p>
                <p style="margin-top:15px;"><strong>Related Story/Facts:</strong></p>
                <p style="font-style: italic; color: #34495e; white-space: pre-wrap;">${record.story || 'No related story for this record.'}</p>
                ${record.imageUrl ? `
                    <p style="margin-top:15px;"><strong>Today's Breakfast:</strong></p>
                    <div class="postcard-image-container">
                        <img src="${record.imageUrl}" alt="Breakfast in ${cityDisplay}" style="max-width: 100%; border-radius: 8px;">
                        <p style="font-size: 0.9em; color: #555;"><em>Breakfast in ${cityDisplay}</em></p>
                    </div>
                ` : '<p style="color: #999; margin-top: 15px;"><em>No breakfast image for this record.</em></p>'}
                <hr style="margin: 20px 0;">
                <p><small>Timezone: ${record.timezone || 'Unknown'}, Country Code: ${record.country_iso_code || 'N/A'}</small></p>
                <p><small>Coordinates: Lat ${record.latitude?.toFixed(4) || 'N/A'}, Lon ${record.longitude?.toFixed(4) || 'N/A'}</small></p>
            </div>
        `;

        modal.style.display = 'block';
        setupModalClose(modal, modalContent);
    }

    function setupModalClose(modal, modalContent) {
        const closeFunction = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            modal.style.display = 'none';
            modalContent.innerHTML = '';
        };

        const closeButton = document.getElementById('historyLogModalClose');
        const footerButton = document.getElementById('closeModalFooterButton');

        if (closeButton) {
            closeButton.addEventListener('click', closeFunction);
            closeButton.addEventListener('touchstart', closeFunction, { passive: false });
        }
        if (footerButton) {
            footerButton.addEventListener('click', closeFunction);
            footerButton.addEventListener('touchstart', closeFunction, { passive: false });
        }

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeFunction(event);
            }
        });

        window.addEventListener('touchstart', (event) => {
            if (event.target === modal) {
                closeFunction(event);
            }
        }, { passive: false });
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'Unknown Date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatCityName(record) {
        return record.city_zh && record.city_zh !== record.city ? 
               `${record.city_zh} (${record.city})` : record.city;
    }

    function formatCountryName(record) {
        return record.country_zh && record.country_zh !== record.country ? 
               `${record.country_zh} (${record.country})` : record.country;
    }

    function renderPointsOnMap(points, container, debugInfo, title, mapType) {
        if (!points || points.length === 0) {
            container.innerHTML = '<p>No points to display on map.</p>';
            return;
        }

        if (mapType === 'history' && historyLeafletMap) {
            historyLeafletMap.remove();
            historyLeafletMap = null;
        } else if (mapType === 'globalToday' && globalTodayLeafletMap) {
            globalTodayLeafletMap.remove();
            globalTodayLeafletMap = null;
        }

        const map = L.map(container).setView([points[0].lat, points[0].lon], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const markerLayerGroup = L.layerGroup().addTo(map);
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));

        points.forEach((point, index) => {
            const marker = L.marker([point.lat, point.lon]).addTo(markerLayerGroup);
            marker.bindPopup(`<b>${point.title}</b>`);

            if (point.listItem) {
                point.listItem.addEventListener('mouseover', () => {
                    marker.openPopup();
                });
                point.listItem.addEventListener('mouseout', () => {
                    marker.closePopup();
                });
            }
        });

        map.fitBounds(bounds, { padding: [50, 50] });

        if (mapType === 'history') {
            historyLeafletMap = map;
            historyMarkerLayerGroup = markerLayerGroup;
        } else if (mapType === 'globalToday') {
            globalTodayLeafletMap = map;
            globalTodayMarkerLayerGroup = markerLayerGroup;
        }
    }

    async function loadGlobalTodayMap() {
        if (!globalDateInput.value) {
            alert("Please select a date first");
            return;
        }

        globalTodayMapContainerDiv.innerHTML = '<p>Loading global map...</p>';
        if (globalTodayLeafletMap) {
            globalTodayLeafletMap.remove();
            globalTodayLeafletMap = null;
        }
        if (globalTodayMarkerLayerGroup) {
            globalTodayMarkerLayerGroup.clearLayers();
        }
        globalTodayDebugInfoSmall.textContent = "";

        const selectedDate = globalDateInput.value;
        const selectedGroup = groupFilterSelect.value;

        const globalDailyCollectionRef = collection(db, `artifacts/${appId}/globalDailyRecords/${selectedDate}/records`);
        let q = query(globalDailyCollectionRef);

        if (selectedGroup !== 'all') {
            q = query(globalDailyCollectionRef, where("groupName", "==", selectedGroup));
        }

        try {
            const querySnapshot = await getDocs(q);
            console.log("[loadGlobalTodayMap] Query results:", querySnapshot.size, "records");
            const globalPoints = [];

            if (querySnapshot.empty) {
                globalTodayMapContainerDiv.innerHTML = '<p>No records found for the selected date.</p>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const record = doc.data();
                if (typeof record.latitude === 'number' && isFinite(record.latitude) &&
                    typeof record.longitude === 'number' && isFinite(record.longitude)) {
                    
                    const cityDisplay = record.city_zh && record.city_zh !== record.city ? `${record.city_zh} (${record.city})` : record.city;
                    const countryDisplay = record.country_zh && record.country_zh !== record.country ? `${record.country_zh} (${record.country})` : record.country;
                    const recordTime = record.recordedAt && record.recordedAt.toDate ? 
                        record.recordedAt.toDate().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown Time';

                    globalPoints.push({
                        lat: record.latitude,
                        lon: record.longitude,
                        title: `${record.userDisplayName} @ ${cityDisplay}, ${countryDisplay} (${recordTime})`,
                        timestamp: record.recordedAt.toMillis()
                    });
                }
            });

            renderPointsOnMap(globalPoints, globalTodayMapContainerDiv, globalTodayDebugInfoSmall, "Global Today Map", 'globalToday');

        } catch (error) {
            console.error("Error loading global map:", error);
            globalTodayMapContainerDiv.innerHTML = '<p>Error loading global map. Please try again.</p>';
        }
    }
}); 
