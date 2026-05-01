let myChart = null;
let allRows = null;
let fontScale = 1;

const BASE_FONT_SIZES = { root: 18, stage: 15, subStage: 14, minor: 13 };

const AGENT_MAP = {
    'ארזסטרטור':       { display: 'ארזסטרטור',        url: 'https://gemini.google.com/gem/1wrap8ggsEfWEFnU9m6EH7xbj0Wz5mxr8?usp=sharing' },
    'סוכן PMO':        { display: 'רכזת הפרויקטים',   url: 'https://gemini.google.com/gem/1TiXnSihCx7aUOvIbMgGClCQLcVCHR7nD?usp=sharing' },
    'סוכן Make or Buy':{ display: 'לעשות או לקנות',   url: 'https://gemini.google.com/gem/1Q1Mv-H2Df1XRTAxTGp3J0RjPbJRuIdnC?usp=sharing' },
    'סוכן אפיון':      { display: 'מלך האפיונים',     url: 'https://gemini.google.com/gem/1Wk45NSaOWaYzMdYNRkFziZATwX_l9j2o?usp=sharing' },
    'סוכן Design':     { display: 'מנתח המוח',        url: 'https://gemini.google.com/gem/1JgpJ9sdy1sczJgE1fFtYMb90URyQY8eT?usp=sharing' },
    'סוכן UX/UI':      { display: 'מלכת העיצובים',   url: 'https://gemini.google.com/gem/1wuJgfOAb9ZKo3Cy9m2iYaKHCEn7_Y1yW?usp=sharing' },
    'סוכן פיתוח':      { display: 'אלוף הפיתוחים',   url: 'https://gemini.google.com/gem/1qUYu2ycI4vFPcAWxgixU3Hc7vtxzt7_-?usp=sharing' },
    'סוכן פלטפורמה':   { display: 'פלטפורמר',         url: 'https://gemini.google.com/gem/1hFvioNaOd28WWayWOjpXAzczeaicaM5c?usp=sharing' },
    'סוכן בדיקות':     { display: 'הבודק',            url: 'https://gemini.google.com/gem/1koKgxS5PrmQRRPHuTk7Uro8BUOc8yI_N?usp=sharing' },
    'סוכן Security':   { display: 'המאבטח',           url: 'https://gemini.google.com/gem/1SgIdzjrYiKL1qDs8LZna4WJOBintlRBZ?usp=sharing' },
    'סוכן Deployment': { display: 'הפורס',            url: 'https://gemini.google.com/gem/1A4ubxJYigEb_uae1IJl73b52PT5yCYpm?usp=sharing' },
    'סוכן Monitoring': { display: 'הצופה',            url: 'https://gemini.google.com/gem/1sfViXXZyyYPF0yjo5Q4dXp8OEkjFsgLX?usp=sharing' },
    'סוכן דוקומנטציה': { display: 'המתעד',            url: 'https://gemini.google.com/gem/1s4nP3PEJKavBYYn_i2B3aCIj2w4xYikN?usp=sharing' },
    'סוכן ספקים':      { display: 'מפעיל הספקים',    url: 'https://gemini.google.com/gem/1M_HZABG7nLvPtg_I7IQNXH2gOp02Vqu6?usp=sharing' }
};

// ── Font size ──────────────────────────────────────────────────────────────

function changeFontSize(step) {
    const root = document.documentElement;
    let current = parseInt(getComputedStyle(root).getPropertyValue('--base-font-size'));
    let next = current + (step * 2);
    if (next >= 14 && next <= 28) {
        root.style.setProperty('--base-font-size', next + 'px');
        fontScale = next / 16;
        updateChartFontSizes();
    }
}

function updateChartFontSizes() {
    if (!myChart) return;
    const option = myChart.getOption();
    if (!option || !option.series || !option.series[0]) return;

    function walk(node) {
        if (!node) return;
        if (node.label) {
            if (node.label.fontWeight === '800')      node.label.fontSize = Math.round(BASE_FONT_SIZES.root     * fontScale);
            else if (node.label.fontWeight === '700') node.label.fontSize = Math.round(BASE_FONT_SIZES.stage    * fontScale);
            else if (node.label.fontWeight === '500') node.label.fontSize = Math.round(BASE_FONT_SIZES.subStage * fontScale);
            else                                      node.label.fontSize = Math.round(BASE_FONT_SIZES.minor    * fontScale);
        }
        if (node.children) node.children.forEach(walk);
    }

    const seriesData = option.series[0].data;
    if (seriesData && seriesData[0]) {
        walk(seriesData[0]);
        myChart.setOption({ series: [{ data: seriesData }] });
    }
}

// ── Dark mode ──────────────────────────────────────────────────────────────

function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('dark-mode-btn').innerHTML = isLight ? '&#9790;' : '&#9788;';
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
            label: {
                backgroundColor: isLight ? '#fff' : '#1e293b',
                shadowColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.3)'
            },
            lineStyle: { color: isLight ? '#cbd5e1' : '#475569' }
        }]
    });

    const option = myChart.getOption();
    const seriesData = option.series[0].data;
    if (seriesData && seriesData[0]) {
        updateNodeColors(seriesData[0], isLight);
        myChart.setOption({ series: [{ data: seriesData }] });
    }
}

const COLOR_MAP = {
    label:     { '#e2e8f0': '#0f172a', '#93bbfd': '#1d4ed8', '#7dd3fc': '#0369a1', '#94a3b8': '#475569' },
    itemStyle: { '#e2e8f0': '#0f172a' }
};

function updateNodeColors(node, isLight) {
    if (!node) return;
    if (node.label && node.label.color) {
        for (const [dark, light] of Object.entries(COLOR_MAP.label)) {
            if (node.label.color === dark || node.label.color === light) {
                node.label.color = isLight ? light : dark;
                break;
            }
        }
    }
    if (node.itemStyle) {
        for (const [dark, light] of Object.entries(COLOR_MAP.itemStyle)) {
            if (node.itemStyle.color === dark || node.itemStyle.color === light) {
                node.itemStyle.color = isLight ? light : dark;
                break;
            }
        }
    }
    if (node.children) node.children.forEach(c => updateNodeColors(c, isLight));
}

// ── CSV & tree ─────────────────────────────────────────────────────────────

const CSV_URL = 'https://raw.githubusercontent.com/ShalevYair/MOTAgents/main/SDLC.csv';

function loadCSV() {
    fetch(CSV_URL)
        .then(r => {
            if (!r.ok) throw new Error('שגיאה בטעינת הקובץ');
            return r.text();
        })
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    allRows = results.data;
                    populateActorsDropdown(allRows);
                    const treeData = buildTreeData(allRows);
                    document.getElementById('empty-state').style.display = 'none';
                    initChart(treeData);
                }
            });
        })
        .catch(err => {
            document.getElementById('empty-state').innerHTML = `
                <div style="color:#ef4444;margin-bottom:15px;font-size:3rem;">⚠</div>
                <h2 style="font-weight:300;margin:10px 0;">שגיאה בטעינת הנתונים</h2>
                <p style="font-size:1.1rem;opacity:0.7;">${err.message}</p>
            `;
        });
}

document.addEventListener('DOMContentLoaded', loadCSV);

function populateActorsDropdown(data) {
    const actorSet = new Set();
    data.forEach(row => {
        if (row.ACTORS) {
            row.ACTORS.split(',').map(a => a.trim()).filter(Boolean).forEach(a => actorSet.add(a));
        }
    });
    const select = document.getElementById('party-filter');
    Array.from(actorSet).sort().forEach(actor => {
        const option = document.createElement('option');
        option.value = actor;
        option.textContent = actor;
        select.appendChild(option);
    });
}

function applyActorFilter(actor) {
    if (!allRows || !myChart) return;
    hidePanel();
    if (actor === 'all') {
        const treeData = buildTreeData(allRows);
        myChart.setOption({ series: [{ data: [treeData], initialTreeDepth: 1 }] });
    } else {
        const treeData = buildFilteredTreeData(allRows, actor);
        myChart.setOption({ series: [{ data: [treeData], initialTreeDepth: 2 }] });
    }
}

function buildFilteredTreeData(data, actor) {
    const full = buildTreeData(data);
    return filterTreeNode(full, actor) || { ...full, children: [], name: full.name };
}

function nodeContainsActor(node, actor) {
    if (!node.actors) return false;
    return node.actors.split(',').map(a => a.trim()).some(a => a === actor);
}

function filterTreeNode(node, actor) {
    if (!node.children || node.children.length === 0) {
        return nodeContainsActor(node, actor) ? node : null;
    }
    const filteredChildren = node.children.map(child => filterTreeNode(child, actor)).filter(Boolean);
    if (nodeContainsActor(node, actor) || filteredChildren.length > 0) {
        return Object.assign({}, node, { children: filteredChildren });
    }
    return null;
}

function buildTreeData(data) {
    const root = {
        name: 'מחזור חיים',
        children: [],
        symbolSize: 22,
        itemStyle: { color: '#e2e8f0' },
        label: { fontSize: 18, fontWeight: '800', color: '#e2e8f0' }
    };

    let currentStage = null;
    let currentSubStage = null;

    data.forEach(row => {
        const type = (row.TYPE || '').trim().toUpperCase();
        if (!type) return;

        const node = {
            name:     row.TITLE   || 'ללא שם',
            content:  row.CONTENT || '',
            actors:   row.ACTORS  || '',
            agent:    row.AGENT   || '',
            children: []
        };

        if (type === 'STAGE') {
            node.symbolSize = 16;
            node.itemStyle  = { color: '#2563eb' };
            node.label      = { fontWeight: '700', fontSize: 15, color: '#93bbfd' };
            root.children.push(node);
            currentStage    = node;
            currentSubStage = null;
        } else if (type === 'SUBSTAGE') {
            node.symbolSize = 12;
            node.itemStyle  = { color: '#0ea5e9' };
            node.label      = { fontWeight: '500', fontSize: 14, color: '#7dd3fc' };
            if (currentStage) { currentStage.children.push(node); currentSubStage = node; }
            else root.children.push(node);
        } else if (type === 'MINORSTAGE') {
            node.symbolSize = 8;
            node.itemStyle  = { color: '#94a3b8' };
            node.label      = { fontSize: 13, color: '#94a3b8' };
            if (currentSubStage) currentSubStage.children.push(node);
            else if (currentStage) currentStage.children.push(node);
        }
    });

    return root;
}

// ── Chart ──────────────────────────────────────────────────────────────────

function initChart(data) {
    const chartDom = document.getElementById('chart-area');
    if (myChart) myChart.dispose();
    myChart = echarts.init(chartDom);

    myChart.setOption({
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: '{b}',
            backgroundColor: 'rgba(30,41,59,0.95)',
            textStyle: { color: '#e2e8f0', fontFamily: 'Heebo' },
            borderColor: '#475569',
            borderWidth: 1,
            padding: [8, 12]
        },
        series: [{
            type: 'tree',
            data: [data],
            orient: 'RL',
            top: '8%', left: '20%', bottom: '8%', right: '15%',
            roam: true,
            label: {
                position: 'left',
                verticalAlign: 'middle',
                align: 'right',
                fontFamily: 'Heebo',
                padding: [5, 10],
                backgroundColor: '#1e293b',
                borderRadius: 6,
                shadowColor: 'rgba(0,0,0,0.3)',
                shadowBlur: 5,
                shadowOffsetY: 2
            },
            leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
            lineStyle: { color: '#475569', width: 2, curveness: 0.6 },
            expandAndCollapse: true,
            animationDuration: 550,
            initialTreeDepth: 1
        }]
    });

    myChart.on('click', function(params) {
        const d = params.data;
        if (d.content || d.actors) showPanel(d);
        else if (d.name === 'מחזור חיים') hidePanel();
    });

    window.addEventListener('resize', () => myChart.resize());
}

// ── Info panel ─────────────────────────────────────────────────────────────

function showPanel(d) {
    document.getElementById('info-default').style.display = 'none';
    document.getElementById('info-content-view').style.display = 'block';

    document.getElementById('info-title').innerText = d.name;
    document.getElementById('info-desc').innerText  = d.content || 'לא קיים פירוט נוסף לשלב זה.';

    const actorsDiv = document.getElementById('info-actors');
    if (d.actors) {
        const list = d.actors.split(',').map(a => a.trim()).filter(Boolean);
        actorsDiv.innerHTML = list.map(a => `<span class="actor-tag">${a}</span>`).join('');
    } else {
        actorsDiv.innerHTML = '<span style="color:var(--text-sub);font-size:0.9rem;">לא צוינו גורמים מעורבים</span>';
    }

    const agentsSection = document.getElementById('agents-section');
    const agentsDiv     = document.getElementById('info-agents');
    if (d.agent) {
        agentsSection.style.display = 'block';
        const names = d.agent.split(',').map(a => a.trim()).filter(Boolean);
        agentsDiv.innerHTML = names.map(name => {
            const info = AGENT_MAP[name];
            if (info) return `<a class="agent-tag" href="${info.url}" target="_blank" rel="noopener noreferrer">${info.display} ↗</a>`;
            return `<span class="agent-tag agent-tag-plain">${name}</span>`;
        }).join('');
    } else {
        agentsSection.style.display = 'none';
    }
}

function hidePanel() {
    document.getElementById('info-default').style.display = 'block';
    document.getElementById('info-content-view').style.display = 'none';
}
