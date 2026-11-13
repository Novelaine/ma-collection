const STORAGE_KEY = "ma-collection-v1";
let collections = loadCollections();
let activeId = null;
let editingCollectionId = null;
let editingItemId = null;
let toastTimer;
let pendingItemPhoto = "";

const $ = (id) => document.getElementById(id);
const homeView = $("homeView");
const detailView = $("detailView");

function loadCollections() {
	try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
	catch { return []; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(collections)); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }
function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function showToast(message) {
	$("toast").textContent = message;
	$("toast").classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2300);
}
function getActive() { return collections.find(c => c.id === activeId); }
function render() {
	if (activeId && getActive()) { homeView.classList.add("hidden"); detailView.classList.remove("hidden"); renderDetail(); }
	else { activeId = null; detailView.classList.add("hidden"); homeView.classList.remove("hidden"); renderHome(); }
}
function renderHome() {
	$("collectionCount").textContent = `${collections.length} ${collections.length > 1 ? "listes" : "liste"}`;
	const grid = $("collectionGrid");
	if (!collections.length) {
		grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">♡<br>Ton espace est encore vide.<br>Crée ta première collection pour commencer !</div>';
		return;
	}
	grid.innerHTML = collections.map(c => {
		const total = c.items.length, done = c.items.filter(i => i.done).length;
		const pct = total ? Math.round(done / total * 100) : 0;
		return `<button class="collection-card" data-open="${c.id}">
			<span class="collection-emoji">${escapeHtml(c.emoji)}</span>
			<span class="collection-name">${escapeHtml(c.name)}</span>
			<span class="collection-meta">${done} trouvé${done>1?"s":""} · ${Math.max(0,total-done)} restant${total-done>1?"s":""}</span>
			<span class="card-progress"><span style="width:${pct}%"></span></span>
		</button>`;
	}).join("");
	grid.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => { activeId = btn.dataset.open; render(); }));
}
function renderDetail() {
	const c = getActive(); if (!c) return render();
	const total = c.items.length, done = c.items.filter(i => i.done).length;
	const pct = total ? Math.round(done / total * 100) : 0;
	$("detailTitle").textContent = `${c.emoji} ${c.name}`;
	$("detailSubtitle").textContent = `${total} élément${total>1?"s":""} dans cette collection`;
	$("progressPercent").textContent = `${pct} %`;
	$("progressFill").style.width = `${pct}%`;
	$("progressText").textContent = `${done} élément${done>1?"s":""} trouvé${done>1?"s":""} sur ${total}`;
	const list = $("itemsList");
	if (!total) { list.innerHTML = '<div class="empty-state">Ta liste est vide pour le moment.<br>Ajoute le premier élément à rechercher ♡</div>'; return; }
	const sorted = [...c.items].sort((a,b) => Number(a.done)-Number(b.done));
	list.innerHTML = sorted.map(item => `<div class="item-row ${item.done?"done":""}">
		<input class="item-check" type="checkbox" aria-label="Marquer ${escapeHtml(item.name)} comme trouvé" data-check="${item.id}" ${item.done?"checked":""}>
		${item.photo ? `<img class="item-row-photo" src="${escapeHtml(item.photo)}" alt="Photo de ${escapeHtml(item.name)}">` : ""}
		<div class="item-copy"><div class="item-name">${escapeHtml(item.name)}</div>${item.note?`<div class="item-note">${escapeHtml(item.note)}</div>`:""}</div>
		<div class="item-actions"><button class="mini-button" data-edit="${item.id}" aria-label="Modifier">✎</button><button class="mini-button" data-delete="${item.id}" aria-label="Supprimer">×</button></div>
	</div>`).join("");
	list.querySelectorAll("[data-check]").forEach(el => el.addEventListener("change", () => {
		const item = c.items.find(i => i.id === el.dataset.check); if (item) { item.done = el.checked; save(); renderDetail(); }
	}));
	list.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => openItemDialog(el.dataset.edit)));
	list.querySelectorAll("[data-delete]").forEach(el => el.addEventListener("click", () => deleteItem(el.dataset.delete)));
}
function openCollectionDialog(id=null) {
	editingCollectionId = id;
	const c = id ? collections.find(x=>x.id===id) : null;
	$("collectionDialogTitle").textContent = c ? "Modifier la collection" : "Nouvelle collection";
	$("collectionName").value = c?.name || "";
	$("collectionEmoji").value = c?.emoji || "💎";
	document.querySelectorAll(".emoji-choice").forEach(b => b.classList.toggle("selected", b.textContent === $("collectionEmoji").value));
	$("collectionDialog").showModal(); $("collectionName").focus();
}
function openItemDialog(id=null) {
	editingItemId = id;
	const item = id ? getActive().items.find(x=>x.id===id) : null;
	$("itemDialogTitle").textContent = item ? "Modifier l'élément" : "Ajouter un élément";
	$("itemName").value = item?.name || ""; $("itemNote").value = item?.note || "";
	pendingItemPhoto = item?.photo || "";
	$("itemPhoto").value = "";
	$("itemPhotoPreview").src = pendingItemPhoto;
	$("itemPhotoPreview").classList.toggle("hidden", !pendingItemPhoto);
	$("removeItemPhoto").classList.toggle("hidden", !pendingItemPhoto);
	$("itemDialog").showModal(); $("itemName").focus();
}
$("newCollectionBtn").addEventListener("click", () => openCollectionDialog());
$("editCollectionBtn").addEventListener("click", () => openCollectionDialog(activeId));
$("newItemBtn").addEventListener("click", () => openItemDialog());
$("backBtn").addEventListener("click", () => { activeId = null; render(); });
$("emojiChoices").addEventListener("click", e => {
	const b = e.target.closest(".emoji-choice"); if (!b) return;
	$("collectionEmoji").value = b.textContent;
	document.querySelectorAll(".emoji-choice").forEach(x=>x.classList.toggle("selected", x===b));
});
$("collectionForm").addEventListener("submit", e => {
	e.preventDefault(); const name = $("collectionName").value.trim(); if (!name) return;
	const existingCollection = editingCollectionId
		? collections.find(x => x.id === editingCollectionId)
		: null;

	if (existingCollection) {
		existingCollection.name = name;
		existingCollection.emoji = $("collectionEmoji").value;
	} else {
		// Aucune limite de nombre : chaque nouvelle collection reçoit son propre identifiant.
		collections.push({
			id: uid(),
			name,
			emoji: $("collectionEmoji").value,
			items: []
		});
		// Après création, revenir systématiquement à l'accueil.
		activeId = null;
	}

	editingCollectionId = null;
	save();
	$("collectionDialog").close();
	render();
	showToast("Collection enregistrée ♡");
});
async function compressItemPhoto(file) {
	if (!file || !file.type.startsWith("image/")) return "";
	if (file.size > 12 * 1024 * 1024) throw new Error("La photo doit faire moins de 12 Mo.");
	const source = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
	const image = await new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = source;
	});
	const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(image.width * scale);
	canvas.height = Math.round(image.height * scale);
	canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/jpeg", 0.78);
}
$("removeItemPhoto").addEventListener("click", () => {
	pendingItemPhoto = "";
	$("itemPhoto").value = "";
	$("itemPhotoPreview").src = "";
	$("itemPhotoPreview").classList.add("hidden");
	$("removeItemPhoto").classList.add("hidden");
});
$("itemPhoto").addEventListener("change", async e => {
	const file = e.target.files[0];
	if (!file) return;
	try {
		pendingItemPhoto = await compressItemPhoto(file);
		$("itemPhotoPreview").src = pendingItemPhoto;
		$("itemPhotoPreview").classList.remove("hidden");
		$("removeItemPhoto").classList.remove("hidden");
	} catch (error) {
		showToast(error.message || "Impossible de lire cette photo.");
		e.target.value = "";
	}
});
$("itemForm").addEventListener("submit", e => {
	e.preventDefault(); const name=$("itemName").value.trim(); if (!name) return;
	const c=getActive(); if (!c) return;
	const previousItems = c.items.map(item => ({ ...item }));
	if (editingItemId) {
		const item=c.items.find(x=>x.id===editingItemId);
		item.name=name; item.note=$("itemNote").value.trim(); item.photo=pendingItemPhoto;
	} else c.items.push({id:uid(),name,note:$("itemNote").value.trim(),done:false,photo:pendingItemPhoto});
	try {
		save(); $("itemDialog").close(); renderDetail(); showToast("Élément enregistré ♡");
	} catch {
		c.items = previousItems;
		showToast("Stockage presque plein : retire la photo ou choisis-en une plus légère.");
	}
});
function deleteItem(id) {
	const c=getActive(), item=c.items.find(x=>x.id===id); if (!item) return;
	if (!confirm(`Supprimer « ${item.name} » ?`)) return;
	c.items=c.items.filter(x=>x.id!==id); save(); renderDetail(); showToast("Élément supprimé");
}
$("deleteCollectionBtn").addEventListener("click", () => {
	const c=getActive(); if (!c) return;
	if (!confirm(`Supprimer la collection « ${c.name} » et tous ses éléments ?`)) return;
	collections=collections.filter(x=>x.id!==activeId); activeId=null; save(); render(); showToast("Collection supprimée");
});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
$("backupBtn").addEventListener("click", () => {
	const hasPokemonCards = window.getPokemonBackupData && window.getPokemonBackupData().length > 0;
	if (!collections.length && !hasPokemonCards) { showToast("Aucune collection à sauvegarder pour le moment."); return; }
	const backupData={app:"Ma Collection",version:2,exportedAt:new Date().toISOString(),collections};
	if (window.getPokemonBackupData) backupData.pokemonCards=window.getPokemonBackupData();
	const blob=new Blob([JSON.stringify(backupData,null,2)],{type:"application/json"});
	const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download="ma-collection-sauvegarde.json"; a.click(); URL.revokeObjectURL(url);
	showToast("Sauvegarde téléchargée ♡");
});
$("restoreBtn").addEventListener("click", () => $("restoreFile").click());
$("restoreFile").addEventListener("change",async e=>{
	const file=e.target.files[0]; if(!file)return;
	try{
		const data=JSON.parse(await file.text());
		if(!Array.isArray(data.collections)||!data.collections.every(c=>typeof c.name==="string"&&Array.isArray(c.items))) throw new Error();
		if(!confirm("Remplacer les collections actuelles par celles de cette sauvegarde ?")) return;
		collections=data.collections; save();
		// Les anciennes sauvegardes ne contiennent pas pokemonCards : on conserve alors les données Pokémon actuelles.
		if (Array.isArray(data.pokemonCards) && window.restorePokemonBackupData) window.restorePokemonBackupData(data.pokemonCards);
		activeId=null; render(); showToast("Sauvegarde restaurée ♡");
	}catch{alert("Ce fichier ne semble pas être une sauvegarde valide de Ma Collection.");}
	finally{e.target.value="";}
});
render();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
	window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}


/* Navigation tactile : un balayage horizontal ouvre l'écran voisin. */
(() => {
	let touchStartX = 0;
	let touchStartY = 0;
	const main = document.querySelector("main");
	main.addEventListener("touchstart", event => {
		const touch = event.changedTouches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
	}, { passive: true });
	main.addEventListener("touchend", event => {
		const touch = event.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		if (Math.abs(deltaX) < 85 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
		const pokemonVisible = !$("pokemonView").classList.contains("hidden");
		if (pokemonVisible && !$("pokemonDetailView").classList.contains("hidden")) {
			if (deltaX > 0) $("pokemonDetailBack").click();
			return;
		}
		if (pokemonVisible) {
			if (deltaX > 0) {
				if (pokemonCurrentPanel === "wanted") $("showOwnedPokemon").click();
				else if (pokemonCurrentPanel === "owned") $("showPokemonSearch").click();
				else $("pokemonBackBtn").click();
			} else {
				if (pokemonCurrentPanel === "search") $("showOwnedPokemon").click();
				else if (pokemonCurrentPanel === "owned") $("showWantedPokemon").click();
			}
			return;
		}
		if (!$("detailView").classList.contains("hidden") && deltaX > 0) $("backBtn").click();
		else if (!$("homeView").classList.contains("hidden") && deltaX < 0) $("openPokemonBtn").click();
	}, { passive: true });
})();
