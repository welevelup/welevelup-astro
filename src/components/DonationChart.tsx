import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface MonthlyTotal {
  month: string;
  total: number;
  monthly_donations: number;
  one_off_donations: number;
}

interface DonationChartProps {
  data?: MonthlyTotal[];
  isDarkMode: boolean;
}

export default function DonationChart({ data, isDarkMode }: DonationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        No data yet — click "Sync Now" to fetch donations.
      </div>
    );
  }

  const chartData = data.map(d => ({
    month: d.month.slice(5),
    'Total': d.total,
    'Monthly (recurring)': d.monthly_donations,
    'One-off': d.one_off_donations
  }));

  const colors = isDarkMode ? '#CCFF33' : '#8B7EBD';
  const textColor = isDarkMode ? '#EEEBD3' : '#1A1A1A';
  const gridColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="month"
          stroke={textColor}
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke={textColor}
          style={{ fontSize: '12px' }}
          label={{ value: '£', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDarkMode ? '#13114a' : '#f9f9f9',
            border: `1px solid ${gridColor}`,
            color: textColor,
            borderRadius: '8px'
          }}
          formatter={(value) => `£${(value as number).toFixed(2)}`}
        />
        <Legend
          wrapperStyle={{ color: textColor }}
          fontSize={12}
        />
        <Line
          type="monotone"
          dataKey="Total"
          stroke={colors}
          strokeWidth={3}
          dot={{ fill: colors, r: 5 }}
          activeDot={{ r: 7 }}
        />
        <Line
          type="monotone"
          dataKey="Monthly (recurring)"
          stroke="#4ADE80"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#4ADE80', r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="One-off"
          stroke="#FBBF24"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#FBBF24', r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
