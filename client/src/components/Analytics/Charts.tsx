import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

// --- Generic Props ---
interface ChartProps {
    title: string;
    data: any[];
    height?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- Line Chart Component ---
export const SimpleLineChart: React.FC<ChartProps & { xKey: string; lines: { key: string; color: string; name?: string }[] }> = ({ title, data, height = 300, xKey, lines }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={xKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {lines.map((line) => (
                        <Line type="monotone" key={line.key} dataKey={line.key} stroke={line.color} name={line.name || line.key} activeDot={{ r: 8 }} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

// --- Bar Chart Component ---
export const SimpleBarChart: React.FC<ChartProps & { xKey: string; bars: { key: string; color: string; name?: string; stackId?: string }[] }> = ({ title, data, height = 300, xKey, bars }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={xKey} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {bars.map((bar) => (
                        <Bar key={bar.key} dataKey={bar.key} fill={bar.color} name={bar.name || bar.key} stackId={bar.stackId} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

// --- Pie Chart Component ---
export const SimplePieChart: React.FC<ChartProps & { dataKey: string; nameKey: string; colors?: string[] }> = ({ title, data, height = 300, dataKey, nameKey, colors }) => {
    const chartColors = colors || COLORS;
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="h6" gutterBottom>{title}</Typography>
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey={dataKey}
                            nameKey={nameKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
