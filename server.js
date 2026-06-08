const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

const DATA_FILE = path.join(__dirname, 'data.json');

const defaultData = {
    _settings: { hiddenCategories: [] },
    watermark_club: [],
    watermark_car: [],
    design_car: [],
    original_club: []
};

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE);
    const data = JSON.parse(raw);
    if (!data._settings) data._settings = { hiddenCategories: [] };
    // 兼容旧数据补全新字段（remark, recipients等）
    for (let item of data.watermark_club) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.recipients === undefined) v.recipients = [];
            }
        }
    }
    for (let item of data.watermark_car) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.recipients === undefined) v.recipients = [];
            }
        }
    }
    for (let item of data.design_car) {
        if (item.remark === undefined) item.remark = '';
        if (item.carStatus === undefined) item.carStatus = 'on';
    }
    for (let item of data.original_club) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
    }
    return data;
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function nextId(arr) {
    return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1;
}

function checkAdmin(req, res, next) {
    const pwd = req.headers['x-admin-password'];
    if (pwd === '001128') return next();
    res.status(401).json({ error: '密码错误' });
}

app.get('/api/items/:category', (req, res) => {
    const data = loadData();
    const category = req.params.category;
    res.json(data[category] || []);
});

app.get('/api/settings', (req, res) => {
    const data = loadData();
    res.json(data._settings);
});

app.put('/api/settings', checkAdmin, (req, res) => {
    const data = loadData();
    data._settings = req.body;
    saveData(data);
    res.json(data._settings);
});

app.post('/api/items/:category', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    if (!data[category]) return res.status(400).json({ error: '分类无效' });
    const newItem = { ...req.body, id: nextId(data[category]) };
    data[category].push(newItem);
    saveData(data);
    res.json(newItem);
});

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

app.delete('/api/items/:category/:id', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    data[category] = data[category].filter(i => i.id !== id);
    saveData(data);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务运行在端口 ${PORT}`);
});