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
    original_club: [],
    exchanged: []      // 【已换到】分类独立存储
};

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE);
    const data = JSON.parse(raw);
    if (!data._settings) data._settings = { hiddenCategories: [] };
    if (!data.exchanged) data.exchanged = [];
    // 兼容旧数据
    for (let item of data.watermark_club) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.adminRemark === undefined) v.adminRemark = '';
            }
        }
    }
    for (let item of data.watermark_car) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.adminRemark === undefined) v.adminRemark = '';
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

// 获取某分类的所有项
app.get('/api/items/:category', (req, res) => {
    const data = loadData();
    const category = req.params.category;
    if (category === 'exchanged') {
        res.json(data.exchanged);
    } else {
        res.json(data[category] || []);
    }
});

// 获取设置
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

// 新增项（通用）
app.post('/api/items/:category', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    if (category === 'exchanged') {
        const newItem = { ...req.body, id: nextId(data.exchanged) };
        data.exchanged.push(newItem);
        saveData(data);
        res.json(newItem);
    } else if (data[category]) {
        const newItem = { ...req.body, id: nextId(data[category]) };
        data[category].push(newItem);
        saveData(data);
        res.json(newItem);
    } else {
        res.status(400).json({ error: '分类无效' });
    }
});

// 修改项
app.put('/api/items/:category/:id', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    if (category === 'exchanged') {
        const index = data.exchanged.findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: '不存在' });
        data.exchanged[index] = { ...req.body, id };
        saveData(data);
        res.json(data.exchanged[index]);
    } else if (data[category]) {
        const index = data[category].findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: '不存在' });
        data[category][index] = { ...req.body, id };
        saveData(data);
        res.json(data[category][index]);
    } else {
        res.status(400).json({ error: '分类无效' });
    }
});

// 删除项
app.delete('/api/items/:category/:id', checkAdmin, (req, res) => {
    const data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    if (category === 'exchanged') {
        data.exchanged = data.exchanged.filter(i => i.id !== id);
        saveData(data);
        res.json({ success: true });
    } else if (data[category]) {
        data[category] = data[category].filter(i => i.id !== id);
        saveData(data);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: '分类无效' });
    }
});

// 获取所有友情赠版本（用于【可互换】）
app.get('/api/friendgift/items', (req, res) => {
    const data = loadData();
    const result = [];
    // 处理水印会
    for (const item of data.watermark_club) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            for (let idx = 0; idx < item.friendGift.versions.length; idx++) {
                const ver = item.friendGift.versions[idx];
                result.push({
                    id: `club_${item.id}_${idx}`,    // 唯一标识
                    originalId: item.id,
                    originalCategory: 'watermark_club',
                    originalName: item.name,
                    versionName: ver.version,
                    deadline: ver.deadline,
                    copies: ver.copies,
                    recipients: ver.recipients || [],
                    imageUrl: ver.imageUrl,
                    adminRemark: ver.adminRemark || ''
                });
            }
        }
    }
    // 处理水印车
    for (const item of data.watermark_car) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            for (let idx = 0; idx < item.friendGift.versions.length; idx++) {
                const ver = item.friendGift.versions[idx];
                result.push({
                    id: `car_${item.id}_${idx}`,
                    originalId: item.id,
                    originalCategory: 'watermark_car',
                    originalName: item.name,
                    versionName: ver.version,
                    deadline: ver.deadline,
                    copies: ver.copies,
                    recipients: ver.recipients || [],
                    imageUrl: ver.imageUrl,
                    adminRemark: ver.adminRemark || ''
                });
            }
        }
    }
    res.json(result);
});

// 更新某个友情赠版本的备注
app.put('/api/friendgift/remark', checkAdmin, (req, res) => {
    const { originalCategory, originalId, versionIndex, remark } = req.body;
    const data = loadData();
    const categoryData = data[originalCategory];
    if (!categoryData) return res.status(404).json({ error: '分类不存在' });
    const item = categoryData.find(i => i.id === originalId);
    if (!item) return res.status(404).json({ error: '物品不存在' });
    if (!item.friendGift || !item.friendGift.versions || !item.friendGift.versions[versionIndex]) {
        return res.status(404).json({ error: '版本不存在' });
    }
    item.friendGift.versions[versionIndex].adminRemark = remark;
    saveData(data);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务运行在端口 ${PORT}`);
});