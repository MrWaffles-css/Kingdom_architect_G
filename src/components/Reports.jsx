import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Reports({ initialReportId }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);

    useEffect(() => {
        fetchReports();
    }, [initialReportId]); // Refetch when a specific report is requested to ensure it's in the list

    // Effect to select the report once data is loaded
    useEffect(() => {
        if (initialReportId && reports.length > 0) {
            const initial = reports.find(r => r.id === initialReportId);
            if (initial) {
                setSelectedReport(initial);
            }
        }
    }, [reports, initialReportId]);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setReports(data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleString();
    const formatNumber = (num) => new Intl.NumberFormat('en-US').format(num);

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] bg-[#c0c0c0] font-sans text-sm">
            {/* Header */}
            <div className="bg-[#000080] p-1 text-white font-bold mb-1 flex items-center gap-2">
                <span className="text-lg">📜</span>
                <span>War Room Reports</span>
            </div>

            <div className="flex flex-1 gap-1 p-1 overflow-hidden">
                {/* List */}
                <div className="w-1/3 min-w-[200px] flex flex-col gap-1">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 px-1 font-bold text-xs py-0.5">
                        Recent Activity
                    </div>
                    <div className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white overflow-y-auto p-1">
                        {loading ? (
                            <div className="p-2 text-center text-gray-500">Loading...</div>
                        ) : reports.length === 0 ? (
                            <div className="p-2 text-center text-gray-500">No reports.</div>
                        ) : (
                            reports.map((report) => (
                                <div
                                    key={report.id}
                                    onClick={() => setSelectedReport(report)}
                                    className={`p-1 cursor-pointer flex gap-1 items-start border border-transparent hover:border-gray-400 mb-0.5 ${selectedReport?.id === report.id ? 'bg-[#000080] text-white' : ''}`}
                                >
                                    <span className="text-base leading-none">
                                        {report.type.includes('win') ? '✅' : '❌'}
                                    </span>
                                    <div className="overflow-hidden">
                                        <div className="font-bold text-xs truncate">{report.title}</div>
                                        <div className={`text-[10px] ${selectedReport?.id === report.id ? 'text-gray-300' : 'text-gray-500'}`}>{formatDate(report.created_at)}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col gap-1">
                    <div className="bg-[#c0c0c0] border-2 border-white border-r-gray-600 border-b-gray-600 px-1 font-bold text-xs py-0.5">
                        Report Details
                    </div>
                    <div className="flex-1 bg-white border-2 border-gray-600 border-r-white border-b-white overflow-y-auto p-4 font-serif">
                        {selectedReport ? (
                            <div className="border border-gray-400 p-4 bg-yellow-50 shadow-md">
                                <div className="border-b border-gray-400 pb-2 mb-2 flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                                        <div className="text-xs text-gray-600">{formatDate(selectedReport.created_at)}</div>
                                    </div>
                                    <div className={`font-bold border-2 p-1 text-xs uppercase ${selectedReport.type.includes('win') ? 'border-green-600 text-green-700' : 'border-red-600 text-red-700'}`}>
                                        {selectedReport.type.includes('win') ? 'VICTORY' : 'DEFEAT'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <span className="font-bold text-xs uppercase block text-gray-500">Opponent</span>
                                        <span className="text-lg">{selectedReport.data.opponent_name}</span>
                                    </div>
                                    {/* Gold Seized (Attacker View) */}
                                    {selectedReport.data.gold_stolen !== undefined && (
                                        <div>
                                            <span className="font-bold text-xs uppercase block text-gray-500">Gold Seized</span>
                                            <span className="text-lg font-bold text-[#808000]">{formatNumber(selectedReport.data.gold_stolen)}</span>
                                            {(selectedReport.data.stolen_from_main !== undefined || selectedReport.data.stolen_from_vault !== undefined) && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {selectedReport.data.stolen_from_main !== undefined && (
                                                        <div className="flex justify-between">
                                                            <span>Main ({Math.round((selectedReport.data.main_steal_percent || 0.5) * 100)}%):</span>
                                                            <span>{formatNumber(selectedReport.data.stolen_from_main)}</span>
                                                        </div>
                                                    )}
                                                    {selectedReport.data.stolen_from_vault !== undefined && (
                                                        <div className="flex justify-between">
                                                            <span>Vault ({Math.round((selectedReport.data.vault_steal_percent || 0) * 100)}%):</span>
                                                            <span>{formatNumber(selectedReport.data.stolen_from_vault)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Gold Lost (Defender View) */}
                                    {selectedReport.data.gold_lost !== undefined && (
                                        <div>
                                            <span className="font-bold text-xs uppercase block text-gray-500">Gold Lost</span>
                                            <span className="text-lg font-bold text-red-700">-{formatNumber(selectedReport.data.gold_lost)}</span>
                                            {(selectedReport.data.lost_from_main !== undefined || selectedReport.data.lost_from_vault !== undefined) && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {selectedReport.data.lost_from_main !== undefined && (
                                                        <div className="flex justify-between">
                                                            <span>From Main:</span>
                                                            <span>{formatNumber(selectedReport.data.lost_from_main)}</span>
                                                        </div>
                                                    )}
                                                    {selectedReport.data.lost_from_vault !== undefined && (
                                                        <div className="flex justify-between">
                                                            <span>From Vault:</span>
                                                            <span>{formatNumber(selectedReport.data.lost_from_vault)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <fieldset className="border border-gray-400 p-2">
                                    <legend className="text-xs font-bold px-1">Casualty Report</legend>
                                    <div className="space-y-1 text-sm">
                                        {selectedReport.data.enemy_killed !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Enemy Killed:</span>
                                                <span className="font-bold">{formatNumber(selectedReport.data.enemy_killed)}</span>
                                            </div>
                                        )}
                                        {selectedReport.data.soldiers_lost !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Your Losses:</span>
                                                <span className="font-bold text-red-700">{formatNumber(selectedReport.data.soldiers_lost)}</span>
                                            </div>
                                        )}
                                        {selectedReport.data.attacker_casualties !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Attacker Casualties:</span>
                                                <span className="font-bold">{formatNumber(selectedReport.data.attacker_casualties)}</span>
                                            </div>
                                        )}
                                    </div>
                                </fieldset>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Select a report to view.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
