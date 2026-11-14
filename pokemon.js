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
let pokemonCardLanguage = "fr";
let pokemonReturnPanel = "search";
let pokemonReturnScrollY = 0;
let pokemonCategories = loadPokemonCategories();
let pokemonCategoryFilter = { owned: "all", wanted: "all" };

function loadPokemonCategories() {
	try {
		const saved = JSON.parse(localStorage.getItem("ma-collection-pokemon-categories-v1") || "{}");
		return { owned: Array.isArray(saved.owned) ? saved.owned : [], wanted: Array.isArray(saved.wanted) ? saved.wanted : [] };
	} catch {
		return { owned: [], wanted: [] };
	}
}
function savePokemonCategories() {
	localStorage.setItem("ma-collection-pokemon-categories-v1", JSON.stringify(pokemonCategories));
}

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
window.getPokemonCategoryBackupData = () => pokemonCategories;
window.restorePokemonCategoryBackupData = (categories) => {
	if (categories && typeof categories === "object") {
		pokemonCategories = {
			owned: Array.isArray(categories.owned) ? categories.owned : [],
			wanted: Array.isArray(categories.wanted) ? categories.wanted : []
		};
		savePokemonCategories();
		fillPokemonCategorySelects();
		renderPokemonRecords();
	}
};
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
		p$("pokemonDetailView").classList.add("hidden");
		p$("pokemonSearchPanel").classList.remove("hidden");
		renderPokemonRecords();
	}
}
function formatVariant(value) {
	if (variantLabels[value]) return variantLabels[value];
	return String(value).split("|").map(part => {
		if (part.startsWith("stamp:")) {
			return `Tampon ${part.slice(6).replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase())}`;
		}
		if (part.startsWith("foil:")) return `Effet ${part.slice(5)}`;
		if (part.startsWith("size:")) return `Format ${part.slice(5)}`;
		return variantLabels[part] || part.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase()).replace(/[-_]/g, " ");
	}).join(" · ");
}
function recordKey(record) {
	return [record.cardId, record.language, record.variant.toLowerCase()].join("::");
}
function getRecord(cardId, language, variant) {
	return pokemonRecords.find(r => recordKey(r) === recordKey({cardId, language, variant}));
}
function cardImage(url, quality = "low") {
	return url ? `${url}/${quality}.png` : "./icons/pokemon-card-back.svg";
}
function applyCardImageFallback(image) {
	image.onerror = () => {
		image.onerror = null;
		image.src = "./icons/pokemon-card-back.svg";
	};
}
function showPokemonDetail() {
	pokemonReturnPanel = pokemonCurrentPanel;
	pokemonReturnScrollY = window.scrollY;
	p$("pokemonSearchPanel").classList.add("hidden");
	p$("pokemonRecordPanel").classList.add("hidden");
	p$("pokemonDetailView").classList.remove("hidden");
}
function hidePokemonDetail() {
	p$("pokemonDetailView").classList.add("hidden");
	p$("pokemonSearchPanel").classList.toggle("hidden", pokemonReturnPanel !== "search");
	p$("pokemonRecordPanel").classList.toggle("hidden", pokemonReturnPanel === "search");
	renderPokemonRecords();
	window.scrollTo({ top: pokemonReturnScrollY, behavior: "auto" });
}
function normalizeCardVariants(card, language) {
	const source = card.variants;
	const choices = [];
	const add = (value, label) => {
		if (!choices.some(choice => choice.value === value)) choices.push({ value, label });
	};
	if (Array.isArray(source)) {
		source.forEach(detail => {
			if (!detail || typeof detail !== "object") return;
			if (Array.isArray(detail.languages) && detail.languages.length && !detail.languages.includes(language)) return;
			const type = detail.type || "normal";
			const subtype = detail.subtype ? `|${detail.subtype}` : "";
			const size = detail.size ? `|size:${detail.size}` : "";
			const foil = detail.foil ? `|foil:${detail.foil}` : "";
			add(`${type}${subtype}${size}${foil}`, [formatVariant(type), detail.subtype, detail.size ? `Format ${detail.size}` : "", detail.foil ? `Effet ${detail.foil}` : ""].filter(Boolean).join(" · "));
			(Array.isArray(detail.stamp) ? detail.stamp : []).forEach(stamp => {
				add(`${type}${subtype}${size}${foil}|stamp:${stamp}`, [formatVariant(type), detail.subtype, detail.size ? `Format ${detail.size}` : "", detail.foil ? `Effet ${detail.foil}` : "", formatVariant(stamp)].filter(Boolean).join(" · "));
			});
		});
	} else if (source && typeof source === "object") {
		const legacyNames = {
			normal: "normal", holo: "holo", reverse: "reverse", metal: "metal", lenticular: "lenticular",
			firstEdition: "firstEdition", wPromo: "wPromo", preRelease: "preRelease", jumbo: "jumbo"
		};
		Object.entries(legacyNames).forEach(([key, value]) => {
			if (source[key] === true) add(value, formatVariant(value));
		});
	}
	return choices.length ? choices : [{ value: "normal", label: "Standard (non précisé par le catalogue)" }];
}
function renderPokemonRecords() {
	const owned = pokemonRecords.filter(r => Number(r.quantity) > 0);
	const wanted = pokemonRecords.filter(r => r.wanted);
	p$("pokemonOwnedCount").textContent = owned.length;
	p$("pokemonWantedCount").textContent = wanted.length;
	renderCategoryTools("owned");
	renderCategoryTools("wanted");
	p$("pokemonOwnedList").innerHTML = renderRecordList(filterByCategory(owned, "owned"), "Aucune carte possédée pour le moment.", "owned");
	p$("pokemonWantedList").innerHTML = renderRecordList(filterByCategory(wanted, "wanted"), "Aucune carte recherchée pour le moment.", "wanted");
	const detailIsOpen = !p$("pokemonDetailView").classList.contains("hidden");
	p$("pokemonSearchPanel").classList.toggle("hidden", pokemonCurrentPanel !== "search" || detailIsOpen);
	p$("pokemonRecordPanel").classList.toggle("hidden", pokemonCurrentPanel === "search" || detailIsOpen);
	p$("pokemonOwnedList").classList.toggle("hidden", pokemonCurrentPanel !== "owned");
	p$("pokemonWantedList").classList.toggle("hidden", pokemonCurrentPanel !== "wanted");
	p$("showPokemonSearch").classList.toggle("active", pokemonCurrentPanel === "search");
	p$("showOwnedPokemon").classList.toggle("active", pokemonCurrentPanel === "owned");
	p$("showWantedPokemon").classList.toggle("active", pokemonCurrentPanel === "wanted");
	renderSelectedVersions();
}
function filterByCategory(records, type) {
	const selected = pokemonCategoryFilter[type];
	if (selected === "all") return records;
	if (selected === "unassigned") return records.filter(record => !record[`${type}CategoryId`]);
	return records.filter(record => record[`${type}CategoryId`] === selected);
}
function renderCategoryTools(type) {
	const categories = pokemonCategories[type];
	const box = p$(`pokemon${type === "owned" ? "Owned" : "Wanted"}Categories`);
	const tools = p$(`pokemon${type === "owned" ? "Owned" : "Wanted"}Tools`);
	if (!box || !tools) return;
	tools.classList.toggle("hidden", pokemonCurrentPanel !== type);
	box.innerHTML = [
		`<button type="button" class="category-chip ${pokemonCategoryFilter[type] === "all" ? "active" : ""}" data-category-filter="all">Toutes</button>`,
		...categories.map(category => `<button type="button" class="category-chip ${pokemonCategoryFilter[type] === category.id ? "active" : ""}" data-category-filter="${pEscape(category.id)}">${pEscape(category.name)}</button>`),
		`<button type="button" class="category-chip ${pokemonCategoryFilter[type] === "unassigned" ? "active" : ""}" data-category-filter="unassigned">Sans liste</button>`
	].join("");
	box.querySelectorAll("[data-category-filter]").forEach(button => button.addEventListener("click", () => {
		pokemonCategoryFilter[type] = button.dataset.categoryFilter;
		renderPokemonRecords();
	}));
}
function renderRecordList(records, emptyMessage, type = pokemonCurrentPanel) {
	if (!records.length) return `<div class="empty-state small-empty">${emptyMessage}</div>`;
	const groups = new Map();
	records.forEach(record => {
		const key = `${record.cardId}::${record.language}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(record);
	});
	const renderGroup = group => {
		const first = group[0];
		return `<button type="button" class="pokemon-record pokemon-record-group pokemon-record-image-only" data-open-record-button="${pEscape(first.cardId)}" data-record-language="${pEscape(first.language)}" aria-label="Voir ${pEscape(first.name)}">
			<img src="${pEscape(cardImage(first.image))}" alt="${pEscape(first.name)}" loading="lazy" class="fallback-card-image">
		</button>`;
	};
	const selectedType = type;
	const allCategories = pokemonCategories[selectedType] || [];
	if (selectedType === "search" || pokemonCategoryFilter[selectedType] !== "all") return [...groups.values()].map(renderGroup).join("");
	const sections = allCategories.map(category => {
		const categoryRecords = records.filter(record => record[`${selectedType}CategoryId`] === category.id);
		const categoryGroups = new Map();
		categoryRecords.forEach(record => {
			const key = `${record.cardId}::${record.language}`;
			if (!categoryGroups.has(key)) categoryGroups.set(key, []);
			categoryGroups.get(key).push(record);
		});
		return `<section class="record-category-section"><h3>${pEscape(category.name)}</h3>${categoryGroups.size ? [...categoryGroups.values()].map(renderGroup).join("") : '<p class="category-empty">Aucune carte dans cette liste.</p>'}</section>`;
	}).join("");
	const unassigned = records.filter(record => !record[`${selectedType}CategoryId`]);
	const unassignedGroups = new Map();
	unassigned.forEach(record => {
		const key = `${record.cardId}::${record.language}`;
		if (!unassignedGroups.has(key)) unassignedGroups.set(key, []);
		unassignedGroups.get(key).push(record);
	});
	const unassignedSection = `<section class="record-category-section"><h3>Sans liste</h3>${unassignedGroups.size ? [...unassignedGroups.values()].map(renderGroup).join("") : '<p class="category-empty">Aucune carte sans liste.</p>'}</section>`;
	return sections + unassignedSection;
}
function renderSelectedVersions() {
	const box = p$("selectedCardVersions");
	if (!box || !selectedPokemonCard) return;
	const rows = pokemonRecords.filter(r => r.cardId === selectedPokemonCard.id && r.language === pokemonCardLanguage);
	box.innerHTML = rows.length ? rows.map(record => `<div class="saved-version-detail"><span><strong>${pEscape(formatVariant(record.variant))}</strong><small>Quantité possédée : ${Number(record.quantity) || 0}${record.wanted ? " · Également recherchée" : ""}</small></span></div>`).join("") : '<div class="empty-state small-empty">Aucune version enregistrée pour cette carte.</div>';
}
function bindRecordActions(root) {
	root.querySelectorAll("[data-record-delete]").forEach(btn => btn.addEventListener("click", () => {
		const record = pokemonRecords.find(r => recordKey(r) === btn.dataset.recordDelete);
		if (!record || !confirm(`Supprimer ${record.name} — ${record.variant} ?`)) return;
		pokemonRecords = pokemonRecords.filter(r => recordKey(r) !== btn.dataset.recordDelete);
		savePokemonRecords(); renderPokemonRecords(); pokemonToast("Version supprimée");
	}));
	root.querySelectorAll(".fallback-card-image").forEach(applyCardImageFallback);
	root.querySelectorAll("[data-open-record-button]").forEach(btn => btn.addEventListener("click", () => {
		loadPokemonCard(btn.dataset.openRecordButton, btn.dataset.recordLanguage);
	}));
	root.querySelectorAll("[data-record-edit]").forEach(btn => btn.addEventListener("click", () => {
		const record = pokemonRecords.find(r => recordKey(r) === btn.dataset.recordEdit);
		if (!record) return;
		pokemonLanguage = record.language;
		pokemonCardLanguage = record.language;
		pokemonCurrentPanel = root.id === "pokemonWantedList" ? "wanted" : root.id === "pokemonOwnedList" ? "owned" : pokemonCurrentPanel;
		renderPokemonRecords();
		document.querySelectorAll("[data-language]").forEach(b => b.classList.toggle("active", b.dataset.language === pokemonLanguage));
		selectedPokemonCard = {id:record.cardId,name:record.name,image:record.image,localId:record.localId,seriesName:record.seriesName || "",rarity:record.rarity || "",illustrator:record.illustrator || "",set:{id:record.setId,name:record.setName}};
		selectedPokemonDetails = null;
		showPokemonDetail();
		fillPokemonCategorySelects();
		p$("selectedCardName").textContent = record.name;
		p$("selectedCardMeta").textContent = `${record.setName || "Extension"} · ${record.localId || ""} · ${languageNames[record.language]}`;
		p$("selectedCardDetails").innerHTML = `<p><strong>Illustrateur :</strong> ${pEscape(record.illustrator || "Non renseigné par TCGdex")}</p><p><strong>Extension :</strong> ${pEscape(record.setName || "Inconnue")}</p><p><strong>Rareté :</strong> ${pEscape(record.rarity || "Non renseignée")}</p>`;
		p$("pokemonAddForm").classList.remove("hidden");
		p$("showPokemonAddForm").classList.add("hidden");
		p$("selectedCardImage").src = cardImage(record.image, "high");
		p$("selectedCardImage").classList.remove("hidden");
		applyCardImageFallback(p$("selectedCardImage"));
		p$("pokemonVariant").innerHTML = `<option value="${pEscape(record.variant)}">${pEscape(formatVariant(record.variant))}</option>`;
		p$("pokemonOwnedCategory").value = record.ownedCategoryId || "";
		p$("pokemonWantedCategory").value = record.wantedCategoryId || "";
		p$("pokemonCustomVariant").value = "";
		p$("pokemonOwnedQty").value = Number(record.quantity) || 0;
		p$("pokemonWanted").checked = Boolean(record.wanted);
		p$("pokemonSelected").classList.remove("hidden");
		p$("pokemonDetailView").scrollIntoView({behavior:"smooth",block:"start"});
	}));
}
async function searchPokemonCards() {
	const name = p$("pokemonSearch").value.trim();
	const set = p$("pokemonSetFilter").value.trim();
	const number = p$("pokemonNumberFilter").value.trim();
	const illustrator = p$("pokemonIllustratorFilter").value.trim();
	if (!name && !set && !number && !illustrator) { pokemonToast("Indique au moins un nom, une extension ou un numéro."); return; }
	const sequence = ++pokemonSearchSequence;
	const results = p$("pokemonResults");
	results.innerHTML = '<div class="empty-state">Recherche en cours…</div>';
	p$("pokemonResultCount").textContent = "…";
	const buildUrl = language => {
		const params = new URLSearchParams();
		if (name) params.set("name", name);
		if (set) params.set("set", set);
		if (number) params.set("localId", number);
		if (illustrator) params.set("illustrator", illustrator);
		params.set("pagination:page", "1");
		params.set("pagination:itemsPerPage", "40");
		return `${POKEMON_API}/${language}/cards?${params.toString()}`;
	};
	try {
		let response = await fetch(buildUrl(pokemonLanguage));
		if (!response.ok) throw new Error("Catalogue indisponible");
		let cards = await response.json();
		let resultLanguage = pokemonLanguage;
		// En japonais, TCGdex attend généralement le nom japonais. Si l'utilisateur saisit
		// un nom latin, on tente aussi le catalogue anglais puis on conserve la langue réelle.
		if (!cards.length && pokemonLanguage === "ja" && /[a-z]/i.test(name)) {
			// Pour un nom latin (ex. Ponyta), chercher d'abord son nom japonais.
			try {
				const speciesSlug = name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/['’]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
				const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(speciesSlug)}`);
				if (speciesResponse.ok) {
					const species = await speciesResponse.json();
					const japaneseName = species.names?.find(entry => entry.language?.name === "ja")?.name;
					if (japaneseName) {
						const japaneseParams = new URLSearchParams();
						japaneseParams.set("name", japaneseName);
						if (set) japaneseParams.set("set", set);
						if (number) japaneseParams.set("localId", number);
						if (illustrator) japaneseParams.set("illustrator", illustrator);
						japaneseParams.set("pagination:page", "1");
						japaneseParams.set("pagination:itemsPerPage", "40");
						const japaneseResponse = await fetch(`${POKEMON_API}/ja/cards?${japaneseParams.toString()}`);
						if (japaneseResponse.ok) {
							cards = await japaneseResponse.json();
							if (cards.length) resultLanguage = "ja";
						}
					}
				}
			} catch {
				// La recherche japonaise reste disponible si PokeAPI est momentanément inaccessible.
			}
			if (!cards.length) {
				response = await fetch(buildUrl("en"));
				if (response.ok) {
					cards = await response.json();
					resultLanguage = "en";
				}
			}
		}
		if (sequence !== pokemonSearchSequence) return;
		p$("pokemonResultCount").textContent = `${cards.length} carte${cards.length > 1 ? "s" : ""}`;
		if (!cards.length) {
			results.innerHTML = '<div class="empty-state">Aucune carte trouvée. Essaie un nom dans la langue sélectionnée ou retire un filtre ♡</div>';
			return;
		}
		results.innerHTML = cards.map(card => `<button type="button" class="pokemon-result pokemon-result-image-only" data-card-id="${pEscape(card.id)}" data-card-language="${resultLanguage}" aria-label="Voir ${pEscape(card.name)}">
			<img src="${pEscape(cardImage(card.image))}" alt="${pEscape(card.name)}" loading="lazy" class="fallback-card-image"></button>`).join("");
		results.querySelectorAll(".fallback-card-image").forEach(applyCardImageFallback);
		results.querySelectorAll("[data-card-id]").forEach(btn => btn.addEventListener("click", () => loadPokemonCard(btn.dataset.cardId, btn.dataset.cardLanguage)));
	} catch {
		if (sequence !== pokemonSearchSequence) return;
		results.innerHTML = '<div class="empty-state">Impossible de joindre le catalogue pour le moment.<br>Vérifie ta connexion Internet puis réessaie.</div>';
		p$("pokemonResultCount").textContent = "0 carte";
	}
}
async function loadPokemonCard(cardId, language = pokemonLanguage) {
	const results = p$("pokemonResults");
	results.querySelectorAll(".pokemon-result").forEach(b => b.classList.toggle("selected", b.dataset.cardId === cardId));
	showPokemonDetail();
	p$("pokemonAddForm").classList.add("hidden");
	p$("showPokemonAddForm").classList.remove("hidden");
	p$("selectedCardDetails").textContent = "";
	p$("selectedCardName").textContent = "Chargement de la carte…";
	pokemonCardLanguage = language;
	try {
		let response = await fetch(`${POKEMON_API}/${language}/cards/${encodeURIComponent(cardId)}`);
		let actualLanguage = language;
		if (!response.ok && language !== "en") {
			const fallbackResponse = await fetch(`${POKEMON_API}/en/cards/${encodeURIComponent(cardId)}`);
			if (!fallbackResponse.ok) throw new Error("Carte indisponible");
			response = fallbackResponse;
			actualLanguage = "en";
		}
		const card = await response.json();
		pokemonCardLanguage = actualLanguage;
		selectedPokemonCard = card;
		selectedPokemonDetails = card;
		p$("selectedCardName").textContent = card.name;
		p$("selectedCardMeta").textContent = `${card.set?.name || "Extension inconnue"} · N° ${card.localId || "?"} · ${card.rarity || "Rareté non renseignée"} · ${languageNames[pokemonCardLanguage] || pokemonCardLanguage}`;
		p$("selectedCardDetails").innerHTML = `<p><strong>Illustrateur :</strong> ${pEscape(card.illustrator || "Non renseigné par TCGdex")}</p><p><strong>Type :</strong> ${pEscape(card.types?.join(", ") || "Non renseigné")}</p><p><strong>Rareté :</strong> ${pEscape(card.rarity || "Non renseignée")}</p><p><strong>Extension :</strong> ${pEscape(card.set?.name || "Inconnue")}</p>`;
		p$("pokemonAddForm").classList.add("hidden");
		p$("showPokemonAddForm").classList.remove("hidden");
		const image = p$("selectedCardImage");
		image.src = cardImage(card.image, "high");
		image.classList.remove("hidden");
		applyCardImageFallback(image);
		const choices = normalizeCardVariants(card, pokemonCardLanguage);
		p$("pokemonVariant").innerHTML = choices.map(choice => `<option value="${pEscape(choice.value)}">${pEscape(choice.label)}</option>`).join("");
		fillPokemonCategorySelects();
		p$("pokemonCustomVariant").value = "";
		const existing = getRecord(card.id,pokemonCardLanguage,p$("pokemonVariant").value);
		p$("pokemonOwnedQty").value = existing?.quantity || 0;
		p$("pokemonWanted").checked = Boolean(existing?.wanted);
		p$("pokemonOwnedCategory").value = existing?.ownedCategoryId || "";
		p$("pokemonWantedCategory").value = existing?.wantedCategoryId || "";
		if (card.set?.id) {
			try {
				const setResponse = await fetch(`${POKEMON_API}/${pokemonCardLanguage}/sets/${encodeURIComponent(card.set.id)}`);
				if (setResponse.ok) {
					const setDetails = await setResponse.json();
					if (selectedPokemonCard?.id === card.id) {
						selectedPokemonCard.seriesName = setDetails.serie?.name || "";
						p$("selectedCardMeta").textContent = `${selectedPokemonCard.seriesName ? selectedPokemonCard.seriesName + " · " : ""}${card.set?.name || "Extension inconnue"} · N° ${card.localId || "?"} · ${card.rarity || "Rareté non renseignée"} · ${languageNames[pokemonCardLanguage] || pokemonCardLanguage}`;
						renderSelectedVersions();
					}
				}
			} catch { /* Les détails de série sont facultatifs : la carte reste utilisable. */ }
		}
		renderSelectedVersions();
		p$("pokemonDetailView").scrollIntoView({behavior:"smooth",block:"start"});
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
		setId:selectedPokemonCard.set?.id || "", rarity:selectedPokemonCard.rarity || "", illustrator:selectedPokemonCard.illustrator || "", language:pokemonCardLanguage,
		variant, quantity, wanted,
		ownedCategoryId:p$("pokemonOwnedCategory").value || "",
		wantedCategoryId:p$("pokemonWantedCategory").value || ""
	};
	const index = pokemonRecords.findIndex(r => recordKey(r) === recordKey(record));
	if (quantity === 0 && !wanted) {
		if (index >= 0) pokemonRecords.splice(index,1);
	} else if (index >= 0) pokemonRecords[index] = record;
	else pokemonRecords.push(record);
	savePokemonRecords(); renderPokemonRecords();
	pokemonToast(quantity > 0 ? "Carte ajoutée à tes possédées ♡" : wanted ? "Version ajoutée à tes recherches ♡" : "Version retirée de tes listes");
}

function fillPokemonCategorySelects() {
	const fill = (id, type) => {
		const select = p$(id);
		const current = select.value;
		select.innerHTML = `<option value="">Sans liste</option>` + pokemonCategories[type].map(category => `<option value="${pEscape(category.id)}">${pEscape(category.name)}</option>`).join("");
		select.value = current;
	};
	fill("pokemonOwnedCategory", "owned");
	fill("pokemonWantedCategory", "wanted");
}
function addPokemonCategory(type) {
	const prefix = type === "owned" ? "Owned" : "Wanted";
	const input = p$(`pokemon${prefix}CategoryName`);
	const name = input.value.trim();
	if (!name) { pokemonToast("Donne un nom à cette liste."); return; }
	if (pokemonCategories[type].some(category => category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
		pokemonToast("Cette liste existe déjà.");
		return;
	}
	const category = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name };
	pokemonCategories[type].push(category);
	savePokemonCategories();
	input.value = "";
	fillPokemonCategorySelects();
	p$(`pokemon${prefix}Category`).value = category.id;
	renderPokemonRecords();
	pokemonToast("Liste créée ♡");
}
p$("addPokemonOwnedCategory").addEventListener("click", () => addPokemonCategory("owned"));
p$("addPokemonWantedCategory").addEventListener("click", () => addPokemonCategory("wanted"));
fillPokemonCategorySelects();

p$("showPokemonSearch").addEventListener("click", () => { pokemonCurrentPanel = "search"; p$("pokemonDetailView").classList.add("hidden"); renderPokemonRecords(); });
p$("showOwnedPokemon").addEventListener("click", () => { pokemonActiveList = "owned"; pokemonCurrentPanel = "owned"; p$("pokemonDetailView").classList.add("hidden"); renderPokemonRecords(); });
p$("showWantedPokemon").addEventListener("click", () => { pokemonActiveList = "wanted"; pokemonCurrentPanel = "wanted"; p$("pokemonDetailView").classList.add("hidden"); renderPokemonRecords(); });
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
	p$("pokemonDetailView").classList.add("hidden");
	p$("pokemonSearchPanel").classList.remove("hidden");
	selectedPokemonCard = null;
}));
p$("closeSelectedCard").addEventListener("click", hidePokemonDetail);
p$("pokemonDetailBack").addEventListener("click", hidePokemonDetail);
p$("savePokemonVersion").addEventListener("click", saveSelectedPokemonVersion);
p$("showPokemonAddForm").addEventListener("click", () => { p$("pokemonAddForm").classList.remove("hidden"); p$("showPokemonAddForm").classList.add("hidden"); });
p$("pokemonVariant").addEventListener("change", () => {
	if (!selectedPokemonCard) return;
	const existing = getRecord(selectedPokemonCard.id,pokemonCardLanguage,p$("pokemonVariant").value);
	p$("pokemonOwnedQty").value = existing?.quantity || 0;
	p$("pokemonWanted").checked = Boolean(existing?.wanted);
	p$("pokemonOwnedCategory").value = existing?.ownedCategoryId || "";
	p$("pokemonWantedCategory").value = existing?.wantedCategoryId || "";
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
