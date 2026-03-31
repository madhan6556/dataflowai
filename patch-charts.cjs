const fs = require('fs');
let src = fs.readFileSync('src/components/DashboardCharts.tsx', 'utf8');

// Fix 1: Y-axis formatter — replace the broken one
src = src.replace(/tickFormatter=\{\(val\) => val > 1000 \? `\$\{.*?\}k` : val\}/g, 'tickFormatter={formatTick}');

// Fix 2: proper margins and YAxis width
src = src.replace(/margin=\{\{ top: 10, right: 10, left: -20, bottom: 0 \}\}/g, 'margin={{ top: 10, right: 20, left: 10, bottom: 5 }}');
src = src.replace(/dx=\{-10\} tickFormatter=\{formatTick\}/g, 'dx={-5} tickFormatter={formatTick} width={55}');

// Fix 3: ScatterChart — sample to 400 rows
src = src.replace(
  '<Scatter name={chartConfig.title} data={chartData} fill={chartConfig.colors[0] || "#8b5cf6"} />',
  '<Scatter name={chartConfig.title} data={snapshot ? chartData : chartData.slice(0, 400)} fill={chartConfig.colors[0] || "#8b5cf6"} opacity={0.7} />'
);

// Fix 4: LineChart — use groupByMonth for date axes
src = src.replace(
  'const lineData = snapshot ? chartData : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys);',
  'const lineData = snapshot ? chartData : (isDateKey(chartConfig.xAxisDataKey) ? groupByMonth(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys) : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 50));'
);

// Fix 5: AreaChart — use groupByMonth for date axes
src = src.replace(
  'const areaData = snapshot ? chartData : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys);',
  'const areaData = snapshot ? chartData : (isDateKey(chartConfig.xAxisDataKey) ? groupByMonth(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys) : getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 50));'
);

// Fix 6: Unknown chart fallback — replace blank "Unknown Chart" div with a BarChart fallback
const oldDefault = 'return <div className="text-white/40 border border-dashed border-white/10 rounded-xl h-full flex items-center justify-center">Unknown Chart</div>;';
const newDefault = `const fbData = getAggregatedData(chartData, chartConfig.xAxisDataKey, chartConfig.yAxisDataKeys, 15, true);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fbData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey={chartConfig.xAxisDataKey} stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={8} interval="preserveStartEnd" />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dx={-5} tickFormatter={formatTick} width={55} />
              <Tooltip content={<CustomTooltip valueFormat={format} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              {chartConfig.yAxisDataKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={chartConfig.colors[idx] || "#6366F1"} radius={[4, 4, 0, 0]} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );`;
src = src.replace(oldDefault, newDefault);

fs.writeFileSync('src/components/DashboardCharts.tsx', src, 'utf8');
console.log('All fixes applied. Total lines:', src.split('\n').length);
