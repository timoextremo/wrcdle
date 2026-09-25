(() => {
  // Historical/team-specific logo presentation layer.
  // Prefer SVG sources where a trustworthy vector exists. For obscure historic
  // teams without a surviving clean vector, use an authentic team/sponsor mark
  // or the WRC-era manufacturer mark rather than inventing a logo.
  const teamLogoSources = {
    "Ford": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_logo.svg"
    },
    "Monster WRT": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo_Monster_Energy.webp",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg"
    },
    "Yazeed Racing": {
      src: "https://yazeedracing.com/wp-content/uploads/2020/12/yazeed_logo-1-300x181.png"
    },
    "Jipocar Czech": {
      src: "https://www.jipocar.cz/sources/images/logo.png",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg"
    },
    "Lotos Team": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Lotos_logo.svg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/MINI_logo.svg"
    },
    "Brazil WRT": {
      src: "https://upload.wikimedia.org/wikipedia/en/thumb/d/da/BrazilWRTlogo.jpg/250px-BrazilWRTlogo.jpg"
    },
    "FERM Power Tools": {
      src: "https://upload.wikimedia.org/wikipedia/en/3/34/FERMlogo.png",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg"
    },
    "Adapta WRT": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg"
    },
    "Mini Portugal": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/MINI_logo.svg"
    },
    "Van Merksteijn Motorsport": {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Logo-Merksteijn-2008.jpg/250px-Logo-Merksteijn-2008.jpg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Citro%C3%ABn.svg"
    },
    "Ice 1": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Citro%C3%ABn.svg"
    },
    "Qatar WRT": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ford_Motor_Company_Logo.svg"
    },
    "Red Bull Škoda": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Logo_of_Red_bull.svg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/%C5%A0koda_Auto.svg"
    },
    "Kronos Citroën": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Citro%C3%ABn.svg"
    },

    // Historical aliases kept ready for any future visual treatment of the
    // full previous-team list in the results panel.
    "Petter Solberg WRT": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Citro%C3%ABn.svg"
    },
    "Team Abu Dhabi": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Abu_Dhabi_Logo.svg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Citro%C3%ABn.svg"
    },
    "OMV Peugeot Norway": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Omv_logo.svg",
      fallback: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Peugeot_logo.svg"
    },
    "Armindo Araújo WRT": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/MINI_logo.svg"
    },
    "Palmeirinha Rally": {
      src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/MINI_logo.svg"
    }
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
    img.referrerPolicy = "no-referrer";
    img.dataset.teamLogo = team;
    styleLogo(img);

    img.addEventListener("error", () => {
      if (entry.fallback && img.dataset.usedFallback !== "true") {
        img.dataset.usedFallback = "true";
        img.src = entry.fallback;
        return;
      }

      owner.dataset.teamLogoFailed = team;
      img.remove();
    });

    img.src = entry.src;
    return img;
  }

  function applyLogo(owner, team) {
    const entry = teamLogoSources[team];
    if (!entry || !owner) return;
    if (owner.dataset.teamLogoFailed === team) return;

    const existing = owner.querySelector(".manufacturer-logo");

    if (existing) {
      if (existing.dataset.teamLogo === team) return;

      existing.dataset.teamLogo = team;
      existing.dataset.usedFallback = "false";
      existing.referrerPolicy = "no-referrer";
      styleLogo(existing);
      existing.addEventListener("error", () => {
        if (entry.fallback && existing.dataset.usedFallback !== "true") {
          existing.dataset.usedFallback = "true";
          existing.src = entry.fallback;
          return;
        }

        owner.dataset.teamLogoFailed = team;
        existing.remove();
      }, { once: false });
      existing.src = entry.src;
      return;
    }

    const img = buildLogo(team, entry, owner);
    owner.prepend(img);
  }

  function makeExistingLogosSafe() {
    document.querySelectorAll(".manufacturer-logo").forEach(img => {
      styleLogo(img);
      if (img.dataset.logoSafetyAttached === "true") return;
      img.dataset.logoSafetyAttached = "true";
      img.addEventListener("error", () => {
        if (!img.dataset.teamLogo) img.remove();
      });
    });
  }

  function enhanceTeamLogos() {
    makeExistingLogosSafe();

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
