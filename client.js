
const STORAGE_KEY = "sari-sari-store-debts";
const PRODUCTS_STORAGE_KEY = "sari-sari-store-products";
const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const form = document.querySelector("#debt-form");
const nameInput = document.querySelector("#customer-name");
const itemsContainer = document.querySelector("#borrowed-items");
const addItemButton = document.querySelector("#add-item");
const newDebtTotal = document.querySelector("#new-debt-total");
const searchInput = document.querySelector("#search");
const debtList = document.querySelector("#debt-list");
const paymentHistoryList = document.querySelector("#payment-history");
const paymentHistoryEmpty = document.querySelector("#payment-history-empty");
const emptyMessage = document.querySelector("#empty-message");
const totalDebt = document.querySelector("#total-debt");
const customerCount = document.querySelector("#customer-count");
const connectionStatus = document.querySelector("#connection-status");

function loadProducts() {
  try {
    const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!savedProducts) {
      return [];
    }
    const parsedProducts = JSON.parse(savedProducts);
    if (!Array.isArray(parsedProducts)) {
      throw new Error("Saved product data is not a list.");
    }
    return parsedProducts.filter((product) =>
      typeof product.id === "string"
      && typeof product.name === "string"
      && Number.isFinite(Number(product.price))
      && Number(product.price) > 0
    );
  } catch (error) {
    console.error("Could not load saved product prices.", error);
    setConnectionStatus("Could not load your product prices.", true);
    return [];
  }
}

let products = loadProducts();

function loadDebts() {
  try {
    const savedDebts = localStorage.getItem(STORAGE_KEY);
    if (!savedDebts) {
      return [];
    }

    const parsedDebts = JSON.parse(savedDebts);
    if (!Array.isArray(parsedDebts)) {
      throw new Error("Saved debt data is not a list.");
    }
    return parsedDebts.map((debt) => {
      if (Array.isArray(debt.items)) {
        return {
          ...debt,
          paidAmount: Number.isFinite(Number(debt.paidAmount))
            ? Math.max(0, Number(debt.paidAmount))
            : 0,
          payments: Array.isArray(debt.payments) ? debt.payments : [],
          items: debt.items.map((item) => ({
            name: item.name,
            unitPrice: item.unitPrice ?? item.price ?? null,
            quantity: Number.isInteger(item.quantity) ? item.quantity : 1,
          })),
        };
      }

      const oldItems = typeof debt.items === "string"
        ? debt.items
        : typeof debt.note === "string"
          ? debt.note
          : "";
      return {
        ...debt,
        paidAmount: 0,
        payments: [],
        items: oldItems
          .split(/\r?\n/)
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ name, unitPrice: null, quantity: 1 })),
      };
    });
  } catch (error) {
    console.error("Could not load saved debts from this browser.", error);
    setConnectionStatus(
      "Could not access saved debts. Open this app in Chrome using localhost.",
      true
    );
    return [];
  }
}

let debts = loadDebts();

function setConnectionStatus(message, isError = false) {
  connectionStatus.textContent = message;
  connectionStatus.classList.toggle("status-error", isError);
}

function saveDebts(nextDebts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDebts));
    return true;
  } catch (error) {
    console.error("Could not save debts in this browser.", error);
    setConnectionStatus("Could not save debts in this browser.", true);
    return false;
  }
}

function renderDebts() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const customerGroups = new Map();
  for (const debt of debts) {
    const key = debt.name.trim().toLocaleLowerCase();
    if (!customerGroups.has(key)) {
      customerGroups.set(key, { name: debt.name.trim(), debts: [], totalCents: 0 });
    }

    const group = customerGroups.get(key);
    group.debts.push(debt);
    group.totalCents += getRemainingDebtCents(debt);
  }

  const unpaidCustomerGroups = [...customerGroups.values()]
    .filter((group) => group.totalCents > 0);
  debtList.replaceChildren();

  for (const group of unpaidCustomerGroups) {
    if (!group.name.toLocaleLowerCase().includes(query)) {
      continue;
    }
    const customerKey = group.name.trim().toLocaleLowerCase();

    group.debts.forEach((debt, index) => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const remainingCell = document.createElement("td");
      const itemsCell = document.createElement("td");
      const actionsCell = document.createElement("td");
      const deleteButton = document.createElement("button");

      if (index === 0) {
        const nameCell = document.createElement("td");
        const balanceCell = document.createElement("td");
        const paymentControls = document.createElement("div");
        const paymentInput = document.createElement("input");
        const paymentButton = document.createElement("button");
        nameCell.textContent = group.name;
        balanceCell.className = "amount";
        const balanceAmount = document.createElement("div");
        balanceAmount.textContent = peso.format(group.totalCents / 100);
        paymentControls.className = "payment-controls";
        paymentInput.type = "number";
        paymentInput.min = "0.01";
        paymentInput.max = (group.totalCents / 100).toFixed(2);
        paymentInput.step = "0.01";
        paymentInput.placeholder = "Payment ₱";
        paymentInput.setAttribute("aria-label", `Payment for ${group.name}`);
        paymentInput.disabled = group.totalCents === 0;
        paymentButton.type = "button";
        paymentButton.className = "secondary";
        paymentButton.textContent = "Record payment";
        paymentButton.disabled = group.totalCents === 0;
        paymentButton.addEventListener("click", () =>
          recordCustomerPayment(customerKey, paymentInput.value)
        );
        paymentControls.append(paymentInput, paymentButton);
        balanceCell.append(balanceAmount, paymentControls);
        nameCell.rowSpan = group.debts.length;
        balanceCell.rowSpan = group.debts.length;
        row.append(nameCell, balanceCell);
      }

      const debtTotalCell = document.createElement("td");
      debtTotalCell.className = "amount";
      debtTotalCell.textContent = peso.format(debt.amount);
      dateCell.textContent = new Date(debt.createdAt).toLocaleDateString("en-PH");
      remainingCell.className = "amount";
      remainingCell.textContent = peso.format(getRemainingDebtCents(debt) / 100);
      itemsCell.className = "borrowed-items";
      itemsCell.textContent = debt.items.length
        ? debt.items.map((item) => {
          if (item.unitPrice === null || item.unitPrice === undefined) {
            return item.name;
          }
          const quantity = Number(item.quantity) || 1;
          const lineTotal = Math.round(item.unitPrice * 100) * quantity / 100;
          return `${item.name} × ${quantity} — ${peso.format(lineTotal)}`;
        }).join("\n")
        : "—";
      actionsCell.className = "actions";

      deleteButton.type = "button";
      deleteButton.className = "secondary";
      deleteButton.textContent = "Delete";
      deleteButton.setAttribute("aria-label", `Delete ${debt.name}'s debt`);
      deleteButton.addEventListener("click", () => removeDebt(debt.id));

      actionsCell.append(deleteButton);
      row.append(dateCell, debtTotalCell, remainingCell, itemsCell);
      row.append(actionsCell);
      debtList.append(row);
    });
  }

  renderPaymentHistory();

  const totalCents = debts.reduce(
    (sum, debt) => sum + getRemainingDebtCents(debt),
    0
  );
  totalDebt.textContent = peso.format(totalCents / 100);
  customerCount.textContent = String(unpaidCustomerGroups.length);
  emptyMessage.hidden = unpaidCustomerGroups.length > 0 && (
    query === ""
    || unpaidCustomerGroups.some((group) =>
      group.name.toLocaleLowerCase().includes(query)
    )
  );
  emptyMessage.textContent = unpaidCustomerGroups.length === 0
    ? "No debts yet. Add a customer above to get started."
    : "No customers match your search.";
}

function getRemainingDebtCents(debt) {
  const amountCents = Math.round(Number(debt.amount) * 100);
  const paidCents = Math.round((Number(debt.paidAmount) || 0) * 100);
  return Math.max(0, amountCents - paidCents);
}

function renderPaymentHistory() {
  const paymentTransactions = new Map();
  const legacyPayments = [];

  for (const debt of debts) {
    for (const payment of debt.payments) {
      const transaction = paymentTransactions.get(payment.id) || {
        customer: debt.name,
        amountCents: 0,
        createdAt: payment.createdAt,
      };
      transaction.amountCents += Math.round(Number(payment.amount) * 100);
      paymentTransactions.set(payment.id, transaction);
    }

    const paidCents = Math.round((Number(debt.paidAmount) || 0) * 100);
    const loggedCents = debt.payments.reduce(
      (paymentSum, payment) => paymentSum + Math.round(Number(payment.amount) * 100),
      0
    );
    const unloggedCents = Math.max(0, paidCents - loggedCents);
    if (unloggedCents > 0) {
      legacyPayments.push({
        customer: debt.name,
        amountCents: unloggedCents,
      });
    }
  }

  const entries = [
    ...[...paymentTransactions.values()].map((payment) => ({
      ...payment,
      date: new Date(payment.createdAt).toLocaleString("en-PH"),
    })),
    ...legacyPayments.map((payment) => ({
      ...payment,
      date: "Date not recorded",
    })),
  ].sort((first, second) => {
    if (first.createdAt && second.createdAt) {
      return new Date(second.createdAt) - new Date(first.createdAt);
    }
    return first.createdAt ? -1 : second.createdAt ? 1 : 0;
  });

  paymentHistoryList.replaceChildren();
  for (const payment of entries) {
    const row = document.createElement("tr");
    const customerCell = document.createElement("td");
    const dateCell = document.createElement("td");
    const amountCell = document.createElement("td");
    customerCell.textContent = payment.customer;
    dateCell.textContent = payment.date;
    amountCell.className = "amount";
    amountCell.textContent = peso.format(payment.amountCents / 100);
    row.append(customerCell, dateCell, amountCell);
    paymentHistoryList.append(row);
  }
  paymentHistoryEmpty.hidden = entries.length > 0;
}

function recordCustomerPayment(customerKey, rawPayment) {
  const payment = Number(rawPayment);
  const paymentCents = Math.round(payment * 100);
  const customerDebts = debts.filter((debt) =>
    debt.name.trim().toLocaleLowerCase() === customerKey
  );
  if (customerDebts.length === 0) {
    setConnectionStatus("Could not find that customer's debts.", true);
    return;
  }

  const remainingCents = customerDebts.reduce(
    (sum, debt) => sum + getRemainingDebtCents(debt),
    0
  );
  if (
    !Number.isFinite(payment)
    || paymentCents <= 0
    || paymentCents > remainingCents
  ) {
    setConnectionStatus(
      `Enter a payment from ₱0.01 up to ${peso.format(remainingCents / 100)}.`,
      true
    );
    return;
  }

  let unallocatedPayment = paymentCents;
  const oldestFirst = [...customerDebts].sort(
    (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
  );
  const paymentId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const paymentCreatedAt = new Date().toISOString();
  const paymentsById = new Map();
  for (const debt of oldestFirst) {
    if (unallocatedPayment === 0) {
      break;
    }

    const debtRemaining = getRemainingDebtCents(debt);
    const appliedPayment = Math.min(debtRemaining, unallocatedPayment);
    paymentsById.set(debt.id, appliedPayment);
    unallocatedPayment -= appliedPayment;
  }

  const updatedDebts = debts.map((debt) => {
    const appliedPayment = paymentsById.get(debt.id);
    if (appliedPayment === undefined) {
      return debt;
    }
    const currentPaidCents = Math.round((Number(debt.paidAmount) || 0) * 100);
    return {
      ...debt,
      paidAmount: (currentPaidCents + appliedPayment) / 100,
      payments: [
        ...debt.payments,
        {
          id: paymentId,
          amount: appliedPayment / 100,
          createdAt: paymentCreatedAt,
        },
      ],
    };
  });

  if (saveDebts(updatedDebts)) {
    debts = updatedDebts;
    renderDebts();
    setConnectionStatus(
      `Payment of ${peso.format(paymentCents / 100)} recorded for ${customerDebts[0].name}.`
    );
  }
}

function removeDebt(id) {
  const updatedDebts = debts.filter((debt) => debt.id !== id);
  if (saveDebts(updatedDebts)) {
    debts = updatedDebts;
    renderDebts();
    setConnectionStatus("Debt list saved in this browser.");
  }
}

function updateNewDebtTotal() {
  const totalCents = [...itemsContainer.querySelectorAll(".borrowed-item-row")]
    .reduce((sum, row) => {
      const product = products.find((entry) =>
        entry.id === row.querySelector(".item-product").value
      );
      const quantity = Number(row.querySelector(".item-quantity").value);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) {
        row.querySelector(".item-subtotal").textContent = peso.format(0);
        return sum;
      }
      const lineTotalCents = Math.round(Number(product.price) * 100) * quantity;
      row.querySelector(".item-subtotal").textContent = peso.format(lineTotalCents / 100);
      return sum + lineTotalCents;
    }, 0);
  newDebtTotal.textContent = peso.format(totalCents / 100);
}

function addItemRow() {
  const row = document.createElement("div");
  const productLabel = document.createElement("label");
  const productSelect = document.createElement("select");
  const quantityLabel = document.createElement("label");
  const quantityInput = document.createElement("input");
  const subtotal = document.createElement("span");
  const removeButton = document.createElement("button");

  row.className = "borrowed-item-row";
  productLabel.textContent = "Product";
  productSelect.className = "item-product";
  productSelect.required = true;
  productSelect.setAttribute("aria-label", "Borrowed product");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = products.length ? "Choose a product" : "Add products first";
  placeholder.disabled = true;
  placeholder.selected = true;
  productSelect.append(placeholder);
  for (const product of products) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} — ${peso.format(Number(product.price))}`;
    productSelect.append(option);
  }
  productSelect.addEventListener("change", updateNewDebtTotal);
  productLabel.append(productSelect);

  quantityLabel.textContent = "Quantity";
  quantityInput.type = "number";
  quantityInput.className = "item-quantity";
  quantityInput.min = "1";
  quantityInput.max = "999999";
  quantityInput.step = "1";
  quantityInput.value = "1";
  quantityInput.required = true;
  quantityInput.setAttribute("aria-label", "Borrowed product quantity");
  quantityInput.addEventListener("input", updateNewDebtTotal);
  quantityLabel.append(quantityInput);

  subtotal.className = "item-subtotal";
  subtotal.textContent = peso.format(0);

  removeButton.type = "button";
  removeButton.className = "secondary";
  removeButton.textContent = "Remove";
  removeButton.setAttribute("aria-label", "Remove borrowed item");
  removeButton.addEventListener("click", () => {
    row.remove();
    updateNewDebtTotal();
  });

  row.append(productLabel, quantityLabel, subtotal, removeButton);
  itemsContainer.append(row);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const itemRows = [...itemsContainer.querySelectorAll(".borrowed-item-row")];
  const items = itemRows.map((row) => {
    const product = products.find((entry) =>
      entry.id === row.querySelector(".item-product").value
    );
    return {
      name: product ? product.name : "",
      unitPrice: product ? Number(product.price) : NaN,
      quantity: Number(row.querySelector(".item-quantity").value),
    };
  });
  const amountInCents = items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity,
    0
  );
  const amount = amountInCents / 100;

  if (!name) {
    setConnectionStatus("Enter a customer name.", true);
    return;
  }
  if (
    products.length === 0
  ) {
    setConnectionStatus("Add products and prices from Manage product prices first.", true);
    return;
  }
  if (
    items.length === 0
    || items.some((item) => (
      !item.name
      || !Number.isFinite(item.unitPrice)
      || item.unitPrice <= 0
      || !Number.isInteger(item.quantity)
      || item.quantity <= 0
    ))
    || amount > 99999999.99
  ) {
    setConnectionStatus("Add at least one item with a valid price.", true);
    return;
  }

  const newDebt = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    amount: Math.round(amount * 100) / 100,
    items,
    createdAt: new Date().toISOString(),
  };
  const updatedDebts = [newDebt, ...debts];
  if (saveDebts(updatedDebts)) {
    debts = updatedDebts;
    form.reset();
    itemsContainer.replaceChildren();
    addItemRow();
    updateNewDebtTotal();
    nameInput.focus();
    renderDebts();
    setConnectionStatus("Debt list saved in this browser.");
  }
});

addItemButton.addEventListener("click", addItemRow);
addItemRow();
window.addEventListener("storage", (event) => {
  if (event.key === PRODUCTS_STORAGE_KEY) {
    products = loadProducts();
    itemsContainer.replaceChildren();
    addItemRow();
    updateNewDebtTotal();
  }
});
searchInput.addEventListener("input", renderDebts);
renderDebts();
if (!connectionStatus.classList.contains("status-error")) {
  setConnectionStatus("Debt list is saved in this browser.");
}