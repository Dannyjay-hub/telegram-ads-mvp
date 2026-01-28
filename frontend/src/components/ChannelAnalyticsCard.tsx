import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { API_URL, getHeaders } from '@/lib/api';

interface AnalyticsProps {
    channel: any;
    onSync: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ChannelAnalyticsCard({ channel, onSync }: AnalyticsProps) {
    const [syncing, setSyncing] = useState(false);
    const stats = channel.statsJson; // The raw GranJS stats object

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch(`${API_URL}/channels/${channel.id}/sync_stats`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (res.ok) {
                onSync(); // Refresh parent
                alert('Stats synced from Telegram!');
            } else {
                alert('Sync failed. Is the bot admin?');
            }
        } catch (e) {
            console.error(e);
            alert('Error syncing stats');
        } finally {
            setSyncing(false);
        }
    };

    // Transform Data for Charts
    // 1. Languages
    const langData = stats?.languagesGraph?.json?.p?.map((p: any, i: number) => ({
        name: stats.languagesGraph.json.l[i],
        value: p
    })) || [];

    // 2. Views History (Extract from viewsPerPost graph if available, simplified for MVP)
    // MTProto graph data is complex (json blobs). 
    // Fallback: If no graph, just show avg views.
    // For demo, we might need to parse 'stats.viewsPerPost.json' if it exists.

    // For MVP Visuals: If no real graph data, we show a placeholder or just the Big Numbers.
    const hasGraphData = langData.length > 0;

    return (
        <div className="space-y-6 pt-6 border-t border-white/10">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 p-1 rounded-md"><Users className="w-4 h-4" /></span>
                    Verified Analytics
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSync}
                    disabled={syncing}
                    className="border-white/10"
                >
                    {syncing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Sync Data
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Subscribers</p>
                    <p className="text-2xl font-bold">{channel.verifiedStats?.subscribers?.toLocaleString() || '-'}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Avg Views</p>
                    <p className="text-2xl font-bold">{channel.avgViews?.toLocaleString() || '-'}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Reach Rate</p>
                    <p className="text-2xl font-bold">
                        {channel.avgViews && channel.verifiedStats?.subscribers
                            ? ((channel.avgViews / channel.verifiedStats.subscribers) * 100).toFixed(1) + '%'
                            : '-'}
                    </p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1 truncate">Boosts/Premium</p>
                    <p className="text-2xl font-bold text-yellow-500">{stats?.boostsApplied || '-'}</p>
                </div>
            </div>

            {hasGraphData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
                    {/* Language Pie */}
                    <div className="bg-white/5 p-4 rounded-xl flex flex-col items-center justify-center">
                        <h4 className="mb-4 text-sm font-semibold">Audience Language</h4>
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={langData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={60}
                                    fill="#8884d8"
                                >
                                    {langData.map((_entry: any, index: any) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Placeholder Line Chart for Growth */}
                    <div className="bg-white/5 p-4 rounded-xl">
                        <h4 className="mb-4 text-sm font-semibold">Growth (Last 24h)</h4>
                        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            Chart data parsing pending
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
