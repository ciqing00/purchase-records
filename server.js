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
    exchanged: []
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
    // 水印会兼容
    for (let item of data.watermark_club) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.adminRemark === undefined) v.adminRemark = '';
                if (v.recipients) {
                    for (let r of v.recipients) {
                        if (r.exchangedTo === undefined) r.exchangedTo = '';
                    }
                }
            }
        }
    }
    // 水印车兼容
    for (let item of data.watermark_car) {
        if (item.remark === undefined) item.remark = '';
        if (item.isImageSent === undefined && item.isShipped !== undefined) {
            item.isImageSent = item.isShipped;
        }
        if (item.isImageSent === undefined) item.isImageSent = false;
        delete item.isCompleted;
        delete item.isImageStored;
        delete item.isShipped;
        if (item.friendGift?.versions) {
            for (let v of item.friendGift.versions) {
                if (v.adminRemark === undefined) v.adminRemark = '';
                if (v.recipients) {
                    for (let r of v.recipients) {
                        if (r.exchangedTo === undefined) r.exchangedTo = '';
                    }
                }
            }
        }
    }
    // 设车：增加新字段
    for (let item of data.design_car) {
        if (item.remark === undefined) item.remark = '';
        if (item.carStatus === undefined) item.carStatus = 'on';
        if (item.memberCount === undefined) item.memberCount = '';
        if (item.carNumber === undefined) item.carNumber = '';
    }
    // 原创会
    for (let item of data.original_club) {
        if (item.remark === undefined) item.remark = '';
        if (item.isCompleted === undefined) item.isCompleted = false;
        if (item.isImageStored === undefined) item.isImageStored = false;
    }
    // 已换到
    for (let item of data.exchanged) {
        if (item.name === undefined) item.name = '';
    }
    saveData(data);
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

// 自动同步已换到：从友情赠版本中提取所有非空的 exchangedTo，去重后添加到 exchanged 列表
function syncExchangedFromGifts(data) {
    const exchangedNamesSet = new Set(data.exchanged.map(e => e.name));
    const newExchanged = [];
    // 遍历水印会和水印车的友情赠版本
    for (const item of data.watermark_club) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            for (const ver of item.friendGift.versions) {
                if (ver.recipients) {
                    for (const r of ver.recipients) {
                        if (r.exchangedTo && r.exchangedTo.trim() !== '' && !exchangedNamesSet.has(r.exchangedTo.trim())) {
                            exchangedNamesSet.add(r.exchangedTo.trim());
                            newExchanged.push({ name: r.exchangedTo.trim(), id: nextId(data.exchanged) });
                        }
                    }
                }
            }
        }
    }
    for (const item of data.watermark_car) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            for (const ver of item.friendGift.versions) {
                if (ver.recipients) {
                    for (const r of ver.recipients) {
                        if (r.exchangedTo && r.exchangedTo.trim() !== '' && !exchangedNamesSet.has(r.exchangedTo.trim())) {
                            exchangedNamesSet.add(r.exchangedTo.trim());
                            newExchanged.push({ name: r.exchangedTo.trim(), id: nextId(data.exchanged) });
                        }
                    }
                }
            }
        }
    }
    data.exchanged.push(...newExchanged);
    return data;
}

app.get('/api/items/:category', (req, res) => {
    const data = loadData();
    const category = req.params.category;
    if (category === 'exchanged') {
        res.json(data.exchanged);
    } else {
        res.json(data[category] || []);
    }
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
    let data = loadData();
    const category = req.params.category;
    if (category === 'exchanged') {
        const newItem = { name: req.body.name || '', id: nextId(data.exchanged) };
        data.exchanged.push(newItem);
        saveData(data);
        res.json(newItem);
    } else if (data[category]) {
        const newItem = { ...req.body, id: nextId(data[category]) };
        if (category === 'design_car') {
            delete newItem.subCategoryName;
        }
        data[category].push(newItem);
        // 如果是水印会或水印车且包含友情赠，需要同步已换到
        if (category === 'watermark_club' || category === 'watermark_car') {
            data = syncExchangedFromGifts(data);
        }
        saveData(data);
        res.json(newItem);
    } else {
        res.status(400).json({ error: '分类无效' });
    }
});

app.put('/api/items/:category/:id', checkAdmin, (req, res) => {
    let data = loadData();
    const category = req.params.category;
    const id = parseInt(req.params.id);
    if (category === 'exchanged') {
        const index = data.exchanged.findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: '不存在' });
        data.exchanged[index] = { name: req.body.name || '', id };
        saveData(data);
        res.json(data.exchanged[index]);
    } else if (data[category]) {
        const index = data[category].findIndex(i => i.id === id);
        if (index === -1) return res.status(404).json({ error: '不存在' });
        const updated = { ...req.body, id };
        if (category === 'design_car') {
            delete updated.subCategoryName;
        }
        data[category][index] = updated;
        // 如果是水印会或水印车且包含友情赠，需要同步已换到
        if (category === 'watermark_club' || category === 'watermark_car') {
            data = syncExchangedFromGifts(data);
        }
        saveData(data);
        res.json(updated);
    } else {
        res.status(400).json({ error: '分类无效' });
    }
});

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

// 获取所有友情赠版本（分组）
app.get('/api/friendgift/items', (req, res) => {
    const data = loadData();
    const result = [];
    for (const item of data.watermark_club) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            const group = {
                originalId: item.id,
                originalCategory: 'watermark_club',
                originalName: item.name,
                versions: item.friendGift.versions.map((ver, idx) => ({
                    versionIdx: idx,
                    versionName: ver.version,
                    deadline: ver.deadline,
                    copies: ver.copies,
                    recipients: ver.recipients || [],
                    imageUrl: ver.imageUrl,
                    adminRemark: ver.adminRemark || ''
                }))
            };
            if (group.versions.length) result.push(group);
        }
    }
    for (const item of data.watermark_car) {
        if (item.friendGift && item.friendGift.hasGift && item.friendGift.versions) {
            const group = {
                originalId: item.id,
                originalCategory: 'watermark_car',
                originalName: item.name,
                versions: item.friendGift.versions.map((ver, idx) => ({
                    versionIdx: idx,
                    versionName: ver.version,
                    deadline: ver.deadline,
                    copies: ver.copies,
                    recipients: ver.recipients || [],
                    imageUrl: ver.imageUrl,
                    adminRemark: ver.adminRemark || ''
                }))
            };
            if (group.versions.length) result.push(group);
        }
    }
    res.json(result);
});

// 更新友情赠版本备注
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