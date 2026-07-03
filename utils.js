import {
    ref,
    get,
    set,
    push,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { db } from "./firebase-config.js";

export function safe(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function moneyVnd(value) {
    const n = Number(value || 0);
    return n.toLocaleString("vi-VN") + " đ";
}

export function moneyEur(value) {
    const n = Number(value || 0);
    return n.toLocaleString("vi-VN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " €";
}

export function now() {
    return new Date().toISOString();
}

export function makeKey(text) {
    return String(text || "")
        .replaceAll("/", "*")
        .replaceAll(".", "*")
        .replaceAll("#", "*")
        .replaceAll("$", "*")
        .replaceAll("[", "*")
        .replaceAll("]", "*")
        .trim();
}

export function splitColors(color) {
    if (!color) {
        return ["Không có màu"];
    }

    return color
        .split("/")
        .map(item => item.trim())
        .filter(Boolean);
}

export function getSizes(product) {
    if (
        product &&
        Array.isArray(product.availableSizes) &&
        product.availableSizes.length > 0
    ) {
        return product.availableSizes;
    }

    if (
        product &&
        product.sizeChart &&
        Array.isArray(product.sizeChart.sizes) &&
        product.sizeChart.sizes.length > 0
    ) {
        return product.sizeChart.sizes;
    }

    return [];
}

export async function getAll(pathName) {
    const snapshot = await get(ref(db, pathName));
    const data = snapshot.val() || {};

    return Object.keys(data).map(id => ({
        id,
        ...data[id]
    }));
}

export async function getOne(pathName, id) {
    const snapshot = await get(ref(db, `${pathName}/${id}`));
    const data = snapshot.val();

    if (!data) {
        return null;
    }

    return {
        id,
        ...data
    };
}

export async function addOne(pathName, data) {
    const newRef = push(ref(db, pathName));
    await set(newRef, data);
    return newRef.key;
}

export async function setOne(pathName, id, data) {
    await set(ref(db, `${pathName}/${id}`), data);
}

export async function updateOne(pathName, id, data) {
    await update(ref(db, `${pathName}/${id}`), data);
}

export async function deleteOne(pathName, id) {
    await remove(ref(db, `${pathName}/${id}`));
}

export async function findByField(pathName, fieldName, value) {
    const items = await getAll(pathName);
    return items.find(item => item[fieldName] === value) || null;
}

export async function getDefaultRate() {
    const rates = await getAll("exchange_rates");
    const defaultRate = rates.find(rate => rate.isDefault === true);

    if (defaultRate) {
        return Number(defaultRate.rate || 0);
    }

    if (rates.length > 0) {
        return Number(rates[rates.length - 1].rate || 0);
    }

    return 31500;
}

export async function getActivePrice(productId) {
    const prices = await getAll("product_prices");

    return prices.find(price =>
        price.productId === productId &&
        price.isActive === true
    ) || null;
}

export function eurToVnd(priceEur, rate) {
    return Math.round(Number(priceEur || 0) * Number(rate || 0));
}