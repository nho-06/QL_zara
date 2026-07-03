const {
    createBrowser,
    normalizeSize,
    checkOneZaraStock
} = require("../zara-tools");

const {
    firebaseGet,
    firebaseSet,
    firebaseUpdate,
    firebaseDelete,
    makeFirebaseKey
} = require("./firebaseService");

const { sendStockEmail } = require("./mailService");

function getProductImageFromProduct(product) {
    if (!product) return "";

    return (
        product.productOnlyImage ||
        product.imageUrl ||
        product.image ||
        product.modelImage ||
        ""
    );
}

async function findProductForAlert(alert) {
    const productsData = await firebaseGet("products");

    if (!productsData) return null;

    const entries = Object.entries(productsData);

    for (const [id, product] of entries) {
        const sameCode =
            product.productCode &&
            alert.productCode &&
            String(product.productCode) === String(alert.productCode);

        const sameId =
            alert.productCode &&
            String(id) === String(alert.productCode);

        const sameUrl =
            product.productUrl &&
            alert.productUrl &&
            String(product.productUrl).split("?")[0] === String(alert.productUrl).split("?")[0];

        if (sameCode || sameId || sameUrl) {
            return {
                id,
                ...product
            };
        }
    }

    return null;
}

async function fillAlertMissingProductData(alert) {
    const product = await findProductForAlert(alert);

    if (!product) return alert;

    return {
        ...alert,
        productName: alert.productName || product.name || product.title || "",
        productCode: alert.productCode || product.productCode || product.id || "",
        productUrl: alert.productUrl || product.productUrl || product.url || "",
        productImage: alert.productImage || getProductImageFromProduct(product)
    };
}

async function updateProductStockInFirebase(alert, stock) {
    const productsData = await firebaseGet("products");

    if (!productsData) return;

    const products = Object.entries(productsData);

    for (const [productId, product] of products) {
        const sameCode =
            product.productCode &&
            alert.productCode &&
            String(product.productCode) === String(alert.productCode);

        const sameUrl =
            product.productUrl &&
            alert.productUrl &&
            String(product.productUrl).split("?")[0] === String(alert.productUrl).split("?")[0];

        if (sameCode || sameUrl) {
            const availableSizes = stock.availableSizes || [];
            const soldOutSizes = stock.soldOutSizes || [];

            await firebaseUpdate(`products/${productId}`, {
                stockStatus: availableSizes.length > 0 ? "in_stock" : "out_of_stock",
                isOutOfStock: availableSizes.length === 0,
                hasAddButton: stock.hasAddButton === true,
                availableSizes,
                soldOutSizes,
                sizeOptions: stock.sizeOptions || [],
                lastStockCheckedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log(
                "Đã cập nhật stock sản phẩm:",
                product.productCode || productId,
                stock.inStock ? "in_stock" : "out_of_stock"
            );
        }
    }
}

async function saveWatchAlert(payload) {
    const {
        productUrl,
        productCode,
        productName,
        productImage,
        email,
        targetSize
    } = payload;

    if (!productUrl || !email) {
        return {
            success: false,
            status: 400,
            message: "Thiếu link sản phẩm hoặc email."
        };
    }

    const cleanTargetSize = normalizeSize(targetSize);

    if (!cleanTargetSize) {
        return {
            success: false,
            status: 400,
            message: "Thiếu size cần canh back."
        };
    }

    const id = makeFirebaseKey(`${email}_${productCode || productUrl}_${cleanTargetSize}`);
    const oldData = await firebaseGet(`stock_alerts/${id}`);

    const data = {
        productUrl,
        productCode: productCode || "",
        productName: productName || "",
        productImage: productImage || oldData?.productImage || "",
        email,
        targetSize: cleanTargetSize,
        status: "watching",
        notified: false,
        notifyCount: Number(oldData?.notifyCount || 0),
        createdAt: oldData?.createdAt || new Date().toISOString(),
        rewatchedAt: oldData ? new Date().toISOString() : "",
        updatedAt: new Date().toISOString()
    };

    await firebaseSet(`stock_alerts/${id}`, data);

    return {
        success: true,
        message: `Đã lưu canh back size ${cleanTargetSize}. Khi Zara có đúng size này, hệ thống sẽ gửi mail.`,
        id
    };
}

async function listStockAlerts() {
    const alertsData = await firebaseGet("stock_alerts");

    const alerts = alertsData
        ? Object.entries(alertsData).map(([id, value]) => ({
            id,
            ...value
        }))
        : [];

    alerts.sort((a, b) => {
        return String(b.updatedAt || b.createdAt || "").localeCompare(
            String(a.updatedAt || a.createdAt || "")
        );
    });

    return alerts;
}

async function stopStockAlert(id) {
    if (!id) {
        return {
            success: false,
            status: 400,
            message: "Thiếu id canh back."
        };
    }

    await firebaseUpdate(`stock_alerts/${id}`, {
        status: "stopped",
        stoppedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        success: true,
        message: "Đã dừng canh back."
    };
}

async function rewatchStockAlert(id) {
    if (!id) {
        return {
            success: false,
            status: 400,
            message: "Thiếu id canh back."
        };
    }

    await firebaseUpdate(`stock_alerts/${id}`, {
        status: "watching",
        notified: false,
        rewatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    return {
        success: true,
        message: "Đã bật canh lại."
    };
}

async function deleteStockAlert(id) {
    if (!id) {
        return {
            success: false,
            status: 400,
            message: "Thiếu id canh back."
        };
    }

    await firebaseDelete(`stock_alerts/${id}`);

    return {
        success: true,
        message: "Đã xóa khỏi danh sách canh back."
    };
}

async function checkSingleStock(productUrl, targetSize = "") {
    if (!productUrl) {
        return {
            success: false,
            status: 400,
            message: "Thiếu link sản phẩm Zara."
        };
    }

    const browser = await createBrowser();

    try {
        const stock = await checkOneZaraStock(browser, productUrl, targetSize || "");

        return {
            success: true,
            data: stock
        };
    } finally {
        await browser.close().catch(() => {});
    }
}

async function checkStockAlerts() {
    console.log("Đang kiểm tra sản phẩm Zara theo dõi...");

    const alertsData = await firebaseGet("stock_alerts");

    if (!alertsData) {
        console.log("Chưa có sản phẩm nào cần theo dõi.");
        return;
    }

    const alerts = Object.entries(alertsData)
        .map(([id, value]) => ({
            id,
            ...value
        }))
        .filter(alert => {
            return (
                alert.productUrl &&
                (
                    alert.status === "watching" ||
                    alert.status === "notified_waiting_soldout"
                )
            );
        });

    if (alerts.length === 0) {
        console.log("Không có sản phẩm nào đang canh back.");
        return;
    }

    const browser = await createBrowser();

    for (const rawAlert of alerts) {
        const alert = await fillAlertMissingProductData(rawAlert);

        try {
            console.log("Kiểm tra:", alert.productName || alert.productCode || alert.productUrl);

            if (alert.targetSize) {
                console.log("Đang canh size:", alert.targetSize);
            }

            const stock = await checkOneZaraStock(
                browser,
                alert.productUrl,
                alert.targetSize || ""
            );

            const commonUpdate = {
                productName: alert.productName || "",
                productCode: alert.productCode || "",
                productImage: alert.productImage || "",
                lastCheckedAt: new Date().toISOString(),
                lastStockStatus: stock,
                lastAvailableSizes: stock.availableSizes || [],
                lastSoldOutSizes: stock.soldOutSizes || [],
                lastSizeMatched: stock.sizeMatched === true,
                updatedAt: new Date().toISOString()
            };

            await firebaseUpdate(`stock_alerts/${alert.id}`, commonUpdate);
            await updateProductStockInFirebase(alert, stock);

            if (alert.status === "watching") {
                if (stock.inStock === true) {
                    await sendStockEmail(alert);

                    const nextNotifyCount = Number(alert.notifyCount || 0) + 1;

                    await firebaseUpdate(`stock_alerts/${alert.id}`, {
                        status: "notified_waiting_soldout",
                        notified: true,
                        notifyCount: nextNotifyCount,
                        notifiedAt: new Date().toISOString(),
                        lastNotifiedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    console.log("Đã gửi mail:", alert.email);
                } else {
                    if (alert.targetSize) {
                        console.log(`Chưa có size ${alert.targetSize}. Tiếp tục canh.`);
                    } else {
                        console.log("Sản phẩm vẫn chưa có hàng.");
                    }
                }

                continue;
            }

            if (alert.status === "notified_waiting_soldout") {
                if (stock.inStock === false) {
                    await firebaseUpdate(`stock_alerts/${alert.id}`, {
                        status: "watching",
                        notified: false,
                        rearmedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    console.log("Size đã hết lại, đã bật canh lại cho vòng sau.");
                } else {
                    console.log("Size vẫn đang còn, không gửi lặp mail để tránh spam.");
                }
            }
        } catch (error) {
            console.log("Lỗi kiểm tra stock:", error.message);

            await firebaseUpdate(`stock_alerts/${rawAlert.id}`, {
                lastError: error.message,
                updatedAt: new Date().toISOString()
            });
        }
    }

    await browser.close();
}

module.exports = {
    saveWatchAlert,
    listStockAlerts,
    stopStockAlert,
    rewatchStockAlert,
    deleteStockAlert,
    checkSingleStock,
    checkStockAlerts
};