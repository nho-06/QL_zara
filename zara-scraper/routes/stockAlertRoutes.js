const express = require("express");

const {
    saveWatchAlert,
    listStockAlerts,
    stopStockAlert,
    rewatchStockAlert,
    deleteStockAlert,
    checkSingleStock,
    checkStockAlerts
} = require("../services/stockAlertService");

const router = express.Router();

function sendServiceResult(res, result) {
    if (!result.success) {
        return res.status(result.status || 500).json({
            success: false,
            message: result.message || "Có lỗi xảy ra."
        });
    }

    return res.json(result);
}

router.post("/watch", async (req, res) => {
    try {
        const result = await saveWatchAlert(req.body || {});
        return sendServiceResult(res, result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/list", async (req, res) => {
    try {
        const alerts = await listStockAlerts();

        return res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/stop", async (req, res) => {
    try {
        const result = await stopStockAlert(req.body?.id);
        return sendServiceResult(res, result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/rewatch", async (req, res) => {
    try {
        const result = await rewatchStockAlert(req.body?.id);
        return sendServiceResult(res, result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/delete", async (req, res) => {
    try {
        const result = await deleteStockAlert(req.body?.id);
        return sendServiceResult(res, result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.get("/check-now", async (req, res) => {
    try {
        await checkStockAlerts();

        return res.json({
            success: true,
            message: "Đã kiểm tra xong danh sách theo dõi."
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/check-now", async (req, res) => {
    try {
        const { productUrl, targetSize } = req.body || {};
        const result = await checkSingleStock(productUrl, targetSize || "");

        return sendServiceResult(res, result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;