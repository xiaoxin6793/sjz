// ========== JavaScript逻辑（第三版 - 统一使用 UTC，追加未来 30 天，节气追加不覆盖） ==========

// 初始化ECharts实例
const chartDom = document.getElementById('kline-chart');
const myChart = echarts.init(chartDom);
const statusBar = document.getElementById('status-bar');

// 绘图数据与状态
let isDrawing = false;
let drawingStartPoint = null;
let drawingType = 'none';
let drawings = [];
let idCounter = 0;
let solarTermsVisible = true;

// 示例数据（与你原始相同）
const sampleData = [
    '20210802 3.98 4.01 3.92 4.00 143752830 569909440.00',
    '20210803 3.97 4.00 3.96 3.98 104833047 416541856.00',
    '20210804 3.97 4.00 3.95 4.00 76843697 306233120.00',
    '20210805 3.98 4.02 3.96 3.99 86014608 343575040.00',
    '20210806 4.00 4.00 3.96 3.97 100167170 398806272.00',
    '20210809 3.96 4.00 3.95 4.00 89452901 356552000.00',
    '20210810 3.99 4.00 3.97 4.00 79408820 316464640.00',
    '20210811 4.01 4.05 4.00 4.04 124784597 503108864.00',
    '20210812 4.05 4.06 4.02 4.05 108665367 439132960.00',
    '20210813 4.04 4.05 3.99 4.00 111460688 447908064.00',
    '20210816 4.00 4.03 3.98 4.02 101844312 407467968.00',
    '20210817 4.02 4.04 4.00 4.03 91732216 368709664.00',
    '20210818 4.03 4.05 4.00 4.01 86233208 347143136.00',
    '20210819 4.01 4.03 3.98 4.00 78998816 316249440.00',
    '20210820 4.00 4.02 3.98 4.01 75643208 302345312.00',
    '20210823 4.01 4.05 4.00 4.04 98214325 395245888.00',
    '20210824 4.04 4.06 4.02 4.05 87654321 354321984.00',
    '20210825 4.05 4.08 4.03 4.07 105432189 428765432.00',
    '20210826 4.07 4.10 4.05 4.09 112345678 459876543.00',
    '20210827 4.09 4.12 4.07 4.11 123456789 508172839.00'
];

// ========== 默认图表选项（注意：使用 UTC 格式化） ==========
let option = {
    backgroundColor: '#0d1b3d',
    title: {
        text: '上传TXT文件以显示K线图',
        left: 'center',
        top: '10px',
        textStyle: {
            color: '#fff',
            fontSize: 20
        }
    },
    tooltip: {
        trigger: 'axis',
        axisPointer: {
            type: 'cross',
            lineStyle: {
                color: '#4cc9f0',
                width: 2
            }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: '#4cc9f0',
        textStyle: { color: '#fff' },
        formatter: function(params) {
            // 兼容多个 series 的 tooltip，取第一个有效项显示 K 线信息
            const param = params && params[0] ? params[0] : null;
            if (!param) return '';
            const data = param.data || [];
            // 尽量从 data[0] / param.value / axisValue 中获取时间戳
            const ts = data && data[0] ? data[0] : (param.value ? (Array.isArray(param.value) ? param.value[0] : param.value) : param.axisValue);
            if (!ts && ts !== 0) return '';
            const d = new Date(ts);
            // 使用 UTC 显示日期以避免时区偏移
            const formatDate = `${d.getUTCFullYear()}-${(d.getUTCMonth()+1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
            const open = (data[1] == null) ? '-' : data[1];
            const close = (data[2] == null) ? '-' : data[2];
            const low = (data[3] == null) ? '-' : data[3];
            const high = (data[4] == null) ? '-' : data[4];
            return `
                <div style="font-weight:bold;margin-bottom:5px;">${formatDate}</div>
                <div>开盘: ${open}</div>
                <div>收盘: ${close}</div>
                <div>最低: ${low}</div>
                <div>最高: ${high}</div>
            `;
        }
    },
    legend: {
        data: ['K线', '彩线', '节气'],
        textStyle: { color: '#fff' },
        top: 40
    },
    grid: {
        left: '3%',
        right: '3%',
        bottom: '15%',
        top: '80px'
    },
    xAxis: {
        type: 'time',
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false, lineStyle: { color: '#4cc9f0' } },
        splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLabel: {
            color: '#fff',
            formatter: function(value) {
                const date = new Date(value);
                // 使用 UTC 显示日期，避免因本地时区导致日期错位
                return `${date.getUTCFullYear()}-${(date.getUTCMonth()+1).toString().padStart(2,'0')}-${date.getUTCDate().toString().padStart(2,'0')}`;
            }
        }
    },
    yAxis: {
        scale: true,
        splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } },
        splitLine: { show: true, lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
        axisLine: { lineStyle: { color: '#4cc9f0' } },
        axisLabel: { color: '#fff', formatter: value => value.toFixed(2) }
    },
    dataZoom: [
        { type: 'inside', start: 50, end: 100, zoomOnMouseWheel: true, moveOnMouseWheel: false, moveOnMouseMove: false },
        {
            show: true, type: 'slider', top: '92%', height: '3%',
            backgroundColor: 'rgba(255,255,255,0.1)',
            dataBackground: { lineStyle: {color: '#8392A5'}, areaStyle: {color: '#8392A5'} },
            textStyle: { color: '#fff' },
            handleStyle: { color: '#4cc9f0' }
        }
    ],
    series: [
        {
            name: 'K线',
            type: 'candlestick',
            itemStyle: {
                color: '#ef476f',
                color0: '#06d6a0',
                borderColor: '#ef476f',
                borderColor0: '#06d6a0'
            },
            data: []
        }
    ],
    // graphic 专用于用户绘图（并打上 userDraw 标记），以便不影响其它元素
    graphic: []
};

myChart.setOption(option);
window.addEventListener('resize', function() {
    myChart.resize();
    refreshUserGraphics(); // 关键：窗口变化后重算像素坐标
});

// ========== 文件处理函数 ==========
document.getElementById('file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    statusBar.textContent = '正在加载文件...';
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        parseTXT(content);
        statusBar.textContent = '文件加载完成';
    };
    reader.onerror = function() {
        statusBar.textContent = '文件加载失败';
    };
    reader.readAsText(file);
});

// 加载示例数据
document.getElementById('load-sample').addEventListener('click', function() {
    statusBar.textContent = '正在加载示例数据...';
    setTimeout(() => {
        parseTXT(sampleData.join('\n'));
        statusBar.textContent = '示例数据加载完成';
    }, 300);
});

// 解析TXT
function parseTXT(txt) {
    const lines = txt.split('\n');
    const data = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(/\s+/);
        if (values.length >= 5) {
            const dateStr = values[0];
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            // 使用 UTC 时间戳，避免时区导致的日期偏移
            const ts = Date.UTC(year, month, day);
            const open = parseFloat(values[1]);
            const high = parseFloat(values[2]);
            const low = parseFloat(values[3]);
            const close = parseFloat(values[4]);
            data.push([
                ts,   // 时间戳（UTC）
                open, // 开盘
                close,// 收盘
                low,  // 最低
                high  // 最高
            ]);
        }
    }

    // === 新增：在最后追加未来 30 天的空白数据（时间戳 + null 值占位） ===
    if (data.length > 0) {
        const daysToAdd = 30; // 未来扩展天数，按需修改
        // 直接取最后一个时间戳并以毫秒为单位累加
        let lastTs = data[data.length - 1][0];
        const oneDayMs = 24 * 60 * 60 * 1000;
        for (let i = 1; i <= daysToAdd; i++) {
            lastTs = lastTs + oneDayMs;
            data.push([
                lastTs, // 未来时间戳
                null,
                null,
                null,
                null
            ]);
        }
    }
    // ================================================================

    updateChart(data);
}

// 更新图表数据
function updateChart(data) {
    if (data.length === 0) {
        alert('没有有效数据！');
        return;
    }
    option.title.text = 'K线图与三角洲彩线';
    option.series[0].data = data;

    // 重要：保留非用户绘图的 graphic
    option.graphic = (option.graphic || []).filter(g => !g.userDraw);

    myChart.setOption(option, true);
    // 刷新用户绘图（因为坐标系可能变化）
    refreshUserGraphics();
}

// ========== 彩线生成函数 ==========
function parseDateInputToUTC(dateStr) {
    // 支持 'YYYY-MM-DD' 格式
    if (!dateStr) return NaN;
    const parts = dateStr.split('-');
    if (parts.length < 3) return NaN;
    const y = parseInt(parts[0]), m = parseInt(parts[1]) - 1, d = parseInt(parts[2]);
    return Date.UTC(y, m, d);
}

document.getElementById('generate-lines').addEventListener('click', function() {
    const startValue = document.getElementById('start-date').value;
    const startTs = parseDateInputToUTC(startValue);
    const intervalDays = parseFloat(document.getElementById('interval').value);
    if (isNaN(startTs) || isNaN(intervalDays)) {
        alert('请输入有效的日期和间隔天数！');
        return;
    }
    const klineData = myChart.getOption().series[0].data;
    if (!klineData || klineData.length === 0) {
        alert('请先上传股票数据！');
        return;
    }
    statusBar.textContent = '正在生成彩线...';
    // 只取时间戳数组（数值）
    const dates = klineData.map(item => item[0]).filter(v => v != null);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const gridLines = [];
    const colors = ['#ff4b4b', '#4b7aff', '#ff9f4b', '#4bff97'];
    let currentDate = startTs;
    let colorIndex = 0;
    // 回推到 minDate 左侧
    const stepMs = intervalDays * 24 * 60 * 60 * 1000;
    while (currentDate > minDate) {
        currentDate -= stepMs;
    }
    // 向右推到 maxDate（包含扩展的未来日期）
    while (currentDate < maxDate) {
        const dateObj = new Date(currentDate);
        const dateStr = `${dateObj.getUTCFullYear()}-${(dateObj.getUTCMonth()+1).toString().padStart(2, '0')}-${dateObj.getUTCDate().toString().padStart(2, '0')}`;
        gridLines.push({
            xAxis: currentDate,
            lineStyle: {
                color: colors[colorIndex % colors.length],
                width: 2,
                type: 'solid',
                opacity: 0.7
            },
            label: {
                show: true,
                position: 'end',
                formatter: dateStr,
                color: colors[colorIndex % colors.length],
                fontSize: 10,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: [2, 4],
                borderRadius: 3
            }
        });
        currentDate += stepMs;
        colorIndex++;
    }

    // 将彩线（周期线）放到 series[1] 的 markLine 中（覆盖旧的周期线）
    if (option.series.length > 1) {
        option.series[1] = {
            name: '彩线',
            type: 'line',
            data: [],
            markLine: {
                data: gridLines,
                lineStyle: { opacity: 0.7 },
                symbol: 'none'
            }
        };
    } else {
        option.series.push({
            name: '彩线',
            type: 'line',
            data: [],
            markLine: {
                data: gridLines,
                lineStyle: { opacity: 0.7 },
                symbol: 'none'
            }
        });
    }
    myChart.setOption(option, true);
    statusBar.textContent = '彩线生成完成';
});

// ========== 节气功能 ==========
// 24节气名称
function calculateSolarTerms(year) {
    const solarTermNames = [
        "小寒", "大寒", "立春", "雨水", "惊蛰", "春分",
        "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
        "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
        "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"
    ];

    // 为每个节气给出一种颜色（长度必须为24）
    const seasonColors = [
        "#ff9999","#ff9999","#99ccff","#99ccff","#99ccff","#99ccff",
        "#ccff99","#ccff99","#ffcc99","#ffcc99","#4b7aff","#4b7aff",
        "#ff9f4b","#ff9f4b","#4bff97","#4bff97","#ff9999","#ff9999",
        "#99ccff","#99ccff","#ccff99","#ccff99","#ffcc99","#ffcc99"
    ];

    const baseDates = [
        {month: 0, day: 5},   // 小寒
        {month: 0, day: 20},  // 大寒
        {month: 1, day: 4},   // 立春
        {month: 1, day: 19},  // 雨水
        {month: 2, day: 5},   // 惊蛰
        {month: 2, day: 20},  // 春分
        {month: 3, day: 5},   // 清明
        {month: 3, day: 20},  // 谷雨
        {month: 4, day: 5},   // 立夏
        {month: 4, day: 21},  // 小满
        {month: 5, day: 6},   // 芒种
        {month: 5, day: 21},  // 夏至
        {month: 6, day: 7},   // 小暑
        {month: 6, day: 23},  // 大暑
        {month: 7, day: 8},   // 立秋
        {month: 7, day: 23},  // 处暑
        {month: 8, day: 8},   // 白露
        {month: 8, day: 23},  // 秋分
        {month: 9, day: 8},   // 寒露
        {month: 9, day: 23},  // 霜降
        {month: 10, day: 7},  // 立冬
        {month: 10, day: 22}, // 小雪
        {month: 11, day: 7},  // 大雪
        {month: 11, day: 22}  // 冬至
    ];

    const terms = [];
    for (let i = 0; i < 24; i++) {
        const baseDate = baseDates[i];
        let day = baseDate.day;

        // 简化微调（保留你原来的思路）
        if (year % 4 === 0 && i > 1 && i < 6) {
            day -= 1;
        } else if (year % 4 === 1 && i > 17) {
            day += 1;
        }
        day = Math.max(1, Math.min(day, 31));
        // 使用 UTC 时间戳
        const ts = Date.UTC(year, baseDate.month, day);
        terms.push({
            name: solarTermNames[i],
            timestamp: ts,
            color: seasonColors[i] || '#ffffff'
        });
    }
    return terms;
}

// 生成节气标记（追加，不覆盖）
function generateSolarTerms() {
    const year = parseInt(document.getElementById('solar-term-year').value);
    if (isNaN(year) || year < 1900 || year > 2100) {
        alert('请输入有效的年份（1900-2100）！');
        return;
    }

    statusBar.textContent = '正在生成节气...';
    const solarTerms = calculateSolarTerms(year);

    // 确保 series[2] 存在并且 markLine.data 为数组
    if (!option.series[2]) {
        option.series[2] = {
            name: '节气',
            type: 'line',
            data: [],
            markLine: {
                data: [],
                symbol: 'none'
            }
        };
    } else {
        option.series[2].markLine = option.series[2].markLine || { data: [], symbol: 'none' };
        option.series[2].markLine.data = option.series[2].markLine.data || [];
    }

    const existing = option.series[2].markLine.data;

    // 追加（避免重复）
    solarTerms.forEach(term => {
        const exists = existing.some(item => item.xAxis === term.timestamp && item.label && item.label.formatter === term.name);
        if (!exists) {
            existing.push({
                xAxis: term.timestamp,
                lineStyle: { color: term.color, width: 2, type: 'solid', opacity: solarTermsVisible ? 0.8 : 0 },
                label: {
                    show: true,
                    position: 'end',
                    formatter: term.name,
                    color: term.color,
                    fontSize: 12,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: [3, 5],
                    borderRadius: 4
                }
            });
        }
    });

    option.series[2].markLine.data = existing;
    myChart.setOption(option, true);
    statusBar.textContent = `${year}年节气生成完成`;
}

// 切换节气显示（逐个设置 opacity）
function toggleSolarTerms() {
    solarTermsVisible = !solarTermsVisible;
    const button = document.getElementById('toggle-solar-terms');

    if (option.series[2] && option.series[2].markLine && Array.isArray(option.series[2].markLine.data)) {
        option.series[2].markLine.data.forEach(item => {
            item.lineStyle = item.lineStyle || {};
            item.lineStyle.opacity = solarTermsVisible ? 0.8 : 0;
            // label 的显示也可以根据需要隐藏/显示；这里保持标签显示但颜色不变
        });
        myChart.setOption(option, true);
    }

    if (solarTermsVisible) {
        button.textContent = '隐藏节气';
        statusBar.textContent = '节气已显示';
    } else {
        button.textContent = '显示节气';
        statusBar.textContent = '节气已隐藏';
    }
}

// 绑定节气按钮事件
document.getElementById('generate-solar-terms').addEventListener('click', generateSolarTerms);
document.getElementById('toggle-solar-terms').addEventListener('click', toggleSolarTerms);

// ========== 显示控制函数 ==========
document.getElementById('toggle-kline').addEventListener('click', function() {
    option.series[0].itemStyle = option.series[0].itemStyle || {};
    option.series[0].itemStyle.opacity = 1;
    if (option.series[1]) {
        option.series[1].markLine = option.series[1].markLine || {};
        option.series[1].markLine.lineStyle = option.series[1].markLine.lineStyle || {};
        option.series[1].markLine.lineStyle.opacity = 0;
    }
    if (option.series[2]) {
        option.series[2].markLine = option.series[2].markLine || {};
        option.series[2].markLine.data = option.series[2].markLine.data || [];
        option.series[2].markLine.data.forEach(item => {
            item.lineStyle = item.lineStyle || {};
            item.lineStyle.opacity = 0;
        });
    }
    myChart.setOption(option, true);
    document.querySelectorAll('.toggle-buttons button').forEach(btn => btn.classList.remove('active-toggle'));
    this.classList.add('active-toggle');
    statusBar.textContent = '仅显示K线图';
});
document.getElementById('toggle-delta').addEventListener('click', function() {
    option.series[0].itemStyle = option.series[0].itemStyle || {};
    option.series[0].itemStyle.opacity = 0.2;
    if (option.series[1]) {
        option.series[1].markLine = option.series[1].markLine || {};
        option.series[1].markLine.lineStyle = option.series[1].markLine.lineStyle || {};
        option.series[1].markLine.lineStyle.opacity = 0.7;
    }
    if (option.series[2]) {
        option.series[2].markLine = option.series[2].markLine || {};
        option.series[2].markLine.data = option.series[2].markLine.data || [];
        option.series[2].markLine.data.forEach(item => {
            item.lineStyle = item.lineStyle || {};
            item.lineStyle.opacity = 0;
        });
    }
    myChart.setOption(option, true);
    document.querySelectorAll('.toggle-buttons button').forEach(btn => btn.classList.remove('active-toggle'));
    this.classList.add('active-toggle');
    statusBar.textContent = '仅显示彩线';
});
document.getElementById('toggle-both').addEventListener('click', function() {
    option.series[0].itemStyle = option.series[0].itemStyle || {};
    option.series[0].itemStyle.opacity = 1;
    if (option.series[1]) {
        option.series[1].markLine = option.series[1].markLine || {};
        option.series[1].markLine.lineStyle = option.series[1].markLine.lineStyle || {};
        option.series[1].markLine.lineStyle.opacity = 0.7;
    }
    if (option.series[2]) {
        option.series[2].markLine = option.series[2].markLine || {};
        option.series[2].markLine.data = option.series[2].markLine.data || [];
        option.series[2].markLine.data.forEach(item => {
            item.lineStyle = item.lineStyle || {};
            item.lineStyle.opacity = solarTermsVisible ? 0.8 : 0;
        });
    }
    myChart.setOption(option, true);
    document.querySelectorAll('.toggle-buttons button').forEach(btn => btn.classList.remove('active-toggle'));
    this.classList.add('active-toggle');
    statusBar.textContent = '显示K线图和彩线';
});

// ========== 缩放控制函数 ==========
document.getElementById('zoom-in').addEventListener('click', function() {
    const currentOption = myChart.getOption();
    const dataZoom = currentOption.dataZoom[0];
    const currentStart = dataZoom.start || 0;
    const currentEnd = dataZoom.end || 100;
    const newStart = Math.max(0, currentStart + 5);
    const newEnd = Math.min(100, currentEnd - 5);
    myChart.dispatchAction({ type: 'dataZoom', start: newStart, end: newEnd });
    statusBar.textContent = '图表已放大';
});
document.getElementById('zoom-out').addEventListener('click', function() {
    const currentOption = myChart.getOption();
    const dataZoom = currentOption.dataZoom[0];
    const currentStart = dataZoom.start || 0;
    const currentEnd = dataZoom.end || 100;
    const newStart = Math.max(0, currentStart - 5);
    const newEnd = Math.min(100, currentEnd + 5);
    myChart.dispatchAction({ type: 'dataZoom', start: newStart, end: newEnd });
    statusBar.textContent = '图表已缩小';
});
document.getElementById('reset-zoom').addEventListener('click', function() {
    myChart.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    statusBar.textContent = '缩放已重置';
});

// ========== 绘图工具逻辑 ==========
document.getElementById('drawing-tool').addEventListener('change', function() {
    drawingType = this.value;
    statusBar.textContent = `已选择绘图工具: ${this.options[this.selectedIndex].text}`;
});

document.getElementById('start-drawing').addEventListener('click', function() {
    if (drawingType === 'none') {
    statusBar.textContent = '请先选择绘图工具';
    return;
    }
    isDrawing = !isDrawing;
    if (isDrawing) {
    this.textContent = '停止绘制';
    this.classList.add('active-drawing');
    statusBar.textContent = `开始绘制${document.getElementById('drawing-tool').options[document.getElementById('drawing-tool').selectedIndex].text} - 在图表上点击并拖动`;
    } else {
    this.textContent = '开始绘制';
    this.classList.remove('active-drawing');
    statusBar.textContent = '停止绘制';
    drawingStartPoint = null;
    }
});

document.getElementById('clear-all-lines').addEventListener('click', function() {
    drawings = []; // 清空数据
    // 仅移除用户绘图的 graphic
    option.graphic = (option.graphic || []).filter(g => !g.userDraw);
    myChart.setOption(option, true);
    updateDrawingList();
    statusBar.textContent = '所有绘图已清除';
});

// 鼠标事件：使用"数据坐标"记录绘图
myChart.getZr().on('mousedown', function(params) {
    if (!isDrawing || drawingType === 'none') return;
    const point = [params.offsetX, params.offsetY];
    // 将像素转为数据坐标（时间戳 / 价格）
    const dataPoint = myChart.convertFromPixel({seriesIndex: 0}, point);
    if (!dataPoint) return;
    drawingStartPoint = { x: dataPoint[0], y: dataPoint[1] };
    statusBar.textContent = '开始绘制 - 拖动鼠标完成绘制';
});

myChart.getZr().on('mouseup', function(params) {
    if (!isDrawing || !drawingStartPoint) return;
    const point = [params.offsetX, params.offsetY];
    const dataPoint = myChart.convertFromPixel({seriesIndex: 0}, point);
    if (!dataPoint) return;

    const lineStyle = document.getElementById('line-style').value;
    const lineColor = document.getElementById('line-color').value;

    const newId = 'drawing_' + (++idCounter);
    let drawingObj = null;

    if (drawingType === 'trendline') {
        drawingObj = {
            id: newId,
            type: 'trendline',
            // 以"数据坐标"保存
            start: { x: drawingStartPoint.x, y: drawingStartPoint.y },
            end:   { x: dataPoint[0], y: dataPoint[1] },
            style: lineStyle,
            color: lineColor
        };
    } else if (drawingType === 'horizontal') {
        drawingObj = {
            id: newId,
            type: 'horizontal',
            y: drawingStartPoint.y, // 水平线仅需要 y 值
            style: lineStyle,
            color: lineColor
        };
    } else if (drawingType === 'vertical') {
        drawingObj = {
            id: newId,
            type: 'vertical',
            x: drawingStartPoint.x, // 垂直线仅需要 x（时间戳）
            style: lineStyle,
            color: lineColor
        };
    }

    if (drawingObj) {
        drawings.push(drawingObj);
        renderAllUserDrawings();   // 立即渲染
        updateDrawingList();
    }

    drawingStartPoint = null;
    statusBar.textContent = `已完成${document.getElementById('drawing-tool').options[document.getElementById('drawing-tool').selectedIndex].text}绘制`;
});

// 监听缩放/渲染，保持绘图跟随
myChart.on('dataZoom', refreshUserGraphics);
myChart.on('rendered', refreshUserGraphics);

// ======== 将"数据坐标"转换为 graphic（像素）并渲染 ========
function renderAllUserDrawings() {
    // 先保留非用户绘图的 graphic
    const baseGraphics = (option.graphic || []).filter(g => !g.userDraw);
    const userGraphics = [];

    const kSeries = myChart.getOption().series?.[0]?.data || [];
    if (!kSeries.length) {
        option.graphic = baseGraphics;
        myChart.setOption(option, true);
        return;
    }
    const firstX = kSeries[0][0];
    const lastX  = kSeries[kSeries.length - 1][0];

    for (const d of drawings) {
        if (d.type === 'trendline') {
            const p1 = myChart.convertToPixel({seriesIndex: 0}, [d.start.x, d.start.y]);
            const p2 = myChart.convertToPixel({seriesIndex: 0}, [d.end.x, d.end.y]);
            userGraphics.push({
                type: 'line',
                id: d.id,
                shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                style: {
                    stroke: d.color,
                    lineWidth: 2,
                    lineDash: d.style === 'solid' ? null : (d.style === 'dashed' ? [6, 6] : [2, 4])
                },
                z: 100,
                silent: true,
                userDraw: true
            });
        } else if (d.type === 'horizontal') {
            const p1 = myChart.convertToPixel({seriesIndex: 0}, [firstX, d.y]);
            const p2 = myChart.convertToPixel({seriesIndex: 0}, [lastX,  d.y]);
            userGraphics.push({
                type: 'line',
                id: d.id,
                shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                style: {
                    stroke: d.color,
                    lineWidth: 2,
                    lineDash: d.style === 'solid' ? null : (d.style === 'dashed' ? [6, 6] : [2, 4])
                },
                z: 100,
                silent: true,
                userDraw: true
            });
        } else if (d.type === 'vertical') {
            const xPixel = myChart.convertToPixel({seriesIndex: 0}, [d.x, kSeries[0][2] ?? 0])[0];
            userGraphics.push({
                type: 'line',
                id: d.id,
                shape: { x1: xPixel, y1: 0, x2: xPixel, y2: myChart.getHeight() },
                style: {
                    stroke: d.color,
                    lineWidth: 2,
                    lineDash: d.style === 'solid' ? null : (d.style === 'dashed' ? [6, 6] : [2, 4])
                },
                z: 100,
                silent: true,
                userDraw: true
            });
        }
    }

    option.graphic = [...baseGraphics, ...userGraphics];
    // 第三个参数 replaceMerge 可以避免深度合并造成的残留
    myChart.setOption(option, true);
}

// 刷新（不改 drawings，只重算像素）
function refreshUserGraphics() {
    if (!drawings.length) return;
    renderAllUserDrawings();
}

// 绘图列表 UI
function updateDrawingList() {
    const drawingList = document.getElementById('drawing-list');
    drawingList.innerHTML = '';

    if (drawings.length === 0) {
        drawingList.innerHTML = '<div class="drawing-item"><span>暂无绘图对象</span></div>';
        return;
    }
    const typeNames = { trendline: '趋势线', horizontal: '水平线', vertical: '垂直线' };

    drawings.forEach((d, index) => {
        const item = document.createElement('div');
        item.className = 'drawing-item';
        item.innerHTML = `
            <span>${typeNames[d.type]} #${index + 1}</span>
            <div>
                <button class="delete-drawing" data-index="${index}">删除</button>
            </div>
        `;
        drawingList.appendChild(item);
    });

    document.querySelectorAll('.delete-drawing').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            deleteDrawing(index);
        });
    });
}

// 删除单条绘图
function deleteDrawing(index) {
    if (index < 0 || index >= drawings.length) return;
    const target = drawings[index];
    // 从数据结构删除
    drawings.splice(index, 1);
    // 从 graphic 移除对应 id
    option.graphic = (option.graphic || []).filter(g => !(g.userDraw && g.id === target.id));
    myChart.setOption(option, true);
    updateDrawingList();
    statusBar.textContent = '绘图对象已删除';
}

// 初始化示例数据
parseTXT(sampleData.join('\n'));
