const { chromium } = require("playwright");

function isAccessDenied(text) {
    if (!text) return false;

    return (
        text.includes("Access Denied") ||
        text.includes("You don't have permission to access") ||
        text.includes("Reference #")
    );
}

function normalizeSize(size) {
    return String(size || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function cleanSizeList(sizes) {
    const order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

    const normalizedSizes = (sizes || [])
        .map(size => normalizeSize(size))
        .filter(Boolean);

    const result = [];

    for (const size of order) {
        if (normalizedSizes.includes(size) && !result.includes(size)) {
            result.push(size);
        }
    }

    normalizedSizes.forEach(size => {
        if (!result.includes(size)) {
            result.push(size);
        }
    });

    return result;
}

async function createBrowser() {
    return await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--single-process"
        ]
    });
}

async function createContext(browser) {
    return await browser.newContext({
        locale: "es-ES",
        timezoneId: "Europe/Madrid",
        viewport: {
            width: 1366,
            height: 900
        },
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        extraHTTPHeaders: {
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Upgrade-Insecure-Requests": "1"
        }
    });
}

async function preparePage(context) {
    const page = await context.newPage();

    await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
            get: () => false
        });
    });

    page.setDefaultTimeout(15000);

    return page;
}

async function acceptZaraPopups(page) {
    const cookieButtons = [
        "button:has-text('Accept')",
        "button:has-text('Aceptar')",
        "button:has-text('Agree')",
        "button:has-text('OK')",
        "button:has-text('Accept all')",
        "button:has-text('Aceptar todo')",
        "button:has-text('CONTINUE')",
        "button:has-text('Continuar')"
    ];

    for (const selector of cookieButtons) {
        try {
            const btn = page.locator(selector).first();

            if (await btn.count()) {
                const visible = await btn.isVisible().catch(() => false);

                if (!visible) continue;

                await btn.click({ timeout: 3000 });
                await page.waitForTimeout(1500);
                break;
            }
        } catch (e) {}
    }

    const countryButtons = [
        "button:has-text('YES, CONTINUE ON SPAIN')",
        "button:has-text('Yes, continue on Spain')",
        "button:has-text('CONTINUE ON SPAIN')",
        "button:has-text('Continue on Spain')",
        "text=YES, CONTINUE ON SPAIN",
        "text=Yes, continue on Spain"
    ];

    for (const selector of countryButtons) {
        try {
            const btn = page.locator(selector).first();

            if (await btn.count()) {
                const visible = await btn.isVisible().catch(() => false);

                if (!visible) continue;

                await btn.click({ timeout: 3000 });
                await page.waitForTimeout(2000);
                break;
            }
        } catch (e) {}
    }
}

function getStockInfoBrowser() {
    const text = document.body.innerText || "";
    const upper = text.toUpperCase();

    const isAccessDenied =
        upper.includes("ACCESS DENIED") ||
        upper.includes("YOU DON'T HAVE PERMISSION") ||
        upper.includes("REFERENCE #");

    const buttons = Array.from(document.querySelectorAll("button"));

    const buttonTexts = buttons
        .map(button => (button.innerText || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);

    const addButton = buttons.find(button => {
        const btnText = (button.innerText || "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

        const disabled =
            button.disabled ||
            button.getAttribute("aria-disabled") === "true" ||
            String(button.className || "").toLowerCase().includes("disabled");

        const rect = button.getBoundingClientRect();
        const visible = rect.width > 20 && rect.height > 20;

        return (
            visible &&
            !disabled &&
            (
                btnText === "ADD" ||
                btnText.includes("ADD TO BAG") ||
                btnText === "AÑADIR" ||
                btnText.includes("AÑADIR")
            )
        );
    });

    const hasAddButton = !!addButton;

    const productAreaText = Array.from(
        document.querySelectorAll("main, [class*='product-detail'], [class*='product']")
    )
        .map(el => el.innerText || "")
        .join("\n")
        .toUpperCase();

    const outOfStockText =
        productAreaText.includes("OUT OF STOCK") ||
        productAreaText.includes("SOLD OUT") ||
        productAreaText.includes("VIEW SIMILAR") ||
        productAreaText.includes("AGOTADO") ||
        productAreaText.includes("SIN STOCK") ||
        productAreaText.includes("NOTIFY ME") ||
        productAreaText.includes("BACK SOON");

    const isOutOfStock = hasAddButton ? false : outOfStockText;

    return {
        isAccessDenied,
        isOutOfStock,
        hasAddButton,
        inStock: !isAccessDenied && hasAddButton,
        stockStatus: hasAddButton ? "in_stock" : isOutOfStock ? "out_of_stock" : "unknown",
        buttonTexts,
        checkedText: text.slice(0, 500)
    };
}

async function scrapeSizeOptionsFromAdd(page) {
    const possibleSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

    try {
        const addSelectors = [
            "button:has-text('ADD')",
            "button:has-text('Add')",
            "button:has-text('AÑADIR')",
            "button:has-text('Añadir')",
            "button:has-text('ADD TO BAG')",
            "button:has-text('Add to bag')"
        ];

        let clicked = false;

        for (const selector of addSelectors) {
            try {
                const btn = page.locator(selector).first();

                if (await btn.count()) {
                    const visible = await btn.isVisible().catch(() => false);
                    const disabled = await btn.isDisabled().catch(() => false);

                    if (!visible || disabled) continue;

                    await btn.scrollIntoViewIfNeeded({ timeout: 5000 });
                    await page.waitForTimeout(500);
                    await btn.click({ timeout: 5000 });
                    await page.waitForTimeout(1800);

                    clicked = true;
                    break;
                }
            } catch (e) {}
        }

        if (!clicked) return [];

        const lines = await page.evaluate(() => {
            return (document.body.innerText || "")
                .split("\n")
                .map(x => x.trim())
                .filter(Boolean);
        });

        const rawOptions = [];

        for (let i = 0; i < lines.length; i++) {
            const size = normalizeSize(lines[i]);

            if (!possibleSizes.includes(size)) continue;

            const nextText = lines
                .slice(i + 1, i + 4)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            const statusUpper = nextText.toUpperCase();

            const soldOut =
                statusUpper.includes("VIEW SIMILAR") ||
                statusUpper.includes("SIMILAR") ||
                statusUpper.includes("OUT OF STOCK") ||
                statusUpper.includes("SOLD OUT") ||
                statusUpper.includes("NOTIFY") ||
                statusUpper.includes("BACK SOON") ||
                statusUpper.includes("AGOTADO") ||
                statusUpper.includes("SIN STOCK");

            const availableText =
                statusUpper.includes("FEW ITEMS LEFT") ||
                statusUpper.includes("LOW STOCK") ||
                statusUpper.includes("ADD") ||
                statusUpper.includes("AÑADIR") ||
                statusUpper.includes("AVAILABLE") ||
                statusUpper.includes("DISPONIBLE") ||
                statusUpper === "";

            rawOptions.push({
                size,
                statusText: nextText,
                available: soldOut ? false : availableText ? true : true
            });
        }

        const ordered = [];

        for (const size of possibleSizes) {
            const option = rawOptions.find(item => item.size === size);

            if (option && !ordered.find(item => item.size === size)) {
                ordered.push(option);
            }
        }

        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(800);

        return ordered;
    } catch (error) {
        await page.keyboard.press("Escape").catch(() => {});
        return [];
    }
}

async function openProductMeasurements(page) {
    try {
        await page.waitForTimeout(1500);

        const selectors = [
            "button[data-qa-action='open-interactive-size-guide-accordion']",
            "button:has-text('Product Measurements')",
            "button:has-text('PRODUCT MEASUREMENTS')",
            "button:has-text('Product dimensions')",
            "button:has-text('PRODUCT DIMENSIONS')",
            "text=Product Measurements",
            "text=PRODUCT MEASUREMENTS",
            "text=Product dimensions",
            "text=PRODUCT DIMENSIONS",
            "text=Medidas del producto",
            "text=MEDIDAS DEL PRODUCTO",
            "text=Dimensiones del producto",
            "text=DIMENSIONES DEL PRODUCTO"
        ];

        for (const selector of selectors) {
            try {
                const count = await page.locator(selector).count();

                for (let i = 0; i < count; i++) {
                    const item = page.locator(selector).nth(i);
                    const visible = await item.isVisible().catch(() => false);

                    if (!visible) continue;

                    await item.scrollIntoViewIfNeeded({ timeout: 8000 });
                    await page.waitForTimeout(800);
                    await item.click({ timeout: 8000 });
                    await page.waitForTimeout(4000);

                    const hasPanel = await page.evaluate(() => {
                        const text = document.body.innerText || "";

                        return (
                            text.includes("PRODUCT DIMENSIONS") ||
                            text.includes("PRODUCT MEASUREMENTS") ||
                            text.includes("THE GARMENT IS MEASURED") ||
                            text.includes("AREA") ||
                            text.includes("Chest") ||
                            text.includes("Waist") ||
                            text.includes("Hip")
                        );
                    });

                    if (hasPanel) return true;
                }
            } catch (e) {}
        }

        for (let s = 0; s < 10; s++) {
            await page.mouse.wheel(0, 700);
            await page.waitForTimeout(800);

            const clicked = await page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll("button, div, span, a"));

                const target = elements.find(el => {
                    const text = (el.innerText || "").trim().toLowerCase();

                    return (
                        text === "product measurements" ||
                        text === "product dimensions" ||
                        text === "medidas del producto" ||
                        text === "dimensiones del producto"
                    );
                });

                if (target) {
                    target.click();
                    return true;
                }

                return false;
            });

            if (clicked) {
                await page.waitForTimeout(4000);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.log("openProductMeasurements error:", error.message);
        return false;
    }
}

async function scrapeProductDimensionImage(page) {
    try {
        const imageUrl = await page.evaluate(() => {
            function isValidZaraImage(src) {
                if (!src) return false;

                const lower = String(src).toLowerCase();

                return (
                    src.startsWith("http") &&
                    lower.includes("zara.net") &&
                    !lower.includes("transparent") &&
                    !lower.includes("placeholder") &&
                    !lower.includes("sprite") &&
                    !lower.includes("logo")
                );
            }

            function getBestSrcFromImg(img) {
                if (!img) return "";

                const directCandidates = [
                    img.currentSrc,
                    img.src,
                    img.getAttribute("src"),
                    img.getAttribute("data-src"),
                    img.getAttribute("data-original"),
                    img.getAttribute("data-lazy-src")
                ];

                for (const src of directCandidates) {
                    if (isValidZaraImage(src)) return src;
                }

                const srcset =
                    img.getAttribute("srcset") ||
                    img.getAttribute("data-srcset") ||
                    "";

                if (srcset) {
                    const urls = srcset
                        .split(",")
                        .map(part => part.trim().split(/\s+/)[0])
                        .filter(src => isValidZaraImage(src));

                    if (urls.length > 0) {
                        return urls[urls.length - 1];
                    }
                }

                return "";
            }

            function getBackgroundImage(el) {
                const style = window.getComputedStyle(el);
                const bg = style.backgroundImage || "";

                if (!bg || bg === "none") return "";

                const match = bg.match(/url\(["']?(.*?)["']?\)/i);

                if (!match || !match[1]) return "";

                const url = match[1].trim();

                return isValidZaraImage(url) ? url : "";
            }

            const viewportWidth = window.innerWidth || 1366;
            const viewportHeight = window.innerHeight || 900;

            const allElements = Array.from(document.querySelectorAll("*"));

            const panel = allElements
                .map(el => {
                    const text = (el.innerText || "").toUpperCase();
                    const rect = el.getBoundingClientRect();

                    const isRightSide = rect.left > viewportWidth * 0.42;
                    const isBig = rect.width > 220 && rect.height > 220;

                    const score =
                        (text.includes("PRODUCT DIMENSIONS") ? 30 : 0) +
                        (text.includes("PRODUCT MEASUREMENTS") ? 30 : 0) +
                        (text.includes("THE GARMENT IS MEASURED") ? 20 : 0) +
                        (text.includes("MEASURED ON A FLAT SURFACE") ? 20 : 0);

                    return {
                        el,
                        rect,
                        score,
                        isRightSide,
                        isBig
                    };
                })
                .filter(item => item.score > 0 && item.isRightSide && item.isBig)
                .sort((a, b) => b.score - a.score)[0]?.el;

            const searchRoot = panel || document.body;

            const items = [];

            const imgs = Array.from(searchRoot.querySelectorAll("img"));

            imgs.forEach(img => {
                const src = getBestSrcFromImg(img);
                const rect = img.getBoundingClientRect();

                if (!isValidZaraImage(src)) return;

                const isRightSide = rect.left > viewportWidth * 0.42;
                const isVisible = rect.width > 50 && rect.height > 50;
                const isProductImage =
                    rect.width >= 90 &&
                    rect.height >= 90 &&
                    rect.top > 80 &&
                    rect.top < viewportHeight - 10;

                if (isRightSide && isVisible && isProductImage) {
                    items.push({
                        src,
                        area: rect.width * rect.height,
                        top: rect.top,
                        left: rect.left
                    });
                }
            });

            const bgElements = Array.from(searchRoot.querySelectorAll("div, picture, figure, span"));

            bgElements.forEach(el => {
                const src = getBackgroundImage(el);
                const rect = el.getBoundingClientRect();

                if (!isValidZaraImage(src)) return;

                const isRightSide = rect.left > viewportWidth * 0.42;
                const isVisible = rect.width > 50 && rect.height > 50;
                const isProductImage =
                    rect.width >= 90 &&
                    rect.height >= 90 &&
                    rect.top > 80 &&
                    rect.top < viewportHeight - 10;

                if (isRightSide && isVisible && isProductImage) {
                    items.push({
                        src,
                        area: rect.width * rect.height,
                        top: rect.top,
                        left: rect.left
                    });
                }
            });

            items.sort((a, b) => b.area - a.area);

            if (items.length > 0) {
                return items[0].src;
            }

            return "";
        });

        return imageUrl || "";
    } catch (error) {
        console.log("scrapeProductDimensionImage error:", error.message);
        return "";
    }
}

async function scrapeSizeChart(page) {
    try {
        const result = await page.evaluate(async () => {
            const possibleSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

            const areaNames = [
                "Chest",
                "Waist",
                "Hip",
                "Front length",
                "Back length",
                "Total length",
                "Sleeve length",
                "Back width",
                "Arm width",
                "Shoulder width",
                "Leg length",
                "Inside leg length",
                "Outside leg length",
                "Thigh width",
                "Hem width"
            ];

            function cleanText(text) {
                return String(text || "")
                    .replace(/\r/g, "\n")
                    .replace(/\t/g, " ")
                    .replace(/[ ]+/g, " ")
                    .trim();
            }

            function normalizeLines(text) {
                return cleanText(text)
                    .split("\n")
                    .map(line => cleanText(line))
                    .filter(Boolean);
            }

            function isSize(text) {
                return possibleSizes.includes(cleanText(text).toUpperCase());
            }

            function extractNumbers(text) {
                const matches = cleanText(text).match(/[0-9]+(?:[.,][0-9]+)?/g);
                return matches ? matches.map(x => x.replace(",", ".")) : [];
            }

            function getAreaName(text) {
                const clean = cleanText(text).toLowerCase();

                for (const area of areaNames) {
                    if (clean === area.toLowerCase()) return area;
                }

                for (const area of areaNames) {
                    if (clean.startsWith(area.toLowerCase() + " ")) return area;
                }

                return "";
            }

            function findPanel() {
                const all = Array.from(document.querySelectorAll("*"));

                const candidates = all
                    .map(el => {
                        const text = el.innerText || "";
                        const rect = el.getBoundingClientRect();

                        const score =
                            (text.includes("PRODUCT DIMENSIONS") ? 8 : 0) +
                            (text.includes("PRODUCT MEASUREMENTS") ? 8 : 0) +
                            (text.includes("AREA") ? 5 : 0) +
                            (text.includes("Chest") ? 3 : 0) +
                            (text.includes("Waist") ? 3 : 0) +
                            (text.includes("Hip") ? 3 : 0) +
                            (text.includes("Front length") ? 3 : 0) +
                            (text.includes("Back width") ? 3 : 0) +
                            (text.includes("Total length") ? 3 : 0) +
                            (text.includes("Sleeve length") ? 3 : 0);

                        return { el, rect, score };
                    })
                    .filter(item => item.rect.width > 100 && item.rect.height > 100 && item.score >= 6)
                    .sort((a, b) => b.score - a.score);

                return candidates.length ? candidates[0].el : document.body;
            }

            function parseFromLines(lines) {
                let sizes = [];

                for (const line of lines) {
                    const parts = line.split(/\s+/).map(x => x.trim()).filter(Boolean);
                    const foundSizes = parts.filter(part => isSize(part));

                    if (foundSizes.length >= 2) {
                        sizes = foundSizes.map(size => size.toUpperCase());
                        break;
                    }
                }

                if (sizes.length === 0) {
                    const allSizes = [];

                    for (const line of lines) {
                        const clean = cleanText(line).toUpperCase();

                        if (isSize(clean) && !allSizes.includes(clean)) {
                            allSizes.push(clean);
                        }
                    }

                    if (allSizes.length >= 2) sizes = allSizes;
                }

                if (sizes.length === 0) {
                    sizes = ["XS", "S", "M", "L", "XL"].filter(size => {
                        return lines.some(line => cleanText(line).toUpperCase() === size);
                    });
                }

                const rows = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = cleanText(lines[i]);
                    const areaName = getAreaName(line);

                    if (!areaName) continue;

                    let numbers = extractNumbers(line.replace(areaName, ""));

                    if (numbers.length < sizes.length) {
                        const nextLines = lines.slice(i + 1, i + 10);

                        for (const nextLine of nextLines) {
                            if (getAreaName(nextLine)) break;

                            numbers = numbers.concat(extractNumbers(nextLine));

                            if (numbers.length >= sizes.length) break;
                        }
                    }

                    if (numbers.length >= sizes.length && sizes.length > 0) {
                        const row = { area: areaName };

                        sizes.forEach((size, index) => {
                            row[size] = numbers[index] || "";
                        });

                        rows.push(row);
                    }
                }

                return { sizes, rows };
            }

            const panel = findPanel();

            const tableLines = [];

            const tables = Array.from(panel.querySelectorAll("table"));

            tables.forEach(table => {
                tableLines.push(...normalizeLines(table.innerText || ""));
            });

            if (tableLines.length > 0) {
                const parsedTable = parseFromLines(tableLines);

                if (parsedTable.sizes.length > 0 && parsedTable.rows.length > 0) {
                    return {
                        unit: "CM",
                        sizes: parsedTable.sizes,
                        rows: parsedTable.rows,
                        source: "table"
                    };
                }
            }

            const allText = panel.innerText || document.body.innerText || "";
            const lines = normalizeLines(allText);
            const parsed = parseFromLines(lines);

            return {
                unit: "CM",
                sizes: parsed.sizes,
                rows: parsed.rows,
                source: "text",
                debugText: allText.slice(0, 2000)
            };
        });

        if (
            result &&
            Array.isArray(result.sizes) &&
            result.sizes.length > 0 &&
            Array.isArray(result.rows) &&
            result.rows.length > 0
        ) {
            result.sizes = cleanSizeList(result.sizes);
            return result;
        }

        return null;
    } catch (error) {
        console.log("scrapeSizeChart error:", error.message);
        return null;
    }
}

function cleanPriceText(priceText) {
    const text = String(priceText || "")
        .replace(/\s/g, "")
        .replace("€", "")
        .replace("EUR", "")
        .replace(",", ".");

    const match = text.match(/[0-9]+(?:\.[0-9]+)?/);

    if (!match) return 0;

    const number = Number(match[0]);

    return isNaN(number) ? 0 : number;
}

function pickProductOnlyImage(images) {
    if (!Array.isArray(images) || images.length === 0) return "";

    const validImages = images.filter(img => {
        if (!img) return false;

        const lower = img.toLowerCase();

        return (
            lower.includes("static.zara.net") ||
            lower.includes("zara.net") ||
            lower.includes(".jpg") ||
            lower.includes(".jpeg") ||
            lower.includes(".png") ||
            lower.includes(".webp")
        );
    });

    if (validImages.length === 0) return "";

    const productOnly = validImages.find(img => {
        const lower = img.toLowerCase();

        return (
            lower.includes("/w/") ||
            lower.includes("e1") ||
            lower.includes("e2") ||
            lower.includes("e3") ||
            lower.includes("_6_")
        );
    });

    return productOnly || validImages[0];
}

function pickModelImage(images) {
    if (!Array.isArray(images) || images.length === 0) return "";

    const validImages = images.filter(img => {
        if (!img) return false;

        const lower = img.toLowerCase();

        return (
            lower.includes("static.zara.net") ||
            lower.includes("zara.net") ||
            lower.includes(".jpg") ||
            lower.includes(".jpeg") ||
            lower.includes(".png") ||
            lower.includes(".webp")
        );
    });

    if (validImages.length === 0) return "";

    const modelImage = validImages.find(img => {
        const lower = img.toLowerCase();

        return (
            lower.includes("/v1/") ||
            lower.includes("mkt") ||
            lower.includes("model")
        );
    });

    return modelImage || validImages[0];
}

function extractProductDataBrowser() {
    const bodyText = document.body.innerText || "";

    const titleSelectors = [
        "h1",
        "[data-qa-id='product-detail-info-product-name']",
        "[class*='product-detail-info__header-name']",
        "[class*='product-name']"
    ];

    let name = "";

    for (const selector of titleSelectors) {
        const el = document.querySelector(selector);

        if (el && el.innerText && el.innerText.trim()) {
            name = el.innerText.trim();
            break;
        }
    }

    if (!name) {
        const lines = bodyText
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        name = lines.find(line => {
            const upper = line.toUpperCase();

            return (
                line.length > 3 &&
                line.length < 80 &&
                !upper.includes("ZARA") &&
                !upper.includes("ADD") &&
                !upper.includes("VIEW SIMILAR") &&
                !upper.includes("PRIVACY") &&
                !upper.includes("SEARCH") &&
                !upper.includes("HELP")
            );
        }) || "";
    }

    let priceText = "";

    const priceSelectors = [
        "[data-qa-id='product-detail-info-product-price']",
        "[class*='price']",
        "[class*='Price']"
    ];

    for (const selector of priceSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));

        const found = elements.find(el => {
            const text = el.innerText || "";
            return text.includes("€") || /[0-9]+(?:[,.][0-9]+)?\s*EUR/i.test(text);
        });

        if (found) {
            priceText = found.innerText.trim();
            break;
        }
    }

    if (!priceText) {
        const allElements = Array.from(document.querySelectorAll("span, div, p"));

        const priceElement = allElements.find(el => {
            const text = (el.innerText || "").trim();

            return /^[0-9]+(?:[,.][0-9]+)?\s*€$/.test(text) ||
                /^[0-9]+(?:[,.][0-9]+)?\s*EUR$/i.test(text) ||
                /[0-9]+(?:[,.][0-9]+)?\s*€/.test(text) ||
                /[0-9]+(?:[,.][0-9]+)?\s*EUR/i.test(text);
        });

        if (priceElement) {
            priceText = priceElement.innerText.trim();
        }
    }

    if (!priceText) {
        const priceMatch =
            bodyText.match(/[0-9]+(?:[,.][0-9]+)?\s*€/) ||
            bodyText.match(/[0-9]+(?:[,.][0-9]+)?\s*EUR/i);

        if (priceMatch) priceText = priceMatch[0];
    }

    let color = "";

    const colorSelectors = [
        "[data-qa-id='product-detail-selected-color']",
        "[class*='selected-color']",
        "[class*='color-name']",
        "[class*='Color']",
        "[class*='colour']"
    ];

    for (const selector of colorSelectors) {
        const el = document.querySelector(selector);

        if (el && el.innerText && el.innerText.trim()) {
            color = el.innerText.trim();
            break;
        }
    }

    if (!color) {
        const lines = bodyText
            .split("\n")
            .map(x => x.trim())
            .filter(Boolean);

        const colorLine = lines.find(line => {
            const upper = line.toUpperCase();

            return (
                upper.includes("COLOUR") ||
                upper.includes("COLOR") ||
                upper.includes("MÀU")
            );
        });

        if (colorLine) {
            color = colorLine
                .replace(/colour/ig, "")
                .replace(/color/ig, "")
                .replace(/màu/ig, "")
                .replace(":", "")
                .trim();
        }
    }

    let description = "";

    const descSelectors = [
        "[data-qa-id='product-detail-info-description']",
        "[class*='description']",
        "[class*='Description']"
    ];

    for (const selector of descSelectors) {
        const el = document.querySelector(selector);

        if (el && el.innerText && el.innerText.trim().length > 10) {
            description = el.innerText.trim();
            break;
        }
    }

    const imageSet = new Set();

    const imgs = Array.from(document.querySelectorAll("img"));

    imgs.forEach(img => {
        const candidates = [
            img.src,
            img.currentSrc,
            img.getAttribute("src"),
            img.getAttribute("data-src")
        ];

        candidates.forEach(src => {
            if (src && src.startsWith("http")) {
                imageSet.add(src);
            }
        });
    });

    const sources = Array.from(document.querySelectorAll("source"));

    sources.forEach(source => {
        const srcset = source.getAttribute("srcset") || "";

        srcset.split(",").forEach(part => {
            const url = part.trim().split(" ")[0];

            if (url && url.startsWith("http")) {
                imageSet.add(url);
            }
        });
    });

    const galleryImages = Array.from(imageSet);

    return {
        name,
        priceText,
        price: priceText,
        color,
        description,
        galleryImages,
        bodyText: bodyText.slice(0, 2000)
    };
}

async function scrapeZaraProduct(url) {
    let browser;
    let context;
    let page;

    try {
        browser = await createBrowser();
        context = await createContext(browser);
        page = await preparePage(context);

        console.log("Đang mở Zara:", url);

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        await page.waitForTimeout(4000);
        await acceptZaraPopups(page);

        await page.waitForLoadState("networkidle", {
            timeout: 20000
        }).catch(() => {});

        const pageText = await page.evaluate(() => document.body.innerText || "");

        if (isAccessDenied(pageText)) {
            return {
                success: false,
                status: 403,
                message: "Zara đang chặn truy cập Access Denied. Hãy thử lại sau hoặc đổi mạng/VPN."
            };
        }

        await page.waitForTimeout(2000);

        const basicData = await page.evaluate(extractProductDataBrowser);
        const stockInfo = await page.evaluate(getStockInfoBrowser);

        let sizeChart = null;
        let productDimensionImage = "";

        const openedMeasurements = await openProductMeasurements(page);

        if (openedMeasurements) {
            productDimensionImage = await scrapeProductDimensionImage(page);
            sizeChart = await scrapeSizeChart(page);

            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(1000);
        }

        const sizeOptions = await scrapeSizeOptionsFromAdd(page);

        const availableSizes = cleanSizeList(
            sizeOptions
                .filter(item => item.available === true)
                .map(item => item.size)
        );

        const allSizeFromOptions = cleanSizeList(sizeOptions.map(item => item.size));

        const allSizeFromChart =
            sizeChart && Array.isArray(sizeChart.sizes)
                ? cleanSizeList(sizeChart.sizes)
                : [];

        const allSizes = allSizeFromOptions.length > 0
            ? allSizeFromOptions
            : allSizeFromChart;

        let finalSizeOptions = sizeOptions;

        if (finalSizeOptions.length === 0 && allSizeFromChart.length > 0) {
            finalSizeOptions = allSizeFromChart.map(size => {
                const isAvailable = availableSizes.includes(size);

                return {
                    size,
                    statusText: isAvailable ? "Available" : "Sold out",
                    available: isAvailable
                };
            });
        }

        const finalAvailableSizes = cleanSizeList(
            finalSizeOptions
                .filter(item => item.available === true)
                .map(item => item.size)
        );

        const finalSoldOutSizes = cleanSizeList(
            finalSizeOptions
                .filter(item => item.available === false)
                .map(item => item.size)
        );

        const isOutOfStock =
            stockInfo.isOutOfStock === true ||
            (
                finalSizeOptions.length > 0 &&
                finalAvailableSizes.length === 0
            );

        const galleryImages = Array.isArray(basicData.galleryImages)
            ? basicData.galleryImages
            : [];

        const modelImage = pickModelImage(galleryImages);

        const productOnlyImage =
            productDimensionImage ||
            pickProductOnlyImage(galleryImages);

        const data = {
            name: basicData.name || "",
            title: basicData.name || "",
            color: basicData.color || "",
            price: cleanPriceText(basicData.priceText || basicData.price),
            priceEur: cleanPriceText(basicData.priceText || basicData.price),
            salePriceEur: cleanPriceText(basicData.priceText || basicData.price),

            imageUrl: productOnlyImage || modelImage || galleryImages[0] || "",
            productOnlyImage: productOnlyImage || "",
            modelImage: modelImage || "",
            dimensionImage: productDimensionImage || "",

            galleryImages,
            description: basicData.description || "",
            availableSizes: finalAvailableSizes,
            soldOutSizes: finalSoldOutSizes,
            allSizes,
            sizeOptions: finalSizeOptions,
            sizeChart,
            stockStatus: isOutOfStock ? "out_of_stock" : "in_stock",
            isOutOfStock,
            hasAddButton: stockInfo.hasAddButton === true,
            rawStockInfo: stockInfo
        };

        console.log("Import xong:", {
            name: data.name,
            price: data.price,
            imageUrl: data.imageUrl,
            productOnlyImage: data.productOnlyImage,
            dimensionImage: data.dimensionImage,
            availableSizes: data.availableSizes,
            soldOutSizes: data.soldOutSizes,
            allSizes: data.allSizes,
            hasSizeChart: !!data.sizeChart
        });

        return {
            success: true,
            data
        };
    } catch (error) {
        console.log("scrapeZaraProduct error:", error.message);

        return {
            success: false,
            status: 500,
            message: error.message
        };
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

async function checkOneZaraStock(browser, productUrl, targetSize = "") {
    let context;
    let page;

    try {
        context = await createContext(browser);
        page = await preparePage(context);

        await page.goto(productUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        await page.waitForTimeout(3500);
        await acceptZaraPopups(page);

        await page.waitForLoadState("networkidle", {
            timeout: 15000
        }).catch(() => {});

        const pageText = await page.evaluate(() => document.body.innerText || "");

        if (isAccessDenied(pageText)) {
            return {
                inStock: false,
                sizeMatched: false,
                isAccessDenied: true,
                stockStatus: "access_denied",
                availableSizes: [],
                soldOutSizes: [],
                sizeOptions: [],
                message: "Access Denied"
            };
        }

        const stockInfo = await page.evaluate(getStockInfoBrowser);
        const sizeOptions = await scrapeSizeOptionsFromAdd(page);

        const availableSizes = cleanSizeList(
            sizeOptions
                .filter(item => item.available === true)
                .map(item => item.size)
        );

        const soldOutSizes = cleanSizeList(
            sizeOptions
                .filter(item => item.available === false)
                .map(item => item.size)
        );

        const cleanTargetSize = normalizeSize(targetSize);

        let sizeMatched = false;

        if (cleanTargetSize) {
            sizeMatched = availableSizes.includes(cleanTargetSize);
        } else {
            sizeMatched = availableSizes.length > 0 || stockInfo.hasAddButton === true;
        }

        return {
            inStock: sizeMatched,
            sizeMatched,
            targetSize: cleanTargetSize,
            hasAddButton: stockInfo.hasAddButton === true,
            stockStatus: sizeMatched ? "in_stock" : "out_of_stock",
            availableSizes,
            soldOutSizes,
            sizeOptions,
            rawStockInfo: stockInfo,
            checkedAt: new Date().toISOString()
        };
    } catch (error) {
        return {
            inStock: false,
            sizeMatched: false,
            stockStatus: "error",
            availableSizes: [],
            soldOutSizes: [],
            sizeOptions: [],
            error: error.message,
            checkedAt: new Date().toISOString()
        };
    } finally {
        if (context) {
            await context.close().catch(() => {});
        }
    }
}

module.exports = {
    createBrowser,
    normalizeSize,
    scrapeZaraProduct,
    checkOneZaraStock
};