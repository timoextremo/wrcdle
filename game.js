document.addEventListener("DOMContentLoaded", () => {

  // Data validator helpers
  function logDataIssues(issues) {
    if (!issues.length) {
      console.log("✅ drivers.json passed validation.");
      return;
    }

    const fatal = issues.filter(i => i.level === "fatal");
    const warn = issues.filter(i => i.level === "warn");

    console.groupCollapsed(
      `⚠️ drivers.json validation: ${fatal.length} fatal, ${warn.length} warnings`
    );
    issues.forEach(i => {
      const msg = `[${i.level}] #${i.index} ${i.id ?? "(no id)"} — ${i.message}`;
      (i.level === "fatal" ? console.error : console.warn)(msg, i.driver ?? "");
    });
    console.groupEnd();
  }

  function validateAndNormalizeDrivers(data) {
    const issues = [];
    const cleaned = [];
    const seenIds = new Set();

    const required = ["name", "nationality", "manufacturer", "titles", "wins", "firstWRCStart"];

    data.forEach((d, index) => {
      const driver = { ...d };

      // Basic type check
      if (!driver || typeof driver !== "object") {
        issues.push({ level: "fatal", index, message: "Driver entry is not an object", driver: d });
        return;
      }

      // Recommend id (not fatal yet)
      if (!driver.id) {
        issues.push({ level: "warn", index, message: "Missing 'id' (recommended for future-proofing)", driver });
      } else {
        if (seenIds.has(driver.id)) {
          issues.push({ level: "fatal", index, id: driver.id, message: "Duplicate id", driver });
          return;
        }
        seenIds.add(driver.id);
      }

      // Required fields present?
      required.forEach((k) => {
        if (driver[k] === undefined || driver[k] === null || driver[k] === "") {
          issues.push({ level: "fatal", index, id: driver.id, message: `Missing required field '${k}'`, driver });
        }
      });

      // Numeric fields sanity
      ["titles", "wins", "firstWRCStart"].forEach((k) => {
        if (driver[k] !== undefined && driver[k] !== null) {
          const n = Number(driver[k]);
          if (!Number.isFinite(n)) {
            issues.push({ level: "fatal", index, id: driver.id, message: `'${k}' must be a number`, driver });
          } else {
            driver[k] = n; // normalize numeric strings to numbers
          }
        }
      });

      // manufacturers array for your yellow logic
      if (!Array.isArray(driver.manufacturers)) {
        issues.push({
          level: "warn",
          index,
          id: driver.id,
          message: "Missing/invalid 'manufacturers' array (used for yellow manufacturer match)",
          driver
        });
        // Try to auto-fix: create array containing current manufacturer
        driver.manufacturers = [driver.manufacturer].filter(Boolean);
      }

      // Ensure current manufacturer is in manufacturers list
      if (driver.manufacturer && Array.isArray(driver.manufacturers)) {
        const hasCurrent = driver.manufacturers.some(m => String(m).toLowerCase() === String(driver.manufacturer).toLowerCase());
        if (!hasCurrent) {
          issues.push({
            level: "warn",
            index,
            id: driver.id,
            message: "Current 'manufacturer' not included in 'manufacturers' list — auto-adding it",
            driver
          });
          driver.manufacturers = [driver.manufacturer, ...driver.manufacturers];
        }
      }

      // Optional: uppercase nationality
      if (typeof driver.nationality === "string") {
        driver.nationality = driver.nationality.toUpperCase().trim();
      }

      cleaned.push(driver);
    });

    logDataIssues(issues);

    const hasFatal = issues.some(i => i.level === "fatal");
    return { cleaned, issues, hasFatal };
  }

  function getDisplayPuzzleNumber() {
    const launchDate = new Date("2026-03-20");
    const today = new Date();

    launchDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - launchDate) / (1000 * 60 * 60 * 24));

    return diffDays + 1; // launch day = #1
  }

  // Seeded shuffle helpers
  function mulberry32(seed) {
    // deterministic PRNG
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(array, seed) {
    const rng = mulberry32(seed);
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Local persistence
    function getPuzzleKey() {
    const startDate = new Date("2024-01-01");
    const today = new Date();
    startDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    return diffDays; // puzzle id for today
  }

  function storageKey() {
    return `wrcdle_state_${getPuzzleKey()}`;
  }

  function saveState() {
    const state = {
      guesses,
      gameOver,
      guessedDrivers,
      // store rows so we can re-render exactly
      history: guessHistory,
      endMessage,
    };
    localStorage.setItem(storageKey(), JSON.stringify(state));
  }

  function loadState() {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Stats and streaks
  function statsKey() {
    return "wrcdle_stats";
  }

  function loadStats() {
    const defaults = {
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastPlayedKey: null,
      lastWinKey: null,
      guessDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
        6: 0
      }
    };

    const raw = localStorage.getItem(statsKey());
    if (!raw) return defaults;

    try {
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        guessDistribution: {
          ...defaults.guessDistribution,
          ...(parsed.guessDistribution || {})
        }
      };
    } catch {
      return defaults;
  }}

  function saveStats(stats) {
    localStorage.setItem(statsKey(), JSON.stringify(stats));
  }

  // Variables
  let guesses = 0;
  const MAX_GUESSES = 6;
  let gameOver = false;
  let drivers = [];
  let chosenDriver = null;
  let guessedDrivers = [];
  let guessHistory = [];
  let endMessage = "";
  const todayKey = getPuzzleKey();

  const manufacturerLogos = {
    "Toyota": "images/logos/toyota.png",
    "Hyundai": "images/logos/hyundai.png",
    "M-Sport": "images/logos/m-sport.png",
    "Hyundai 2C Compétition": "images/logos/2c_competition.png",
    "Citroën": "images/logos/citroen.png",
    "Volkswagen": "images/logos/volkswagen.png",
    "DMACK WRT": "images/logos/dmack.png",
    "Ford": "images/logos/ford.png",
    "Munchi's Ford": "images/logos/munchis.png"
  };

  const input = document.getElementById("guessInput");
  const suggestions = document.getElementById("suggestions");
  const submitButton = document.getElementById("submitGuess");
  const revealedDriverStats = document.getElementById("revealedDriverStats");

  renderStats();

  // submitGuess function
  function submitGuess() {
  if (gameOver || guesses >= MAX_GUESSES) return;

  const name = input.value.trim();
  if (!name) return;

  const normalizedName = name.toLowerCase();

  // 🚫 Prevent duplicate guesses
  if (guessedDrivers.includes(normalizedName)) {
    alert("You already guessed that driver!");
    return;
  }

  suggestions.innerHTML = "";

  const result = checkGuess(name);

  if (!result) {
    alert("Driver not found!");
    return;
  }

  guessedDrivers.push(normalizedName);
  guessHistory.push(result);
  guesses++;

  renderGuess(result);

  saveState();

  if (isWin(result)) {
    endMessage = `🏁 Correct! The driver was ${chosenDriver.name}.`;
    const statusEl = document.getElementById("status");
    statusEl.textContent = endMessage;
    statusEl.classList.remove("win");
    void statusEl.offsetWidth; // force reflow (restarts animation)
    statusEl.classList.add("win");   // animation trigger
    gameOver = true;
    input.disabled = true;
    submitButton.disabled = true;
    
    // update stats
    const stats = loadStats();

  // prevent double-counting if user refreshes
  if (stats.lastPlayedKey !== todayKey) {
    stats.gamesPlayed += 1;
    stats.wins += 1;
    stats.guessDistribution[guesses] += 1;

  // streak logic: if last win was yesterday, continue; else reset to 1
  if (stats.lastWinKey === todayKey - 1) {
    stats.currentStreak += 1;
    } else {
    stats.currentStreak = 1;
    }

    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastPlayedKey = todayKey;
    stats.lastWinKey = todayKey;

    saveStats(stats);
  } else {
  }  
    input.value = "";
    input.focus();
    saveState();
    renderStats();
    updateShareButtonState();
    renderResultsModal();
    resultsModal.classList.remove("hidden");
    return;
  }  

  if (guesses >= MAX_GUESSES) {
    endMessage = `❌ Out of guesses! The driver was ${chosenDriver.name}.`;
    const statusEl = document.getElementById("status");
    statusEl.textContent = endMessage;
    statusEl.classList.remove("win");
    void statusEl.offsetWidth; // force reflow (restarts animation)
    statusEl.classList.add("win");   // reuse animation
    gameOver = true;
    input.disabled = true;
    submitButton.disabled = true;
        
    // update stats
    const stats = loadStats();

  if (stats.lastPlayedKey !== todayKey) {
    stats.gamesPlayed += 1;

  // losing breaks streak
    stats.currentStreak = 0;
    stats.lastPlayedKey = todayKey;

    saveStats(stats);
  }
    input.value = "";
    input.focus();
    saveState();
    renderStats();
    updateShareButtonState();
    renderResultsModal();
    resultsModal.classList.remove("hidden");
    return;
  }

  const remaining = Math.max(0, MAX_GUESSES - guesses);
  document.getElementById("status").textContent =
    `Guesses remaining: ${remaining}`;

  input.value = "";
  input.focus();

  }
  function compareValue(guess, answer) {
  return guess === answer ? { value: guess, class: "correct" }
                          : { value: guess, class: "wrong" };
  }

  function compareNumber(guess, answer) {
  if (guess === answer) return { value: guess, class: "correct" };
  return { value: `${guess} ${guess < answer ? "⬆️" : "⬇️"}`, class: "wrong" };
  }

  function compareManufacturer(guess, answer) {
  if (guess.manufacturer === answer.manufacturer) {
    return { value: guess.manufacturer, class: "correct" };
  }
  if (answer.manufacturers && answer.manufacturers.includes(guess.manufacturer)) {
    return { value: guess.manufacturer, class: "partial" };
  }
  return { value: guess.manufacturer, class: "wrong" };
  }

  function checkGuess(guessName) {
  const guess = drivers.find(d => d.name.toLowerCase() === guessName.toLowerCase());
  if (!guess) return null;

  return {
    driver: { value: guess.name, class: "neutral" },
    nationality: compareValue(guess.nationality, chosenDriver.nationality),
    manufacturer: compareManufacturer(guess, chosenDriver),
    titles: compareNumber(guess.titles, chosenDriver.titles),
    wins: compareNumber(guess.wins, chosenDriver.wins),
    debut: compareNumber(guess.firstWRCStart, chosenDriver.firstWRCStart)
    };
  }

  function isWin(result) {
    return (
      result.nationality.class === "correct" &&
      result.manufacturer.class === "correct" &&
      result.titles.class === "correct" &&
      result.wins.class === "correct" &&
      result.debut.class === "correct"
    );
  }

  function formatDriverStats(driver) {
    if (!driver) return "";

    const manufacturersText = Array.isArray(driver.manufacturers)
      ? driver.manufacturers.join(", ")
      : driver.manufacturer;

    return `
      <div class="revealed-driver">
        <h3>${driver.name}</h3>
        <p><strong>Nationality:</strong> ${driver.nationality}</p>
        <p><strong>Current Team/Manufacturer:</strong> ${driver.manufacturer}</p>
        <p><strong>Previous Teams/Manufacturers:</strong> ${manufacturersText}</p>
        <p><strong>Titles:</strong> ${driver.titles}</p>
        <p><strong>Wins:</strong> ${driver.wins}</p>
        <p><strong>Debut:</strong> ${driver.firstWRCStart}</p>
      </div>
    `;
  }

  function renderGuess(result) {
  const tbody = document.querySelector("#guessTable tbody");
  const row = document.createElement("tr");

  for (const key of ["driver","nationality","manufacturer","titles","wins","debut"]) {
    const cell = document.createElement("td");

    if (key === "manufacturer") {
      const logoPath = manufacturerLogos[result[key].value];

      if (logoPath) {
        const img = document.createElement("img");
        img.src = logoPath;
        img.className = "manufacturer-logo";

        const span = document.createElement("span");
        span.textContent = result[key].value;

        cell.appendChild(img);
        cell.appendChild(span);
      } else {
        cell.textContent = result[key].value;
      }
    } else {
      cell.textContent = result[key].value;
    }

    cell.className = result[key].class;
    row.appendChild(cell);
    }

    tbody.appendChild(row);

    renderGuessCard(result);
  }

  function renderGuessCard(result) {
    const wrap = document.getElementById("guessCards");

    const card = document.createElement("div");
    card.className = "guess-card";

    const title = document.createElement("h3");
    title.textContent = result.driver.value;
    card.appendChild(title);

    const fields = [
      ["Nationality", "nationality"],
      ["Team", "manufacturer"],
      ["Titles", "titles"],
      ["Wins", "wins"],
      ["Debut", "debut"],
    ];

    fields.forEach(([label, key]) => {
      const row = document.createElement("div");
      row.className = `card-row ${result[key].class}`;

      const left = document.createElement("div");
      left.className = "card-label";
      left.textContent = label;

      const right = document.createElement("div");
      right.className = "card-value";

      // manufacturer logo handling (reuse your logic)
      if (key === "manufacturer") {
        const logoPath = manufacturerLogos[result[key].value];
        if (logoPath) {
          const img = document.createElement("img");
          img.src = logoPath;
          img.className = "manufacturer-logo";
          img.style.marginRight = "8px";

          const span = document.createElement("span");
          span.textContent = result[key].value;

          right.appendChild(img);
          right.appendChild(span);
        } else {
          right.textContent = result[key].value;
        }
      } else {
        right.textContent = result[key].value;
      }

      row.appendChild(left);
      row.appendChild(right);
      card.appendChild(row);
    });

    wrap.prepend(card);
  }

  // Display stats
  function renderStats() {
  const stats = loadStats();
  const winPct = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

    document.getElementById("stats").textContent =
      `Played: ${stats.gamesPlayed} | Wins: ${stats.wins} (${winPct}%) | Streak: ${stats.currentStreak} | Max Streak: ${stats.maxStreak}`;
  }

  // Results modal
  const resultsModal = document.getElementById("resultsModal");
  const closeResultsModal = document.getElementById("closeResultsModal");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsSummary = document.getElementById("resultsSummary");
  const resultsStats = document.getElementById("resultsStats");
  const guessDistributionEl = document.getElementById("guessDistribution");
  const resultsShareBtn = document.getElementById("resultsShareBtn");
  
    closeResultsModal?.addEventListener("click", () => {
      resultsModal.classList.add("hidden");
    });

    window.addEventListener("click", (e) => {
      if (e.target === resultsModal) {
        resultsModal.classList.add("hidden");
      }
    });

    resultsShareBtn?.addEventListener("click", () => {
      resultsModal.classList.add("hidden");
      openShareModal();
    });

  // Results modal render function
  function renderResultsModal() {
    const stats = loadStats();
    const winPct = stats.gamesPlayed
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0;

    resultsTitle.textContent = gameOver && endMessage.startsWith("🏁")
      ? "You got it!"
      : "Out of guesses";

    resultsSummary.textContent = endMessage;

    resultsStats.innerHTML = `
      <p>Played: ${stats.gamesPlayed}</p>
      <p>Wins: ${stats.wins} (${winPct}%)</p>
      <p>Current Streak: ${stats.currentStreak}</p>
      <p>Max Streak: ${stats.maxStreak}</p>
    `;

    const distribution = stats.guessDistribution || {};
    guessDistributionEl.innerHTML = `
      <h3>Guess Distribution</h3>
      <div class="dist-row"><span>1</span><div class="dist-bar" style="width:${(distribution[1] || 0) * 20 + 20}px;">${distribution[1] || 0}</div></div>
      <div class="dist-row"><span>2</span><div class="dist-bar" style="width:${(distribution[2] || 0) * 20 + 20}px;">${distribution[2] || 0}</div></div>
      <div class="dist-row"><span>3</span><div class="dist-bar" style="width:${(distribution[3] || 0) * 20 + 20}px;">${distribution[3] || 0}</div></div>
      <div class="dist-row"><span>4</span><div class="dist-bar" style="width:${(distribution[4] || 0) * 20 + 20}px;">${distribution[4] || 0}</div></div>
      <div class="dist-row"><span>5</span><div class="dist-bar" style="width:${(distribution[5] || 0) * 20 + 20}px;">${distribution[5] || 0}</div></div>
      <div class="dist-row"><span>6</span><div class="dist-bar" style="width:${(distribution[6] || 0) * 20 + 20}px;">${distribution[6] || 0}</div></div>
    `;

    revealedDriverStats.innerHTML = formatDriverStats(chosenDriver);
  }

  // Guess Button listener
  submitButton.addEventListener("click", submitGuess);

  // Auto Suggestions
  let activeSuggestionIndex = -1;
  let currentMatches = [];

  // Highlight matching text (safe + simple)
  function highlightMatch(name, query) {
    const q = query.trim();
    if (!q) return name;

    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return name;

    const before = name.slice(0, idx);
    const match = name.slice(idx, idx + q.length);
    const after = name.slice(idx + q.length);

    // Use <mark> for highlighting
    return `${before}<mark>${match}</mark>${after}`;
  }

  function clearSuggestions() {
    suggestions.innerHTML = "";
    activeSuggestionIndex = -1;
    currentMatches = [];
  }

  function renderSuggestions(matches, query) {
    suggestions.innerHTML = "";

    matches.forEach((driver, i) => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.dataset.index = String(i);

      // highlight
      div.innerHTML = highlightMatch(driver.name, query);

      div.addEventListener("mousedown", (e) => {
        // mousedown prevents blur race on mobile/desktop
        e.preventDefault();
        input.value = driver.name;
        clearSuggestions();
        submitGuess();
      });

      suggestions.appendChild(div);
    });
  }

  function setActiveSuggestion(index) {
    const items = suggestions.querySelectorAll(".suggestion");
    items.forEach(el => el.classList.remove("active"));

    if (items.length === 0) {
      activeSuggestionIndex = -1;
      return;
    }

    // wrap
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    activeSuggestionIndex = index;
    const active = items[activeSuggestionIndex];
    active.classList.add("active");

    // keep active item in view if list scrolls
    active.scrollIntoView({ block: "nearest" });
  }

  // Input → build matches
  input.addEventListener("input", () => {
    const value = input.value.trim().toLowerCase();
    if (!value) {
      clearSuggestions();
      return;
    }

    // 1) filter
    const filtered = drivers.filter(d => d.name.toLowerCase().includes(value));

    // 2) sort with startsWith first, then alpha
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const aStarts = aName.startsWith(value);
      const bStarts = bName.startsWith(value);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // secondary: alphabetical
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    // 3) take top 6 (feel free to change)
    currentMatches = filtered.slice(0, 6);
    activeSuggestionIndex = -1;

    renderSuggestions(currentMatches, input.value);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const items = suggestions.querySelectorAll(".suggestion");
    const hasList = items.length > 0;

    if (e.key === "ArrowDown" && hasList) {
      e.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    }

    if (e.key === "ArrowUp" && hasList) {
      e.preventDefault();
      setActiveSuggestion(activeSuggestionIndex - 1);
    }

    if (e.key === "Enter") {
    if (hasList) {
      e.preventDefault();

      // If none selected yet, pick the top suggestion
      const indexToUse = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
      const chosen = currentMatches[indexToUse];

      if (chosen) {
        input.value = chosen.name;
        clearSuggestions();
        submitGuess();
      }
      return;
    }

    // no list showing -> normal guess
    e.preventDefault();
    submitGuess();
  }

    if (e.key === "Escape") {
      clearSuggestions();
    }
  });

  // Click outside closes suggestions (you already have this, but ensure it calls clearSuggestions)
  document.addEventListener("click", (e) => {
    const isInside = input.contains(e.target) || suggestions.contains(e.target);
    if (!isInside) clearSuggestions();
  });
  
  // Emoji mapper for sharing  
  function classToEmoji(cls) {
  if (cls === "correct") return "🟩";
  if (cls === "partial") return "🟨";
  if (cls === "wrong") return "🟥";
  return "⬛"; // neutral/unknown
  }

  function buildShareText() {
  const puzzleNumber = getDisplayPuzzleNumber(); // you already have this helper
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Use 5 columns (exclude "driver")
  const cols = ["nationality", "manufacturer", "titles", "wins", "debut"];

  const lines = guessHistory.map(g =>
    cols.map(k => classToEmoji(g[k]?.class)).join("")
  );

  const win = endMessage?.startsWith("🏁");
  const header = `WRCdle #${puzzleNumber} ${dateStr} ${win ? `${guesses}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`;
  const url = "https://wrcdle.com";
  return [header, "", ...lines, "", `Play: ${url}`].join("\n");
  }

  // Share button handler
  const shareModal = document.getElementById("shareModal");
  const closeShareModal = document.getElementById("closeShareModal");
  const shareTextBox = document.getElementById("shareText");
  const copyShareBtn = document.getElementById("copyShare");
  const nativeShareBtn = document.getElementById("nativeShare");
  const shareStatus = document.getElementById("shareStatus");

  function openShareModal() {
    if (guessHistory.length === 0) return;

    shareStatus.textContent = "";
    shareTextBox.value = buildShareText();
    shareModal.classList.remove("hidden");

    // Hide native share button if unsupported
    nativeShareBtn.style.display = navigator.share ? "inline-block" : "none";
  }

  function updateShareButtonState() {
    if (!shareBtn) return;
    shareBtn.disabled = !gameOver;
  }

  const shareBtn = document.getElementById("shareBtn");
  shareBtn?.addEventListener("click", openShareModal);

  closeShareModal?.addEventListener("click", () => {
    shareModal.classList.add("hidden");
  });

  // Native share button (optional)  
  nativeShareBtn?.addEventListener("click", async () => {
    const text = shareTextBox.value;

    if (!navigator.share) return;

    try {
      await navigator.share({ text });
      shareStatus.textContent = "✅ Shared!";
    } catch {
      shareStatus.textContent = "Share cancelled.";
    }
  });

  window.addEventListener("click", (e) => {
    if (e.target === shareModal) shareModal.classList.add("hidden");
  });

    // Copy function
    function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }

  copyShareBtn?.addEventListener("click", async () => {
    const text = shareTextBox.value;

    try {
      await navigator.clipboard.writeText(text);
      shareStatus.textContent = "✅ Copied to clipboard!";
      navigator.vibrate?.(30);   // subtle haptic feedback
    } catch {
      fallbackCopy(text);
      shareStatus.textContent = "✅ Copied!";
      navigator.vibrate?.(30);   // subtle haptic feedback
    }
  });

  // Load Drivers + validate + seeded shuffle + choose driver
  fetch("drivers.json")
    .then(res => res.json())
    .then(data => {
      // 1) validate + normalize
      const { cleaned, hasFatal } = validateAndNormalizeDrivers(data);
      if (hasFatal) {
        // stop here so the game doesn't behave weirdly with bad data
        document.getElementById("status").textContent =
          "⚠️ drivers.json has fatal errors — check console.";
        console.error("❌ Fatal drivers.json errors. Fix them before playing.");
        return;
      }

      drivers = cleaned;

      // 2) seeded shuffle order (same for everyone)
      // Choose a constant "season seed" so order changes if you want (e.g. 2026)
      const SEASON_SEED = new Date().getFullYear();

      // getPuzzleKey() is your existing function
      const todayKey = getPuzzleKey();

      // Shuffle the entire list deterministically once, then pick by day
      const order = seededShuffle(drivers, SEASON_SEED);

      chosenDriver = order[todayKey % order.length];

      console.log("Chosen driver:", chosenDriver);

      // (optional) if you want suggestions to feel alphabetical, sort `drivers`
      // but keep chosenDriver from the shuffled 'order'
      drivers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

      // If you do any loadState() restore, do it here (after chosenDriver set)
      const saved = loadState();
      if (saved) {
        endMessage = saved.endMessage ?? "";
        guesses = saved.guesses ?? 0;
        gameOver = saved.gameOver ?? false;
        guessedDrivers = saved.guessedDrivers ?? [];
        guessHistory = saved.history ?? [];

        // rebuild table + cards (if you're doing both)
        const tbody = document.querySelector("#guessTable tbody");
        if (tbody) tbody.innerHTML = "";
        const cards = document.getElementById("guessCards");
        if (cards) cards.innerHTML = "";

        guessHistory.slice().reverse().forEach(r => renderGuess(r));

        const remaining = Math.max(0, MAX_GUESSES - guesses);
        if (gameOver || remaining === 0) {
          input.disabled = true;
          submitButton.disabled = true;
        }

        // restore exact end message if you’re storing it
        document.getElementById("status").textContent =
          gameOver ? (endMessage || `Game over! The driver was ${chosenDriver.name}.`)
                 : `Guesses remaining: ${remaining}`;

        if (gameOver && endMessage) {
          renderResultsModal();
          resultsModal.classList.remove("hidden");
        }  

        updateShareButtonState?.();
      } else {
        document.getElementById("status").textContent =
          `Guesses remaining: ${MAX_GUESSES}`;
        updateShareButtonState?.();
      }
    })
    .catch(err => {
      console.error("Failed to load drivers.json:", err);
      document.getElementById("status").textContent =
        "❌ Couldn't load drivers.json (check filename/path).";
    });

  // Help Modal
  const helpButton = document.getElementById("helpButton");
  const helpModal = document.getElementById("helpModal");
  const closeModal = document.getElementById("closeModal");

  if (helpButton && helpModal && closeModal) {
  helpButton.addEventListener("click", () => helpModal.classList.remove("hidden"));
  closeModal.addEventListener("click", () => helpModal.classList.add("hidden"));

  window.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });

  if (!localStorage.getItem("wrcdle_seen_help")) {
    helpModal.classList.remove("hidden");
    localStorage.setItem("wrcdle_seen_help", "true");
  }
  } else {
  console.warn("Help modal elements missing. Check IDs: helpButton, helpModal, closeModal");
  }

  // Countdown
  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    const diff = tomorrow - now;

    const hrs = Math.floor(diff / 1000 / 60 / 60);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const el = document.getElementById("countdown");
    if (!el) return;

    el.textContent = `Next rally in: ${hrs}h ${mins}m ${secs}s`;
  }

  // Start it
  setInterval(updateCountdown, 1000);
  updateCountdown();

});
  
