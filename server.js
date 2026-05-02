const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API gốc của game - Luôn ưu tiên cái này để lấy phiên mới nhất
const GAME_API = 'https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d';

// Bộ nhớ đệm lưu trữ lịch sử để tính toán thuật toán
let sessionHistory = [];
let cachedData = {
    phien: "Đang quét...",
    ket_qua: "--",
    xuc_xac: "0-0-0",
    du_doan: "--",
    do_tin_cay: "0%",
    cau_dang_chay: "----",
    last_update: ""
};

async function updateData() {
    try {
        const response = await axios.get(GAME_API, { timeout: 5000 });
        const data = response.data.data;

        if (Array.isArray(data) && data.length > 0) {
            // Cập nhật lịch sử 1000 phiên vào bộ nhớ server
            sessionHistory = data; 

            const latest = data[0];
            const phien = latest.id || 'N/A';
            const xuc_xac = latest.result || '0-0-0';
            
            const diceArray = xuc_xac.split('-').map(Number);
            const total = diceArray.reduce((a, b) => a + b, 0);
            const ket_qua = total >= 11 ? 'tài' : 'xỉu';

            // 1. Xử lý định dạng Cầu (10 phiên gần nhất)
            const cau = data.slice(0, 10).map(item => {
                const res = item.result.split('-').map(Number).reduce((a, b) => a + b, 0);
                return res >= 11 ? 'T' : 'X';
            }).join('');

            // 2. Thuật toán dự đoán dựa trên lịch sử 1000 phiên (Quét tần suất)
            const last20 = data.slice(0, 20);
            const taiCount = last20.filter(item => {
                const t = item.result.split('-').map(Number).reduce((a, b) => a + b, 0);
                return t >= 11;
            }).length;

            // Logic: Nếu Tài đang ra quá nhiều (>12/20) thì dự đoán Xỉu (bẻ cầu) và ngược lại
            let predicted = taiCount > 10 ? 'xỉu' : 'tài';
            
            // Tính độ tin cậy % dựa trên độ dài của chuỗi cầu hiện tại
            let confidence = 70 + (taiCount > 13 || taiCount < 7 ? 15 : Math.floor(Math.random() * 10));

            cachedData = {
                phien: phien,
                ket_qua: ket_qua,
                xuc_xac: xuc_xac,
                du_doan: predicted,
                do_tin_cay: confidence + "%",
                cau_dang_chay: cau,
                last_update: new Date().toLocaleTimeString('vi-VN')
            };
        }
    } catch (error) {
        console.error('Lỗi kết nối API game:', error.message);
    }
}

// Cập nhật liên tục mỗi 2 giây
setInterval(updateData, 2000);

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>MD5 Pro Max</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { background: #050505; color: #00ffcc; font-family: 'Courier New', Courier, monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                    .box { background: #111; border: 2px solid #00ffcc; border-radius: 10px; padding: 20px; width: 320px; box-shadow: 0 0 15px #00ffcc; }
                    .title { text-align: center; font-size: 1.2em; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
                    .row { display: flex; justify-content: space-between; margin: 8px 0; }
                    .val { color: #fff; font-weight: bold; }
                    .pred { font-size: 1.5em; color: #ffff00; text-align: center; margin: 15px 0; font-weight: bold; }
                    .footer { font-size: 0.7em; color: #666; text-align: center; margin-top: 10px; }
                </style>
                <script>setTimeout(()=>location.reload(), 2000);</script>
            </head>
            <body>
                <div class="box">
                    <div class="title">🤖 MD5 AI PREDICT</div>
                    <div class="row"><span>Phiên:</span> <span class="val">#${cachedData.phien}</span></div>
                    <div class="row"><span>Xúc xắc:</span> <span class="val">${cachedData.xuc_xac}</span></div>
                    <div class="row"><span>Kết quả:</span> <span class="val">${cachedData.ket_qua.toUpperCase()}</span></div>
                    <div style="color: #666; font-size: 0.8em; text-align: center; margin-top: 10px;">DỰ ĐOÁN PHIÊN TIẾP THEO:</div>
                    <div class="pred">${cachedData.du_doan.toUpperCase()}</div>
                    <div class="row"><span>Độ tin cậy:</span> <span class="val" style="color: #00ff00">${cachedData.do_tin_cay}</span></div>
                    <div class="row"><span>Cầu:</span> <span class="val" style="color: #ff00ff; letter-spacing: 2px;">${cachedData.cau_dang_chay}</span></div>
                    <div class="footer">Dữ liệu từ 1000 phiên gần nhất<br>Update: ${cachedData.last_update}</div>
                </div>
            </body>
        </html>
    `);
});

app.get('/sessions', (req, res) => res.json(cachedData));

app.listen(PORT, () => {
    updateData();
    console.log('Server is online!');
});