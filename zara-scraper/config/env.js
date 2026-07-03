require("dotenv").config();

const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || process.env.FIREBASE_DATABASE_URL || "";
const PORT = process.env.PORT || 3000;
const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_PASS = process.env.MAIL_PASS || "";

if (!FIREBASE_DB_URL) {
    console.warn("Thiếu FIREBASE_DB_URL hoặc FIREBASE_DATABASE_URL trong Environment Variables.");
}

if (!MAIL_USER || !MAIL_PASS) {
    console.warn("Thiếu MAIL_USER hoặc MAIL_PASS trong Environment Variables. Chức năng gửi mail có thể lỗi.");
}

module.exports = {
    FIREBASE_DB_URL,
    PORT,
    MAIL_USER,
    MAIL_PASS
};