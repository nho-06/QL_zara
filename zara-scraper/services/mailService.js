const nodemailer = require("nodemailer");

const { MAIL_USER, MAIL_PASS } = require("../config/env");

function createTransporter() {
    if (!MAIL_USER || !MAIL_PASS) {
        throw new Error("Thiếu MAIL_USER hoặc MAIL_PASS trong Environment Variables.");
    }

    return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: MAIL_USER,
            pass: MAIL_PASS
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
    });
}

function buildStockEmailHtml(alert) {
    const productName = alert.productName || "Sản phẩm Zara";
    const productCode = alert.productCode || alert.productId || "";
    const targetSize = alert.targetSize || alert.size || "";
    const productUrl = alert.productUrl || "";
    const productImage = alert.productImage || alert.imageUrl || alert.image || "";

    return `
        <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
            <h2 style="color: #9b4a60;">Zara back size rồi</h2>

            <p>Sản phẩm bạn đang canh đã có dấu hiệu back lại size.</p>

            ${
                productImage
                    ? `
                        <div style="margin: 16px 0;">
                            <img
                                src="${productImage}"
                                alt="${productName}"
                                style="max-width: 260px; border-radius: 12px; display: block;"
                            >
                        </div>
                    `
                    : ""
            }

            <p><b>Sản phẩm:</b> ${productName}</p>
            <p><b>Mã sản phẩm:</b> ${productCode}</p>
            <p><b>Size đang canh:</b> ${targetSize}</p>

            ${
                productUrl
                    ? `
                        <p>
                            <a
                                href="${productUrl}"
                                target="_blank"
                                style="
                                    display: inline-block;
                                    padding: 12px 18px;
                                    background: #9b4a60;
                                    color: #fff;
                                    text-decoration: none;
                                    border-radius: 10px;
                                    font-weight: bold;
                                "
                            >
                                Mở sản phẩm Zara
                            </a>
                        </p>
                    `
                    : ""
            }

            <p style="margin-top: 20px; color: #666;">
                Nếu bạn đã mua được rồi, hãy vào trang canh back để bấm dừng canh.
            </p>
        </div>
    `;
}

async function sendStockEmail(alert) {
    const email = alert.email;

    if (!email) {
        throw new Error("Không có email nhận thông báo.");
    }

    const productName = alert.productName || "Sản phẩm Zara";
    const targetSize = alert.targetSize || alert.size || "";

    console.log("[mail] Bắt đầu gửi mail đến:", email);
    console.log("[mail] MAIL_USER:", MAIL_USER);

    const transporter = createTransporter();

    const mailOptions = {
        from: `"QL Zara" <${MAIL_USER}>`,
        to: email,
        subject: `Zara back size ${targetSize}: ${productName}`,
        html: buildStockEmailHtml(alert)
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("[mail] Gửi mail thành công:", info.messageId);

    return info;
}

module.exports = {
    sendStockEmail
};