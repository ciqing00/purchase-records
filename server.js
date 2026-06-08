const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.')); // 提供前端页面

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data.json');

// 初始化数据结构
const defaultData = {
    watermark_club: [],
    watermark_car: [],
    design_car: [],
    original_club: []
};

// 读取数据
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE);
    return JSON.parse(raw);
}

// 保存数据
function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 辅助：生成简单ID
function nextId(arr) {
    return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1;
}

// 检查管理员密码（简单验证）
function checkAdmin(req, res, next) {
    const pwd = req.headers['x-admin-password'];
    if (pwd === '001128') return next();
    res.status(401).json({ error: '密码错误' });
}

// 获取某分类的所有项
app.get('/api/items/:category', (req, res) => {
    const data = loadData();
    const category = req.params.category;
    res.json(data[category] || []);
});

// 新增项
app.post('/api/items/:category', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    if (!data[category]) return res.status(400).json({ error: '分类无效' });
    const newItem = { ...req.body, id: nextId(data[category]) };
    data[category].push(newItem);
    saveData(data);
    res.json(newItem);
});

// 修改项
app.put('/api/items/:category/:id', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    const index = data[category].findIndex(i => i.id === id);
    if (index === -1) return res.status(404).json({ error: '不存在' });
    data[category][index] = { ...req.body, id };
    saveData(data);
    res.json(data[category][index]);
});

// 删除项
app.delete('/api/items/:category/:id', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    data[category] = data[category].filter(i => i.id !== id);
    saveData(data);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务已启动，请访问 http://localhost:${PORT}`);
    console.log(`📱 局域网访问：http://${getLocalIp()}:${PORT}`);
});

function getLocalIp() {
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}
