const express = require("express");
const { sendStockEmail } = require("../services/mailService");

const router = express.Router();

router.post("/send", async (req, res) => {
    try {
        const { email, secret } = req.body || {};

        const serverSecret = process.env.TEST_MAIL_SECRET || "";

        if (!serverSecret) {
            return res.status(500).json({
                success: false,
                message: "Chưa cấu hình TEST_MAIL_SECRET trên Render."
            });
        }

        if (secret !== serverSecret) {
            return res.status(403).json({
                success: false,
                message: "Sai mã test mail."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Bạn chưa nhập email nhận test."
            });
        }

        await sendStockEmail({
            email,
            productName: "TEST MAIL - Zara Back Size",
            productCode: "TEST001",
            targetSize: "XS",
            productUrl: "https://www.zara.com",
            productImage: "https://static.zara.net/photos///2025/I/0/1/p/0000/000/800/2/w/563/0000000800_6_1_1.jpg"
        });

        return res.json({
            success: true,
            message: `Đã gửi mail test đến ${email}.`
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;