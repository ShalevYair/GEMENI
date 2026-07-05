let myChart = null;
let currentTree = null;
let fontScale = 1;

const BASE_FONT_SIZES = { root: 18, level1: 15, level2: 14, level3: 13 };

function changeFontSize(step) {
    const root = document.documentElement;
    let current = parseInt(getComputedStyle(root).getPropertyValue('--base-font-size'));
    let next = current + (step * 2);
    if (next >= 14 && next <= 28) {
        root.style.setProperty('--base-font-size', next + 'px');
        fontScale = next / 16;
        localStorage.setItem('sdlc-font-size', next);
        updateChartFontSizes();
    }
}

function updateChartFontSizes() {
    if (!myChart) return;
    const option = myChart.getOption();
    if (!option || !option.series || !option.series[0]) return;
    function walk(node, depth) {
        if (!node) return;
        if (node.label) {
            const size = depth === 0 ? BASE_FONT_SIZES.root
                : depth === 1 ? BASE_FONT_SIZES.level1
                : depth === 2 ? BASE_FONT_SIZES.level2
                : BASE_FONT_SIZES.level3;
            node.label.fontSize = Math.round(size * fontScale);
        }
        if (node.children) node.children.forEach(c => walk(c, depth + 1));
    }
    const seriesData = option.series[0].data;
    if (seriesData && seriesData[0]) {
        walk(seriesData[0], 0);
        myChart.setOption({ series: [{ data: seriesData }] });
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('dark-mode-btn').innerHTML = isLight ? '&#9790;' : '&#9788;';
    localStorage.setItem('sdlc-dark-mode', isLight ? 'light' : 'dark');
    updateChartTheme();
}

function updateChartTheme() {
    if (!myChart) return;
    const isLight = document.body.classList.contains('light-mode');
    myChart.setOption({
        tooltip: {
            backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)',
            textStyle: { color: isLight ? '#0f172a' : '#e2e8f0' },
            borderColor: isLight ? '#e2e8f0' : '#475569'
        },
        series: [{
            label: { backgroundColor: isLight ? '#fff' : '#1e293b', shadowColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.3)' },
            lineStyle: { color: isLight ? '#cbd5e1' : '#475569' }
        }]
    });
    const option = myChart.getOption();
    const seriesData = option.series[0].data;
    if (seriesData && seriesData[0]) {
        updateNodeColors(seriesData[0], isLight, 0);
        myChart.setOption({ series: [{ data: seriesData }] });
    }
}

const LABEL_COLOR = { dark: ['#e2e8f0', '#93bbfd', '#7dd3fc', '#94a3b8'], light: ['#0f172a', '#1d4ed8', '#0369a1', '#475569'] };

function updateNodeColors(node, isLight, depth) {
    if (!node) return;
    const idx = Math.min(depth, 3);
    if (node.label) node.label.color = isLight ? LABEL_COLOR.light[idx] : LABEL_COLOR.dark[idx];
    if (node.children) node.children.forEach(c => updateNodeColors(c, isLight, depth + 1));
}

// ── Load data (localStorage + BroadcastChannel) ─────────────────────────────

function loadFromStorage() {
    try {
        const raw = localStorage.getItem('natural-mindmap-data');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.tree) return false;
        currentTree = parsed.tree;
        const fileName = parsed.meta && parsed.meta.fileName ? parsed.meta.fileName : 'קובץ Natural';
        const el = document.getElementById('header-filename');
        if (el) el.textContent = fileName;
        document.getElementById('empty-state').style.display = 'none';
        initChart(buildEchartsNode(currentTree, 0));
        if (typeof onTreeLoaded === 'function') onTreeLoaded(currentTree);
        return true;
    } catch {
        return false;
    }
}

const LABEL_MAX_WIDTH = 130;

function buildEchartsNode(node, depth) {
    const idx = Math.min(depth, 3);
    const sizes = [22, 16, 12, 8];
    const colors = ['#e2e8f0', '#2563eb', '#0ea5e9', '#94a3b8'];
    const isLight = document.body.classList.contains('light-mode');
    const labelColor = isLight ? LABEL_COLOR.light[idx] : LABEL_COLOR.dark[idx];
    const fontWeights = ['800', '700', '500', 'normal'];
    const fontSizes = [BASE_FONT_SIZES.root, BASE_FONT_SIZES.level1, BASE_FONT_SIZES.level2, BASE_FONT_SIZES.level3];
    return {
        name: node.name,
        code: node.code || '',
        desc: node.desc || '',
        symbolSize: sizes[idx],
        itemStyle: { color: colors[idx] },
        label: {
            fontWeight: fontWeights[idx], fontSize: fontSizes[idx], color: labelColor,
            overflow: 'truncate', width: LABEL_MAX_WIDTH, ellipsis: '…',
        },
        children: (node.children || []).map(c => buildEchartsNode(c, depth + 1)),
    };
}

const INITIAL_TREE_DEPTH = 2;

function computeInitialZoom(rootNode) {
    const counts = {};
    (function walk(node, depth) {
        if (depth > INITIAL_TREE_DEPTH) return;
        counts[depth] = (counts[depth] || 0) + 1;
        if (node.children) node.children.forEach(c => walk(c, depth + 1));
    })(rootNode, 0);
    const maxSiblings = Math.max(1, ...Object.values(counts));
    const chartDom = document.getElementById('chart-area');
    const containerWidth = (chartDom && chartDom.clientWidth) || 1000;
    const estPxPerNode = 150;
    const neededWidth = maxSiblings * estPxPerNode;
    return Math.max(0.3, Math.min(1, containerWidth / neededWidth));
}

function initChart(data) {
    const chartDom = document.getElementById('chart-area');
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);
    myChart.setOption({
        tooltip: { trigger: 'item', triggerOn: 'mousemove', formatter: '{b}', backgroundColor: 'rgba(30,41,59,0.95)', textStyle: { color: '#e2e8f0', fontFamily: 'Heebo' }, borderColor: '#475569', borderWidth: 1, padding: [8, 12] },
        series: [{
            type: 'tree',
            data: [data],
            orient: 'TB',
            top: '10%', left: '8%', bottom: '5%', right: '8%',
            roam: true,
            zoom: computeInitialZoom(data),
            label: {
                position: 'top', verticalAlign: 'bottom', align: 'center', fontFamily: 'Heebo', padding: [5, 10],
                backgroundColor: '#1e293b', borderRadius: 6, shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 5, shadowOffsetY: 2,
                overflow: 'truncate', width: LABEL_MAX_WIDTH, ellipsis: '…',
            },
            leaves: { label: { position: 'bottom', verticalAlign: 'top', align: 'center' } },
            lineStyle: { color: '#475569', width: 2, curveness: 0.5 },
            expandAndCollapse: true,
            animationDuration: 550,
            initialTreeDepth: INITIAL_TREE_DEPTH
        }]
    });
    myChart.on('click', function (params) {
        const d = params.data;
        if (d) showPanel(d);
    });
    window.addEventListener('resize', () => myChart.resize());
    updateChartTheme();
}

function showPanel(d) {
    document.getElementById('info-default').style.display = 'none';
    document.getElementById('info-content-view').style.display = 'block';
    document.getElementById('info-title').innerText = d.name;
    const codeLine = d.code ? `קוד טכני: ${d.code}\n\n` : '';
    document.getElementById('info-desc').innerText = codeLine + (d.desc || 'אין תיאור נוסף לצומת זה.');
}

function hidePanel() {
    document.getElementById('info-default').style.display = 'block';
    document.getElementById('info-content-view').style.display = 'none';
}

function togglePanel() {
    const panel = document.getElementById('info-panel');
    const btn = document.getElementById('panel-toggle-btn');
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'flex' : 'none';
    if (btn) btn.textContent = isHidden ? '⟨⟩ פאנל' : '⟨⟩ הצג';
    if (myChart) setTimeout(() => myChart.resize(), 60);
}

// ── Load an existing mind map from a previously-downloaded Excel file ──────

window.loadMindmapFromExcel = async function (file) {
    if (!file) return;
    const input = document.getElementById('nat-load-file-input');
    try {
        if (typeof XLSX === 'undefined') throw new Error('ספריית Excel לא נטענה.');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const dataSheet = wb.Sheets['_data'];
        const cell = dataSheet && dataSheet['A1'];
        if (!cell || !cell.v) {
            throw new Error('קובץ זה אינו מכיל נתוני מפת מחשבה (גיליון "_data" חסר) — ודא שזהו קובץ Excel שהופק על ידי "מבט על" בסוכן NATURAL.');
        }
        const parsed = JSON.parse(cell.v);
        if (!parsed || !parsed.tree) throw new Error('פורמט הנתונים בקובץ אינו תקין.');

        currentTree = parsed.tree;
        const fileName = (parsed.meta && parsed.meta.fileName) || file.name;
        const el = document.getElementById('header-filename');
        if (el) el.textContent = fileName;
        document.getElementById('empty-state').style.display = 'none';
        hidePanel();
        initChart(buildEchartsNode(currentTree, 0));
        if (typeof onTreeLoaded === 'function') onTreeLoaded(currentTree);
        try {
            localStorage.setItem('natural-mindmap-data', JSON.stringify({ tree: currentTree, meta: { fileName } }));
        } catch { /* localStorage unavailable */ }
    } catch (err) {
        alert('שגיאה בטעינת הקובץ: ' + (err.message || err));
    } finally {
        if (input) input.value = '';
    }
};

document.addEventListener('DOMContentLoaded', function () {
    var savedMode = localStorage.getItem('sdlc-dark-mode');
    if (savedMode === 'light') {
        document.body.classList.add('light-mode');
        var btn = document.getElementById('dark-mode-btn');
        if (btn) btn.innerHTML = '&#9790;';
    }
    var savedSize = parseInt(localStorage.getItem('sdlc-font-size') || '16');
    if (savedSize !== 16) {
        document.documentElement.style.setProperty('--base-font-size', savedSize + 'px');
        fontScale = savedSize / 16;
    }
    loadFromStorage();
});

try {
    const bc = new BroadcastChannel('natural-mindmap');
    bc.onmessage = () => loadFromStorage();
} catch { /* BroadcastChannel unavailable */ }
