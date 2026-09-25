(() => {
  // Historical/team-specific logo presentation layer.
  // All logo paths are kept inside the WRCdle repo. Where a clean standalone
  // historic team mark is not available, use the team's WRC-era manufacturer
  // mark rather than depending on a fragile third-party hotlink.
  const teamLogoSources = {
    "Ford": { src: "images/logos/ford.svg" },
    "Škoda": { src: "images/logos/skoda.svg" },
    "Peugeot": { src: "images/logos/peugeot.svg" },
    "Subaru": { src: "images/logos/subaru.svg" },
    "Mitsubishi Ralliart": { src: "images/logos/mitsubishi.svg" },
    "SEAT": { src: "images/logos/seat.svg" },
    "Suzuki": { src: "images/logos/suzuki.svg" },
    "Mini": { src: "images/logos/mini.svg" },

    // Historic/private teams. Use a local team asset when we already have one;
    // otherwise use the relevant WRC-era manufacturer mark.
    "Monster WRT": { src: "images/logos/ford.svg" },
    "Yazeed Racing": { src: "images/logos/ford.svg" },
    "Jipocar Czech": { src: "images/logos/ford.svg" },
    "Lotos Team": { src: "images/logos/ford.svg" },
    "Brazil WRT": { src: "images/logos/mini.svg" },
    "FERM Power Tools": { src: "images/logos/ford.svg" },
    "Adapta WRT": { src: "images/logos/ford.svg" },
    "Mini Portugal": { src: "images/logos/mini.svg" },
    "Van Merksteijn Motorsport": { src: "images/logos/citroen.png" },
    "Ice 1": { src: "images/logos/citroen.png" },
    "Qatar WRT": { src: "images/logos/ford.svg" },
    "Red Bull Škoda": { src: "images/logos/skoda.svg" },
    "Kronos Citroën": { src: "images/logos/citroen.png" },
    "Petter Solberg WRT": { src: "images/logos/citroen.png" },
    "Team Abu Dhabi": { src: "images/logos/citroen.png" },
    "OMV Peugeot Norway": { src: "images/logos/peugeot.svg" },
    "Armindo Araújo WRT": { src: "images/logos/mini.svg" },
    "Palmeirinha Rally": { src: "images/logos/mini.svg" },

    // Existing local team assets.
    "M-Sport": { src: "images/logos/m-sport.png" },
    "Hyundai 2C Compétition": { src: "images/logos/2c_competition.png" },
    "DMACK WRT": { src: "images/logos/dmack.png" },
    "Munchi's Ford": { src: "images/logos/munchis.png" },
    "Toyota": { src: "images/logos/toyota.png" },
    "Hyundai": { src: "images/logos/hyundai.png" },
    "Citroën": { src: "images/logos/citroen.png" },
    "Volkswagen": { src: "images/logos/volkswagen.png" }
  };

  function styleLogo(img) {
    img.style.width = "auto";
    img.style.maxWidth = "72px";
    img.style.objectFit = "contain";
  }

  function buildLogo(team, entry, owner) {
    const img = document.createElement("img");
    img.className = "manufacturer-logo";
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.loading = "lazy";
    img.decoding = "async";
    img.dataset.teamLogo = team;
    styleLogo(img);

    img.addEventListener("error", () => {
      owner.dataset.teamLogoFailed = team;
      img.remove();
    }, { once: true });

    img.src = entry.src;
    return img;
  }

  function applyLogo(owner, team) {
    const entry = teamLogoSources[team];
    if (!entry || !owner) return;
    if (owner.dataset.teamLogoFailed === team) return;

    const existing = owner.querySelector(".manufacturer-logo");

    if (existing) {
      if (existing.dataset.teamLogo === team && existing.src.endsWith(entry.src)) return;

      existing.dataset.teamLogo = team;
      styleLogo(existing);
      existing.addEventListener("error", () => {
        owner.dataset.teamLogoFailed = team;
        existing.remove();
      }, { once: true });
      existing.src = entry.src;
      return;
    }

    owner.prepend(buildLogo(team, entry, owner));
  }

  function enhanceTeamLogos() {
    // Desktop guess table.
    document.querySelectorAll("#guessTable tbody tr").forEach(row => {
      const cell = row.cells?.[2];
      if (!cell) return;

      const team = cell.querySelector("span")?.textContent.trim() || cell.textContent.trim();
      applyLogo(cell, team);
    });

    // Mobile guess cards.
    document.querySelectorAll("#guessCards .card-row").forEach(row => {
      const label = row.querySelector(".card-label");
      const value = row.querySelector(".card-value");
      if (!label || !value) return;
      if (label.textContent.trim().toLowerCase() !== "team") return;

      const team = value.querySelector("span")?.textContent.trim() || value.textContent.trim();
      applyLogo(value, team);
    });

    // Final driver reveal.
    document.querySelectorAll(".revealed-driver p").forEach(p => {
      const strong = p.querySelector("strong");
      if (!strong || strong.textContent.trim().toLowerCase() !== "current team/manufacturer:") return;

      const team = p.textContent.replace(/^Current Team\/Manufacturer:\s*/i, "").trim();
      const entry = teamLogoSources[team];
      if (!entry || p.dataset.teamLogo === team || p.dataset.teamLogoFailed === team) return;

      const img = buildLogo(team, entry, p);
      img.style.marginLeft = "2px";
      strong.after(document.createTextNode(" "), img);
      p.dataset.teamLogo = team;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceTeamLogos();

    const observer = new MutationObserver(enhanceTeamLogos);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
