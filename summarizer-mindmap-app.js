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

const LABEL_COLOR = { dark: ['#e2e8f0', '#67e8f9', '#7dd3fc', '#94a3b8'], light: ['#0f172a', '#0e7490', '#0369a1', '#475569'] };

function updateNodeColors(node, isLight, depth) {
    if (!node) return;
    const idx = Math.min(depth, 3);
    if (node.label) node.label.color = isLight ? LABEL_COLOR.light[idx] : LABEL_COLOR.dark[idx];
    if (node.children) node.children.forEach(c => updateNodeColors(c, isLight, depth + 1));
}

// ── Build a hierarchical tree from the summarizer's flat rows ──────────────
// Row shape (from modals/summarizer-modal.js): { main, sub, subsub, desc }.
// Rows for the same main/sub topic are not guaranteed to be contiguous (they
// may arrive from different chunks/calls), so we group explicitly instead of
// relying on sequential CSV-style tracking.

function buildTree(rows, rootName) {
    const root = { name: rootName || 'סיכום המסמך', children: [], _mains: new Map() };
    const appendDesc = (node, desc) => {
        if (!desc) return;
        node.desc = node.desc ? node.desc + '\n\n' + desc : desc;
    };

    for (const r of (rows || [])) {
        const mainName = r.main || 'ללא נושא';
        let mainNode = root._mains.get(mainName);
        if (!mainNode) {
            mainNode = { name: mainName, children: [], _subs: new Map() };
            root._mains.set(mainName, mainNode);
            root.children.push(mainNode);
        }
        if (!r.sub && !r.subsub) { appendDesc(mainNode, r.desc); continue; }

        const subName = r.sub || mainName;
        let subNode = mainNode._subs.get(subName);
        if (!subNode) {
            subNode = { name: subName, children: [], _subsubs: new Map() };
            mainNode._subs.set(subName, subNode);
            mainNode.children.push(subNode);
        }
        if (!r.subsub) { appendDesc(subNode, r.desc); continue; }

        let leafNode = subNode._subsubs.get(r.subsub);
        if (!leafNode) {
            leafNode = { name: r.subsub, children: [] };
            subNode._subsubs.set(r.subsub, leafNode);
            subNode.children.push(leafNode);
        }
        appendDesc(leafNode, r.desc);
    }

    stripHelperMaps(root);
    rollupDesc(root);
    return root;
}

// Rows always carry `desc` on the deepest level present in that row (almost
// always the subsub leaf, since the model fills all 3 levels), so main/sub
// nodes end up with no desc of their own and show an empty panel on click.
// Give every level something meaningful: if a node has no desc of its own,
// summarize its children (bounded, so this stays cheap and short even near
// the root — it never concatenates a child's full rolled-up text, only a
// truncated first line of it).
const ROLLUP_MAX_CHILDREN = 8;
const ROLLUP_LINE_LEN = 90;

function rollupDesc(node) {
    if (!node.children || !node.children.length) return;
    node.children.forEach(rollupDesc);
    if (node.desc) return;
    const shown = node.children.slice(0, ROLLUP_MAX_CHILDREN);
    const lines = shown.map(c => {
        const firstLine = (c.desc || '').split('\n')[0];
        return firstLine ? `• ${c.name} — ${truncateText(firstLine, ROLLUP_LINE_LEN)}` : `• ${c.name}`;
    });
    if (node.children.length > shown.length) {
        lines.push(`ועוד ${node.children.length - shown.length} נושאים...`);
    }
    node.desc = lines.join('\n');
}

function truncateText(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function stripHelperMaps(node) {
    delete node._mains;
    delete node._subs;
    delete node._subsubs;
    if (node.children) node.children.forEach(stripHelperMaps);
}

// ── Load data (localStorage + BroadcastChannel) ─────────────────────────────

function loadFromStorage() {
    try {
        const raw = localStorage.getItem('summarizer-mindmap-data');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return false;
        const fileName = (parsed.meta && parsed.meta.fileName) || 'קובץ';
        renderRows(parsed.rows, fileName);
        return true;
    } catch {
        return false;
    }
}

function renderRows(rows, fileName) {
    currentTree = buildTree(rows, fileName);
    const el = document.getElementById('header-filename');
    if (el) el.textContent = fileName;
    document.getElementById('empty-state').style.display = 'none';
    initChart(buildEchartsNode(currentTree, 0));
    showRootSummary(currentTree);
    if (typeof onTreeLoaded === 'function') onTreeLoaded(currentTree);
}

function showRootSummary(tree) {
    if (!tree) return;
    showPanel({ name: tree.name, desc: tree.desc || `${tree.children.length} נושאים ראשיים` });
}

const LABEL_MAX_WIDTH = 160;

function buildEchartsNode(node, depth) {
    const idx = Math.min(depth, 3);
    const sizes = [22, 16, 12, 8];
    const colors = ['#e2e8f0', '#0891b2', '#0ea5e9', '#94a3b8'];
    const isLight = document.body.classList.contains('light-mode');
    const labelColor = isLight ? LABEL_COLOR.light[idx] : LABEL_COLOR.dark[idx];
    const fontWeights = ['800', '700', '500', 'normal'];
    const fontSizes = [BASE_FONT_SIZES.root, BASE_FONT_SIZES.level1, BASE_FONT_SIZES.level2, BASE_FONT_SIZES.level3];
    return {
        name: node.name,
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

function initChart(data) {
    const chartDom = document.getElementById('chart-area');
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);
    myChart.setOption({
        tooltip: { trigger: 'item', triggerOn: 'mousemove', formatter: '{b}', backgroundColor: 'rgba(30,41,59,0.95)', textStyle: { color: '#e2e8f0', fontFamily: 'Heebo' }, borderColor: '#475569', borderWidth: 1, padding: [8, 12] },
        series: [{
            type: 'tree',
            data: [data],
            orient: 'RL',
            top: '8%', left: '20%', bottom: '8%', right: '15%',
            roam: true,
            label: { position: 'left', verticalAlign: 'middle', align: 'right', fontFamily: 'Heebo', padding: [5, 10], backgroundColor: '#1e293b', borderRadius: 6, shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 5, shadowOffsetY: 2, overflow: 'truncate', width: LABEL_MAX_WIDTH, ellipsis: '…' },
            leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
            lineStyle: { color: '#475569', width: 2, curveness: 0.6 },
            expandAndCollapse: true,
            animationDuration: 550,
            initialTreeDepth: 1
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
    document.getElementById('info-desc').innerText = d.desc || 'אין תיאור נוסף לצומת זה.';
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

// ── Load an existing summary from a previously-downloaded Excel file ───────
// Unlike NATURAL's mind-map file (which embeds a hidden "_data" JSON sheet),
// the summarizer's Excel is the plain visible sheet the user already
// downloads — so we parse its four Hebrew-named columns back into rows.

const SUM_COL_MAIN = 'נושא ראשי', SUM_COL_SUB = 'נושא משני', SUM_COL_SUBSUB = 'תת נושא', SUM_COL_DESC = 'תיאור';

function parseSummaryRows(wb) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!aoa.length) return [];
    const header = aoa[0].map(h => String(h || '').trim());
    const iMain = header.indexOf(SUM_COL_MAIN);
    const iSub = header.indexOf(SUM_COL_SUB);
    const iSubsub = header.indexOf(SUM_COL_SUBSUB);
    const iDesc = header.indexOf(SUM_COL_DESC);
    if (iMain === -1 && iSub === -1 && iSubsub === -1 && iDesc === -1) {
        throw new Error('קובץ זה אינו קובץ סיכום של סוכן "המסכם" — לא נמצאו עמודות מוכרות.');
    }
    return aoa.slice(1)
        .filter(row => row && row.some(c => c != null && String(c).trim()))
        .map(row => ({
            main:   String((iMain   !== -1 ? row[iMain]   : '') ?? '').trim(),
            sub:    String((iSub    !== -1 ? row[iSub]    : '') ?? '').trim(),
            subsub: String((iSubsub !== -1 ? row[iSubsub] : '') ?? '').trim(),
            desc:   String((iDesc   !== -1 ? row[iDesc]   : '') ?? '').trim(),
        }))
        .filter(r => r.main || r.sub || r.subsub || r.desc);
}

window.loadMindmapFromExcel = async function (file) {
    if (!file) return;
    const input = document.getElementById('sum-mm-load-file-input');
    try {
        if (typeof XLSX === 'undefined') throw new Error('ספריית Excel לא נטענה.');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const rows = parseSummaryRows(wb);
        if (!rows.length) throw new Error('לא נמצאו רשומות בקובץ.');

        renderRows(rows, file.name);
        try {
            localStorage.setItem('summarizer-mindmap-data', JSON.stringify({ rows, meta: { fileName: file.name } }));
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
    const bc = new BroadcastChannel('summarizer-mindmap');
    bc.onmessage = () => loadFromStorage();
} catch { /* BroadcastChannel unavailable */ }
