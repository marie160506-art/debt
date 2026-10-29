const STORAGE_KEY = "sari-sari-store-products";
const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const form = document.querySelector("#product-form");
const nameInput = document.querySelector("#product-name");
const priceInput = document.querySelector("#product-price");
const searchInput = document.querySelector("#search");
const productList = document.querySelector("#product-list");
const emptyMessage = document.querySelector("#empty-message");
const statusMessage = document.querySelector("#status");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-button");

let products = loadProducts();
let editingId = null;

function loadProducts() {
  try {
    const savedProducts = localStorage.getItem(STORAGE_KEY);
    if (!savedProducts) {
      return [];
    }

    const parsedProducts = JSON.parse(savedProducts);
    if (!Array.isArray(parsedProducts)) {
      throw new Error("Saved product data is not a list.");
    }
    return parsedProducts;
  } catch (error) {
    console.error("Could not load saved products.", error);
    setStatus("Could not load products from this browser.", true);
    return [];
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("status-error", isError);
}

function saveProducts(nextProducts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProducts));
    return true;
  } catch (error) {
    console.error("Could not save products in this browser.", error);
    setStatus("Could not save products in this browser.", true);
    return false;
  }
}

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleProducts = products.filter((product) =>
    product.name.toLocaleLowerCase().includes(query)
  );

  productList.replaceChildren();

  for (const product of visibleProducts) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const priceCell = document.createElement("td");
    const actionsCell = document.createElement("td");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    nameCell.textContent = product.name;
    priceCell.className = "price";
    priceCell.textContent = peso.format(product.price);
    actionsCell.className = "actions";

    editButton.type = "button";
    editButton.className = "secondary";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", `Edit ${product.name}`);
    editButton.addEventListener("click", () => editProduct(product.id));

    deleteButton.type = "button";
    deleteButton.className = "secondary";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${product.name}`);
    deleteButton.addEventListener("click", () => deleteProduct(product.id));

    actionsCell.append(editButton, deleteButton);
    row.append(nameCell, priceCell, actionsCell);
    productList.append(row);
  }

  emptyMessage.hidden = visibleProducts.length > 0;
  emptyMessage.textContent = products.length === 0
    ? "No products yet. Add your first product above."
    : "No products match your search.";
}

function resetForm() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Add a product";
  saveButton.textContent = "Add product";
}

function editProduct(id) {
  const product = products.find((entry) => entry.id === id);
  if (!product) {
    setStatus("That product could not be found.", true);
    return;
  }

  editingId = id;
  nameInput.value = product.name;
  priceInput.value = product.price;
  formTitle.textContent = "Edit product";
  saveButton.textContent = "Save changes";
  nameInput.focus();
}

function deleteProduct(id) {
  const updatedProducts = products.filter((product) => product.id !== id);
  if (saveProducts(updatedProducts)) {
    products = updatedProducts;
    if (editingId === id) {
      resetForm();
    }
    renderProducts();
    setStatus("Product deleted.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const price = Number(priceInput.value);
  if (!name || !Number.isFinite(price) || price <= 0 || price > 99999999.99) {
    setStatus("Enter a product name and a valid price greater than ₱0.", true);
    return;
  }

  const roundedPrice = Math.round(price * 100) / 100;
  const wasEditing = editingId !== null;
  const updatedProducts = editingId === null
    ? [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        price: roundedPrice,
      }, ...products]
    : products.map((product) => product.id === editingId
      ? { ...product, name, price: roundedPrice }
      : product);

  if (saveProducts(updatedProducts)) {
    products = updatedProducts;
    resetForm();
    renderProducts();
    setStatus(wasEditing ? "Product updated." : "Product added.");
  }
});

searchInput.addEventListener("input", renderProducts);
renderProducts();
