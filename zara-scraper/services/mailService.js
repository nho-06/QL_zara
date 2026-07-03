const nodemailer = require("nodemailer");
const { MAIL_USER, MAIL_PASS } = require("../config/env");

const mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: MAIL_USER,
        pass: MAIL_PASS
    }
});

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function sendStockEmail(alert) {
    if (!alert.email) return;

    if (
        !MAIL_USER ||
        MAIL_USER.includes("EMAIL_CUA_BAN") ||
        !MAIL_PASS ||
        MAIL_PASS.includes("APP_PASSWORD")
    ) {
        throw new Error("Chưa cấu hình MAIL_USER / MAIL_PASS trong config/env.js.");
    }

    const productName = alert.productName || alert.productCode || "Sản phẩm Zara";
    const productCode = alert.productCode || "";
    const productUrl = alert.productUrl || "";
    const productImage = alert.productImage || "";
    const targetSize = alert.targetSize || "";

    const subject = targetSize
        ? `Zara back size ${targetSize}: ${productName}`
        : `Zara có hàng lại: ${productName}`;

    const productImageHtml = productImage
        ? `
            <div style="margin: 18px 0;">
                <img
                    src="${escapeHtml(productImage)}"
                    alt="${escapeHtml(productName)}"
                    style="
                        width: 260px;
                        max-width: 100%;
                        border-radius: 12px;
                        border: 1px solid #eee;
                        display: block;
                        background: #f7f7f7;
                    "
                >
            </div>
        `
        : `
            <p style="color:#999;">
                Không có ảnh sản phẩm trong dữ liệu canh back.
            </p>
        `;

    const html = `
        <div style="
            font-family: Arial, sans-serif;
            color: #222;
            line-height: 1.6;
            max-width: 560px;
        ">
            <h2 style="
                color: #9b4a60;
                margin-bottom: 10px;
            ">
                Sản phẩm Zara đã có hàng lại
            </h2>

            ${productImageHtml}

            <p>
                <b>Tên sản phẩm:</b>
                ${escapeHtml(productName)}
            </p>

            <p>
                <b>Mã sản phẩm:</b>
                ${escapeHtml(productCode)}
            </p>

            ${
                targetSize
                    ? `
                        <p>
                            <b>Size đang canh:</b>
                            ${escapeHtml(targetSize)}
                        </p>
                    `
                    : ""
            }

            <p style="margin-top: 18px;">
                <a
                    href="${escapeHtml(productUrl)}"
                    target="_blank"
                    style="
                        display: inline-block;
                        background: #111;
                        color: #fff;
                        padding: 12px 18px;
                        border-radius: 8px;
                        text-decoration: none;
                        font-weight: bold;
                    "
                >
                    Mở sản phẩm Zara
                </a>
            </p>

            <p style="color: #777; font-size: 13px; margin-top: 18px;">
                Link trực tiếp:
                <br>
                <a href="${escapeHtml(productUrl)}" target="_blank">
                    ${escapeHtml(productUrl)}
                </a>
            </p>

            <p style="color: #999; font-size: 12px; margin-top: 24px;">
                Email này được gửi tự động từ hệ thống canh back Zara.
            </p>
        </div>
    `;

    await mailTransporter.sendMail({
        from: `"Zara Stock Alert" <${MAIL_USER}>`,
        to: alert.email,
        subject,
        html
    });
}

module.exports = {
    sendStockEmail,
    escapeHtml
};