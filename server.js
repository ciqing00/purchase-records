// 持久化卷路径（Railway 挂载到 /data）
const DATA_FILE = '/data/data.json';

// 初始数据结构（包含新字段和设置）
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
    // ... 后续兼容性代码保持不变 ...
}