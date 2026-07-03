const express = require("express");
const cors = require("cors");

const { PORT } = require("./config/env");
const zaraRoutes = require("./routes/zaraRoutes");
const stockAlertRoutes = require("./routes/stockAlertRoutes");
const { checkStockAlerts } = require("./services/stockAlertService");

const app = express();

app.use(cors());
app.use(express.json({ limit: "30mb" }));

app.get("/", (req, res) => {
    res.send("QL Zara server is running");
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        ok: true,
        message: "QL Zara server is running",
        time: new Date().toISOString()
    });
});

app.use("/", zaraRoutes);
app.use("/stock-alerts", stockAlertRoutes);

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runStockAlertCheck(reason = "auto") {
    try {
        console.log(`[stock-alert] Bắt đầu kiểm tra: ${reason}`);
        await checkStockAlerts();
        console.log(`[stock-alert] Kiểm tra xong: ${reason}`);
    } catch (error) {
        console.log("[stock-alert] Lỗi kiểm tra stock:", error.message);
    }
}

app.listen(PORT, () => {
    console.log(`QL Zara server đang chạy tại port ${PORT}`);

    runStockAlertCheck("server-start");

    setInterval(() => {
        runStockAlertCheck("interval");
    }, CHECK_INTERVAL_MS);
});