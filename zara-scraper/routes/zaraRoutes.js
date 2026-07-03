const express = require("express");
const { scrapeZaraProduct } = require("../zara-tools");

const router = express.Router();

router.post("/scrape-zara", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: "Thiếu link Zara"
        });
    }

    const result = await scrapeZaraProduct(url);

    if (!result.success) {
        return res.status(result.status || 500).json({
            success: false,
            message: result.message || "Không lấy được dữ liệu Zara."
        });
    }

    return res.json({
        success: true,
        data: result.data
    });
});

module.exports = router;