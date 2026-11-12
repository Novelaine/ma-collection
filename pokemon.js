// Espace Pokémon : les données personnelles sont séparées des collections classiques.
const POKEMON_STORAGE_KEY = "ma-collection-pokemon-v1";
const POKEMON_API = "https://api.tcgdex.net/v2";
let pokemonRecords = loadPokemonRecords();
let pokemonLanguage = "fr";
let selectedPokemonCard = null;
let selectedPokemonDetails = null;
let pokemonSearchSequence = 0;
let pokemonActiveList = "owned";
let pokemonCurrentPanel = "search";

const p$ = (id) => document.getElementById(id);
const languageNames = { fr: "Français", en: "Anglais", ja: "Japonais" };
const variantLabels = {
  normal: "Standard", holo: "Holo", reverse: "Reverse", firstEdition: "Première édition",
  wPromo: "Promo", cosmos: "Holo cosmos", "holo reverse": "Holo reverse"
};

function loadPokemonRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(POKEMON_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function savePokemonRecords() {
  localStorage.setItem(POKEMON_STORAGE_KEY, JSON.stringify(pokemonRecords));
}
window.getPokemonBackupData = () => pokemonRecords;
window.restorePokemonBackupData = (records) => {
  pokemonRecords = Array.isArray(records) ? records.filter(r => r && typeof r.cardId === "string") : [];
  savePokemonRecords();
  renderPokemonRecords();
};
function pEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function pokemonToast(message) {
  const toast = p$("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.pokemonToastTimer);
  window.pokemonToastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function showPokemonView(show) {
  p$("homeView").classList.toggle("hidden", show);
  p$("detailView").classList.add("hidden");
  p$("pokemonView").classList.toggle("hidden", !show);
  if (show) {
    pokemonCurrentPanel = "search";
    renderPokemonRecords();
  }
}
function formatVariant(value) {
  return variantLabels[value] || value.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
}
function recordKey(record) {
  return [record.cardId, record.language, record.variant.toLowerCase()].join("::");
}
function getRecord(cardId, language, variant) {
  return pokemonRecords.find(r => recordKey(r) === recordKey({cardId, language, variant}));
}
function cardImage(url) {
  if (!url) return "";
  return `${url}/low.png`;
}
function renderPokemonRecords() {
  const owned = pokemonRecords.filter(r => Number(r.quantity) > 0);
  const wanted = pokemonRecords.filter(r => r.wanted);
  p$("pokemonOwnedCount").textContent = owned.length;
  p$("pokemonWantedCount").textContent = wanted.length;
  p$("pokemonOwnedList").innerHTML = renderRecordList(owned, "Aucune carte possédée pour le moment.");
  p$("pokemonWantedList").innerHTML = renderRecordList(wanted, "Aucune carte recherchée pour le moment.");
  p$("pokemonSearchPanel").classList.toggle("hidden", pokemonCurrentPanel !== "search");
  p$("pokemonRecordPanel").classList.toggle("hidden", pokemonCurrentPanel === "search");
  p$("pokemonOwnedList").classList.toggle("hidden", pokemonCurrentPanel !== "owned");
  p$("pokemonWantedList").classList.toggle("hidden", pokemonCurrentPanel !== "wanted");
  p$("showPokemonSearch").classList.toggle("active", pokemonCurrentPanel === "search");
  p$("showOwnedPokemon").classList.toggle("active", pokemonCurrentPanel === "owned");
  p$("showWantedPokemon").classList.toggle("active", pokemonCurrentPanel === "wanted");
  renderSelectedVersions();
}
function renderRecordList(records, emptyMessage) {
  if (!records.length) return `<div class="empty-state small-empty">${emptyMessage}</div>`;
  return records.map(r => `<article class="pokemon-record">\n    ${r.image ? `<img src="${pEscape(cardImage(r.image))}" alt="" loading="lazy">` : ""}\n    <div class="pokemon-record-copy"><strong>${pEscape(r.name)}</strong><span>${pEscape(r.seriesName ? `${r.seriesName} · ` : "")}${pEscape(r.setName || "Extension inconnue")} · ${pEscape(r.localId || "?")}</span><span>${pEscape(languageNames[r.language] || r.language)} · ${pEscape(r.variant)}</span>${r.rarity?`<span>${pEscape(r.rarity)}</span>`:""}${Number(r.quantity)>0?`<b>Quantité : ${Number(r.quantity)}</b>`:''}${r.wanted?'<b class="wanted-text">À trouver</b>':''}</div>\n    <div class="record-actions"><button class="mini-button" data-record-edit="${pEscape(recordKey(r))}" aria-label="Modifier">✎</button><button class="mini-button" data-record-delete="${pEscape(recordKey(r))}" aria-label="Supprimer">×</button></div>\n  </article>`).join("");
}
function renderSelectedVersions() {
  const box = p$("selectedCardVersions");
  if (!box || !selectedPokemonCard) return;
  const rows = pokemonRecords.filter(r => r.cardId === selectedPokemonCard.id && r.language === pokemonLanguage);
  box.innerHTML = rows.length ? renderRecordList(rows, "") : '<div class="empty-state small-empty">Aucune version enregistrée pour cette carte.</div>';
}
function bindRecordActions(root) {
  root.querySelectorAll("[data-record-delete]").forEach(btn => btn.addEventListener("click", () => {
    const record = pokemonRecords.find(r => recordKey(r) === btn.dataset.recordDelete);
    if (!record || !confirm(`Supprimer ${record.name} — ${record.variant} ?`)) return;
    pokemonRecords = pokemonRecords.filter(r => recordKey(r) !== btn.dataset.recordDelete);
    savePokemonRecords(); renderPokemonRecords(); pokemonToast("Version supprimée");
  }));
  root.querySelectorAll("[data-record-edit]").forEach(btn => btn.addEventListener("click", () => {
    const record = pokemonRecords.find(r => recordKey(r) === btn.dataset.recordEdit);
    if (!record) return;
    pokemonLanguage = record.language;
    pokemonCurrentPanel = "search";
    renderPokemonRecords();
    document.querySelectorAll("[data-language]").forEach(b => b.classList.toggle("active", b.dataset.language === pokemonLanguage));
    selectedPokemonCard = {id:record.cardId,name:record.name,image:record.image,localId:record.localId,seriesName:record.seriesName || "",rarity:record.rarity || "",set:{id:record.setId,name:record.setName}};
    selectedPokemonDetails = null;
    p$("selectedCardName").textContent = record.name;
    p$("selectedCardMeta").textContent = `${record.setName || "Extension"} · ${record.localId || ""} · ${languageNames[record.language]}`;
    p$("selectedCardImage").src = cardImage(record.image);
    p$("selectedCardImage").classList.toggle("hidden", !record.image);
    p$("pokemonVariant").innerHTML = `<option value="${pEscape(record.variant)}">${pEscape(record.variant)}</option>`;
    p$("pokemonCustomVariant").value = "";
    p$("pokemonOwnedQty").value = Number(record.quantity) || 0;
    p$("pokemonWanted").checked = Boolean(record.wanted);
    p$("pokemonSelected").classList.remove("hidden");
    p$("pokemonSelected").scrollIntoView({behavior:"smooth",block:"start"});
  }));
}
async function searchPokemonCards() {
  const name = p$("pokemonSearch").value.trim();
  const set = p$("pokemonSetFilter").value.trim();
  const number = p$("pokemonNumberFilter").value.trim();
  if (!name && !set && !number) { pokemonToast("Indique au moins un nom, une extension ou un numéro."); return; }
  const sequence = ++pokemonSearchSequence;
  const results = p$("pokemonResults");
  results.innerHTML = '<div class="empty-state">Recherche en cours…</div>';
  p$("pokemonResultCount").textContent = "…";
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (set) params.set("set", set);
  if (number) params.set("localId", number);
  params.set("pagination:page", "1");
  params.set("pagination:itemsPerPage", "40");
  try {
    const response = await fetch(`${POKEMON_API}/${pokemonLanguage}/cards?${params.toString()}`);
    if (!response.ok) throw new Error("Catalogue indisponible");
    const cards = await response.json();
    if (sequence !== pokemonSearchSequence) return;
    p$("pokemonResultCount").textContent = `${cards.length} carte${cards.length>1?"s":""}`;
    if (!cards.length) { results.innerHTML = '<div class="empty-state">Aucune carte trouvée. Essaie un autre nom ou une autre langue ♡</div>'; return; }
    results.innerHTML = cards.map(card => `<button class="pokemon-result" data-card-id="${pEscape(card.id)}">${card.image?`<img src="${pEscape(card.image)}/low.png" alt="" loading="lazy">`:'<span class="card-placeholder">🃏</span>'}<span><strong>${pEscape(card.name)}</strong><small>${pEscape(card.id)}</small></span><span class="result-arrow">›</span></button>`).join("");
    results.querySelectorAll("[data-card-id]").forEach(btn => btn.addEventListener("click", () => loadPokemonCard(btn.dataset.cardId)));
  } catch (error) {
    if (sequence !== pokemonSearchSequence) return;
    results.innerHTML = '<div class="empty-state">Impossible de joindre le catalogue pour le moment.<br>Vérifie ta connexion Internet puis réessaie.</div>';
    p$("pokemonResultCount").textContent = "0 carte";
  }
}
async function loadPokemonCard(cardId) {
  const results = p$("pokemonResults");
  results.querySelectorAll(".pokemon-result").forEach(b => b.classList.toggle("selected", b.dataset.cardId === cardId));
  p$("pokemonSelected").classList.remove("hidden");
  p$("selectedCardName").textContent = "Chargement de la carte…";
  try {
    const response = await fetch(`${POKEMON_API}/${pokemonLanguage}/cards/${encodeURIComponent(cardId)}`);
    if (!response.ok) throw new Error("Carte indisponible");
    const card = await response.json();
    selectedPokemonCard = card;
    selectedPokemonDetails = card;
    p$("selectedCardName").textContent = card.name;
    p$("selectedCardMeta").textContent = `${card.set?.name || "Extension inconnue"} · N° ${card.localId || "?"} · ${card.rarity || "Rareté non renseignée"} · ${languageNames[pokemonLanguage]}`;
    const image = p$("selectedCardImage");
    image.src = card.image ? `${card.image}/high.png` : "";
    image.classList.toggle("hidden", !card.image);
    const variants = Object.entries(card.variants || {}).filter(([,available]) => available === true).map(([key]) => key);
    // TCGdex indique les finitions connues pour cette carte. Si aucune variante n'est fournie,
    // on propose seulement Standard ; les finitions spéciales peuvent être saisies manuellement.
    const choices = variants.length ? variants : ["normal"];
    p$("pokemonVariant").innerHTML = choices.map(v => `<option value="${pEscape(v)}">${pEscape(formatVariant(v))}</option>`).join("");
    p$("pokemonCustomVariant").value = "";
    const existing = getRecord(card.id,pokemonLanguage,p$("pokemonVariant").value);
    p$("pokemonOwnedQty").value = existing?.quantity || 0;
    p$("pokemonWanted").checked = Boolean(existing?.wanted);
    if (card.set?.id) {
      try {
        const setResponse = await fetch(`${POKEMON_API}/${pokemonLanguage}/sets/${encodeURIComponent(card.set.id)}`);
        if (setResponse.ok) {
          const setDetails = await setResponse.json();
          if (selectedPokemonCard?.id === card.id) {
            selectedPokemonCard.seriesName = setDetails.serie?.name || "";
            p$("selectedCardMeta").textContent = `${selectedPokemonCard.seriesName ? selectedPokemonCard.seriesName + " · " : ""}${card.set?.name || "Extension inconnue"} · N° ${card.localId || "?"} · ${card.rarity || "Rareté non renseignée"} · ${languageNames[pokemonLanguage]}`;
            renderSelectedVersions();
          }
        }
      } catch { /* Les détails de série sont facultatifs : la carte reste utilisable. */ }
    }
    renderSelectedVersions();
    p$("pokemonSelected").scrollIntoView({behavior:"smooth",block:"start"});
  } catch {
    p$("selectedCardName").textContent = "Carte non disponible";
    p$("selectedCardMeta").textContent = "Réessaie dans quelques instants.";
  }
}
function saveSelectedPokemonVersion() {
  if (!selectedPokemonCard) return;
  const custom = p$("pokemonCustomVariant").value.trim();
  const variant = custom || p$("pokemonVariant").value;
  const quantity = Math.max(0, Math.min(999, Number.parseInt(p$("pokemonOwnedQty").value,10) || 0));
  const wanted = quantity === 0 && p$("pokemonWanted").checked;
  const record = {
    cardId:selectedPokemonCard.id, name:selectedPokemonCard.name, image:selectedPokemonCard.image || "",
    localId:String(selectedPokemonCard.localId || ""), setName:selectedPokemonCard.set?.name || "",
    seriesName:selectedPokemonCard.seriesName || selectedPokemonCard.set?.serie?.name || "",
    setId:selectedPokemonCard.set?.id || "", rarity:selectedPokemonCard.rarity || "", language:pokemonLanguage,
    variant, quantity, wanted
  };
  const index = pokemonRecords.findIndex(r => recordKey(r) === recordKey(record));
  if (quantity === 0 && !wanted) {
    if (index >= 0) pokemonRecords.splice(index,1);
  } else if (index >= 0) pokemonRecords[index] = record;
  else pokemonRecords.push(record);
  savePokemonRecords(); renderPokemonRecords();
  pokemonToast(quantity > 0 ? "Carte ajoutée à tes possédées ♡" : wanted ? "Version ajoutée à tes recherches ♡" : "Version retirée de tes listes");
}

p$("showPokemonSearch").addEventListener("click", () => { pokemonCurrentPanel = "search"; renderPokemonRecords(); });
p$("showOwnedPokemon").addEventListener("click", () => { pokemonActiveList = "owned"; pokemonCurrentPanel = "owned"; renderPokemonRecords(); });
p$("showWantedPokemon").addEventListener("click", () => { pokemonActiveList = "wanted"; pokemonCurrentPanel = "wanted"; renderPokemonRecords(); });
p$("openPokemonBtn").addEventListener("click", () => showPokemonView(true));
p$("pokemonBackBtn").addEventListener("click", () => showPokemonView(false));
p$("pokemonSearchBtn").addEventListener("click", searchPokemonCards);
p$("pokemonSearch").addEventListener("keydown", e => { if (e.key === "Enter") searchPokemonCards(); });
p$("pokemonSetFilter").addEventListener("keydown", e => { if (e.key === "Enter") searchPokemonCards(); });
p$("pokemonNumberFilter").addEventListener("keydown", e => { if (e.key === "Enter") searchPokemonCards(); });
document.querySelectorAll("[data-language]").forEach(btn => btn.addEventListener("click", () => {
  pokemonLanguage = btn.dataset.language;
  document.querySelectorAll("[data-language]").forEach(b => b.classList.toggle("active", b === btn));
  p$("pokemonResults").innerHTML = '<div class="empty-state">La langue a changé. Lance une nouvelle recherche ♡</div>';
  p$("pokemonResultCount").textContent = "0 carte";
  p$("pokemonSelected").classList.add("hidden");
  selectedPokemonCard = null;
}));
p$("closeSelectedCard").addEventListener("click", () => p$("pokemonSelected").classList.add("hidden"));
p$("savePokemonVersion").addEventListener("click", saveSelectedPokemonVersion);
p$("pokemonVariant").addEventListener("change", () => {
  if (!selectedPokemonCard) return;
  const existing = getRecord(selectedPokemonCard.id,pokemonLanguage,p$("pokemonVariant").value);
  p$("pokemonOwnedQty").value = existing?.quantity || 0;
  p$("pokemonWanted").checked = Boolean(existing?.wanted);
  p$("pokemonCustomVariant").value = "";
});
p$("pokemonOwnedQty").addEventListener("input", () => { if (Number(p$("pokemonOwnedQty").value)>0) p$("pokemonWanted").checked=false; });

// Les actions sur les versions fonctionnent aussi dans les deux listes en bas de page.
const ownedList = p$("pokemonOwnedList");
const wantedList = p$("pokemonWantedList");
const originalRenderPokemonRecords = renderPokemonRecords;
renderPokemonRecords = function() {
  originalRenderPokemonRecords();
  bindRecordActions(ownedList);
  bindRecordActions(wantedList);
  if (p$("selectedCardVersions")) bindRecordActions(p$("selectedCardVersions"));
};
renderPokemonRecords();
