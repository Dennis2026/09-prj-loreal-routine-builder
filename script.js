(() => {
  const categoryFilter = document.getElementById("categoryFilter");
  const productsContainer = document.getElementById("productsContainer");
  const selectedList = document.getElementById("selectedProductsList");
  const generateBtn = document.getElementById("generateRoutine");
  const chatForm = document.getElementById("chatForm");
  const chatWindow = document.getElementById("chatWindow");
  const searchInput = document.getElementById("productSearch");
  const rtlToggle = document.getElementById("rtlToggle");
  const WORKER_URL = "https://second-worker.dennisw2026.workers.dev/";

  let allProducts = [];
  let displayed = [];
  let selectedIds = new Set(loadFromStorage() || []);
  let chatHistory = [];

  async function init() {
    allProducts = (await fetch("products.json").then((r) => r.json())).products;
    bindEvents();
    filterAndDisplay();
  }

  function bindEvents() {
    categoryFilter.addEventListener("change", filterAndDisplay);
    searchInput.addEventListener("input", filterAndDisplay);
    rtlToggle.addEventListener("change", () => {
      document.documentElement.dir = rtlToggle.checked ? "rtl" : "ltr";
    });
    generateBtn.addEventListener("click", handleGenerateRoutine);
    chatForm.addEventListener("submit", handleFollowUp);
    renderSelectedList();
  }

  function filterAndDisplay() {
    const cat = categoryFilter.value;
    const term = searchInput.value.toLowerCase();

    displayed = allProducts.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        (!term || p.name.toLowerCase().includes(term))
    );

    displayProducts(displayed);
  }

  function displayProducts(products) {
    if (!products.length) {
      productsContainer.innerHTML = `<div class="placeholder-message">No products found</div>`;
      return;
    }
    productsContainer.innerHTML = products
      .map(
        (p) => `
      <div class="product-card ${
        selectedIds.has(p.id) ? "selected" : ""
      }" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <div class="product-info">
          <h3>${p.name}</h3>
          <p>${p.brand}</p>
          <button class="desc-btn">Info</button>
        </div>
      </div>
    `
      )
      .join("");

    document.querySelectorAll(".product-card").forEach((card) => {
      const id = +card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".desc-btn")) return;
        toggleSelection(id, card);
      });
      card.querySelector(".desc-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        const prod = allProducts.find((p) => p.id === id);
        showDescriptionModal(prod.name, prod.description);
      });
    });
  }

  function toggleSelection(id, cardEl) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      cardEl.classList.remove("selected");
    } else {
      selectedIds.add(id);
      cardEl.classList.add("selected");
    }
    saveToStorage([...selectedIds]);
    renderSelectedList();
  }

  function renderSelectedList() {
    const items = Array.from(selectedIds).map((id) => {
      const p = allProducts.find((x) => x.id === id);
      return `<div class="selected-item" data-id="${id}">
        ${p.name}
        <button class="remove-btn">&times;</button>
      </div>`;
    });
    selectedList.innerHTML =
      items.join("") +
      (items.length ? `<button id="clearAll">Clear All</button>` : "");

    selectedList.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = +e.target.closest(".selected-item").dataset.id;
        selectedIds.delete(id);
        saveToStorage([...selectedIds]);
        renderSelectedList();
        filterAndDisplay();
      });
    });
    const clearAll = selectedList.querySelector("#clearAll");
    if (clearAll)
      clearAll.addEventListener("click", () => {
        selectedIds.clear();
        saveToStorage([]);
        renderSelectedList();
        filterAndDisplay();
      });
  }

  function showDescriptionModal(title, text) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "description-modal";
    modal.innerHTML = `
      <button id="closeModal">&times;</button>
      <h3>${title}</h3>
      <p>${text}</p>`;
    document.body.append(overlay, modal);
    document.getElementById("closeModal").onclick = () => {
      overlay.remove();
      modal.remove();
    };
  }

  async function handleGenerateRoutine() {
    if (!selectedIds.size) return alert("Select at least one product!");
    const payload = {
      type: "generate_routine",
      products: [...selectedIds].map((id) => {
        const { name, brand, category, description } = allProducts.find(
          (p) => p.id === id
        );
        return { name, brand, category, description };
      }),
      history: [],
    };
    await sendToWorker(payload);
  }

  async function handleFollowUp(e) {
    e.preventDefault();
    const userMsg = chatForm.userInput.value.trim();
    if (!userMsg) return;
    appendChat("user", userMsg);
    chatForm.userInput.value = "";
    await sendToWorker({
      type: "follow_up",
      message: userMsg,
      history: chatHistory,
    });
  }

  async function sendToWorker(payload) {
    payload.history = chatHistory;
    payload.web_search = true;

    appendChat("system", "Thinking…");
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      removeSystemThinking();
      appendChat("bot", data.reply, data.citations);
    } catch (err) {
      removeSystemThinking();
      appendChat("bot", "⚠️ Oops, something went wrong.");
      console.error(err);
    }
  }

  function appendChat(role, text, citations = []) {
    if (role !== "system") {
      chatHistory.push({ role, content: text });
    }
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML =
      `<p>${text}</p>` +
      (citations.length
        ? `<div class="citations">${citations
            .map((c) => `<a href="${c.url}" target="_blank">${c.source}</a>`)
            .join(" · ")}</div>`
        : "");
    chatWindow.append(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function removeSystemThinking() {
    const sys = chatWindow.querySelector(".message.system");
    if (sys) sys.remove();
  }

  function saveToStorage(arr) {
    localStorage.setItem("selectedProducts", JSON.stringify(arr));
  }
  function loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem("selectedProducts"));
    } catch {
      return [];
    }
  }

  init();
})();
